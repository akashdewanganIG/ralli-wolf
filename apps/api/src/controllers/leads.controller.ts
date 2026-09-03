import type { Request, Response } from "express";
import { prisma } from "@repo/db";
import { LeadScoringService } from "../services/lead-scoring.service.js";
import {
  LeadStatus,
  LeadSource,
  UserRole,
  Region,
  Prisma,
} from "@prisma/client";
import { roleHasPermission } from "@repo/db/permissions";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  handleConflictError,
  handleUnauthorizedError,
  handleForbiddenError,
  validateRequiredFields,
} from "../utils/error-handler.js";
import {
  isValidEmail,
  isValidPhone,
  isValidName,
  isValidPincode,
  normalizeEmail,
  parseBoundedInteger,
  parseIsoDate,
  parsePositiveInteger,
  parseStrictBoolean,
  validateFieldLength,
} from "../utils/validators.js";
import { buildFullName, splitFullName } from "../utils/name-helpers.js";
import { parsePhoneNumber } from "../utils/phone-helper.js";
import { SAFE_USER_SELECT } from "../utils/user-select.js";
import { logWarn } from "../utils/logger.js";
import { emailService } from "../services/email.service.js";

const LEAD_ASSIGNEE_SELECT = {
  ...SAFE_USER_SELECT,
  permissions: true,
} as const;

function withoutStoredPermissions<T extends { permissions: string[] }>(
  user: T
): Omit<T, "permissions"> {
  const { permissions: _permissions, ...safeUser } = user;
  return safeUser;
}

const getLeadDisplayName = (lead: {
  firstName?: string | null;
  lastName?: string | null;
}): string => buildFullName(lead.firstName ?? "", lead.lastName ?? "");

function positiveIds(value: unknown, maximum = 100): number[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) {
    return null;
  }
  const ids = value.map(parsePositiveInteger);
  if (ids.some(id => id === null)) return null;
  return [...new Set(ids as number[])];
}

function parseCommaSeparatedIds(
  value: unknown,
  maximum = 100
): number[] | null {
  if (typeof value !== "string") return null;
  const parts = value.split(",");
  if (parts.length < 1 || parts.length > maximum) return null;
  const ids = parts.map(part => parsePositiveInteger(part));
  if (ids.some(id => id === null)) return null;
  return [...new Set(ids as number[])];
}

function isEnumValue<T extends string>(
  value: unknown,
  values: readonly T[]
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function parseEnumList<T extends string>(
  value: unknown,
  values: readonly T[],
  maximum = 20
): T[] | null {
  if (typeof value !== "string") return null;
  const parts = value.split(",").map(part => part.trim());
  if (parts.length < 1 || parts.length > maximum) return null;
  if (parts.some(part => !values.includes(part as T))) return null;
  return [...new Set(parts as T[])];
}

function parsePagination(
  pageValue: unknown,
  limitValue: unknown
): { page: number; limit: number; skip: number } | null {
  const page =
    pageValue === undefined ? 1 : parseBoundedInteger(pageValue, 1, 1_000_000);
  const limit =
    limitValue === undefined ? 10 : parseBoundedInteger(limitValue, 1, 100);
  return page === null || limit === null
    ? null
    : { page, limit, skip: (page - 1) * limit };
}

function leadAccessWhere(req: Request, leadId?: number): Prisma.LeadWhereInput {
  return {
    ...(leadId === undefined ? {} : { id: leadId }),
    deletedAt: null,
    ...(req.user?.role === UserRole.SALES ? { ownerId: req.user.id } : {}),
  };
}

class LeadMutationError extends Error {
  constructor(
    readonly reason:
      | "NOT_FOUND"
      | "INVALID_STATE"
      | "INVALID_OWNER"
      | "INVALID_KEYWORDS",
    message: string
  ) {
    super(message);
    this.name = "LeadMutationError";
  }
}

export class LeadController {
  private scoringService: LeadScoringService;

  constructor() {
    this.scoringService = new LeadScoringService();
  }

  private async convertLead(
    tx: Prisma.TransactionClient,
    req: Request,
    leadId: number,
    keywordIds: number[]
  ) {
    const lead = await tx.lead.findFirst({
      where: leadAccessWhere(req, leadId),
      include: {
        owner: { select: SAFE_USER_SELECT },
        convertedToContact: true,
      },
    });
    if (!lead) {
      throw new LeadMutationError("NOT_FOUND", "Lead not found");
    }
    if (lead.convertedToContactId) {
      throw new LeadMutationError(
        "INVALID_STATE",
        "Lead has already been converted to a contact"
      );
    }

    if (keywordIds.length > 0) {
      const keywordCount = await tx.keyword.count({
        where: { id: { in: keywordIds } },
      });
      if (keywordCount !== keywordIds.length) {
        throw new LeadMutationError(
          "INVALID_KEYWORDS",
          "One or more keywords do not exist"
        );
      }
    }

    let companyName = lead.companyName?.trim() || null;
    if (!companyName) {
      const domain = lead.email.split("@")[1]?.split(".")[0];
      if (domain) {
        companyName = domain.charAt(0).toUpperCase() + domain.slice(1);
      }
    }

    const account = companyName
      ? await tx.account.upsert({
          where: { name: companyName },
          update: {},
          create: { name: companyName },
        })
      : null;

    const contact = await tx.contact.create({
      data: {
        name: getLeadDisplayName(lead),
        email: lead.email,
        phone: lead.phone,
        accountId: account?.id ?? null,
        city: lead.city,
        state: lead.state,
        pincode: lead.pincode,
        countryCode: lead.countryCode,
        emailOptOut: lead.emailOptOut,
        optOutDate: lead.optOutDate,
        smsOptOut: lead.smsOptOut,
        whatsappOptOut: lead.whatsappOptOut,
      },
      include: { account: true },
    });

    const claimed = await tx.lead.updateMany({
      where: {
        ...leadAccessWhere(req, leadId),
        convertedToContactId: null,
      },
      data: {
        convertedToContactId: contact.id,
        status: LeadStatus.CONVERTED,
      },
    });
    if (claimed.count !== 1) {
      throw new LeadMutationError(
        "INVALID_STATE",
        "Lead was converted by another request"
      );
    }

    if (keywordIds.length > 0) {
      await tx.leadKeyword.createMany({
        data: keywordIds.map(keywordId => ({ leadId, keywordId })),
        skipDuplicates: true,
      });
      await tx.contactKeyword.createMany({
        data: keywordIds.map(keywordId => ({
          contactId: contact.id,
          keywordId,
        })),
        skipDuplicates: true,
      });
      if (account) {
        await tx.accountKeyword.createMany({
          data: keywordIds.map(keywordId => ({
            accountId: account.id,
            keywordId,
          })),
          skipDuplicates: true,
        });
      }
    }

    const updatedLead = await tx.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: {
        owner: { select: SAFE_USER_SELECT },
        convertedToContact: { include: { account: true } },
      },
    });

    return {
      lead: updatedLead,
      contact,
      message: "Lead successfully converted to contact",
    };
  }

  async getFormSubmissionsByLead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return handleValidationError(
          res,
          "Lead ID is required",
          "id",
          "Get lead form submissions"
        );
      }

      const leadId = parsePositiveInteger(id);
      if (leadId === null) {
        return handleValidationError(
          res,
          "Lead ID must be a positive integer",
          "id",
          "Get lead form submissions"
        );
      }

      if (req.user?.role === UserRole.SALES) {
        const lead = await prisma.lead.findUnique({
          where: { id: leadId, deletedAt: null },
          select: { ownerId: true },
        });
        if (!lead)
          return handleNotFoundError(res, "Lead", "Get lead form submissions");
        if (lead.ownerId !== req.user.id) {
          return handleUnauthorizedError(
            res,
            "You are not allowed to view submissions for this lead"
          );
        }
      }

      const submissions = await prisma.formSubmission.findMany({
        where: { leadId },
        orderBy: { submittedAt: "desc" },
      });

      res.json(submissions);
    } catch (error) {
      handleError(error, res, "Get lead form submissions");
    }
  }
  async getAllLeads(req: Request, res: Response) {
    try {
      const pagination = parsePagination(req.query.page, req.query.limit);
      if (!pagination) {
        return handleValidationError(
          res,
          "Page must be a positive integer and limit must be between 1 and 100",
          "pagination",
          "Get all leads"
        );
      }
      const { page, limit, skip } = pagination;

      const {
        status,
        source,
        createdFrom,
        createdTo,
        keywordIds,
        ownerId,
        ownerRegion,
        unassigned,
        assigned,
      } = req.query;

      const whereClause: Prisma.LeadWhereInput = {
        deletedAt: null,
      };

      if (status) {
        const statusArray = parseEnumList(status, Object.values(LeadStatus));
        if (!statusArray) {
          return handleValidationError(
            res,
            "Invalid lead status filter",
            "status",
            "Get all leads"
          );
        }
        whereClause.status =
          statusArray.length === 1 ? statusArray[0] : { in: statusArray };
      }

      if (source) {
        if (!isEnumValue(source, Object.values(LeadSource))) {
          return handleValidationError(
            res,
            "Invalid lead source filter",
            "source",
            "Get all leads"
          );
        }
        whereClause.source = source;
      }

      if (createdFrom || createdTo) {
        const from = createdFrom ? parseIsoDate(createdFrom) : null;
        const to = createdTo ? parseIsoDate(createdTo) : null;
        if ((createdFrom && !from) || (createdTo && !to)) {
          return handleValidationError(
            res,
            "Date filters must be calendar dates or timezone-qualified ISO timestamps",
            "date",
            "Get all leads"
          );
        }
        const toIsCalendarDay =
          typeof createdTo === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(createdTo);
        const exclusiveTo =
          to && toIsCalendarDay
            ? new Date(to.getTime() + 24 * 60 * 60 * 1_000)
            : null;
        if (
          from &&
          ((exclusiveTo && from >= exclusiveTo) ||
            (!exclusiveTo && to && from > to))
        ) {
          return handleValidationError(
            res,
            "createdFrom cannot be after createdTo",
            "date",
            "Get all leads"
          );
        }
        whereClause.createdAt = {
          ...(from ? { gte: from } : {}),
          ...(exclusiveTo ? { lt: exclusiveTo } : to ? { lte: to } : {}),
        };
      }

      if (keywordIds) {
        const keywordIdsArray = parseCommaSeparatedIds(keywordIds);
        if (!keywordIdsArray) {
          return handleValidationError(
            res,
            "Keyword IDs must be a comma-separated list of positive integers",
            "keywordIds",
            "Get all leads"
          );
        }
        whereClause.keywords = {
          some: {
            keywordId: {
              in: keywordIdsArray,
            },
          },
        };
      }

      const parsedUnassigned =
        unassigned === undefined ? false : parseStrictBoolean(unassigned);
      const parsedAssigned =
        assigned === undefined ? false : parseStrictBoolean(assigned);
      if (parsedUnassigned === null || parsedAssigned === null) {
        return handleValidationError(
          res,
          "Assigned filters must be true or false",
          "assigned",
          "Get all leads"
        );
      }
      if (parsedUnassigned && parsedAssigned) {
        return handleValidationError(
          res,
          "assigned and unassigned cannot both be true",
          "assigned",
          "Get all leads"
        );
      }
      const isUnassignedFilter = parsedUnassigned;
      const isAssignedFilter = parsedAssigned;

      if (isUnassignedFilter) {
        whereClause.ownerId = null;
      } else if (isAssignedFilter) {
        whereClause.ownerId = {
          not: null,
        };
      } else if (ownerId) {
        const parsedOwnerId = parsePositiveInteger(ownerId);
        if (parsedOwnerId === null) {
          return handleValidationError(
            res,
            "Owner ID must be a positive integer",
            "ownerId",
            "Get all leads"
          );
        }
        whereClause.ownerId = parsedOwnerId;
      }

      if (ownerRegion && !isUnassignedFilter) {
        if (!isEnumValue(ownerRegion, Object.values(Region))) {
          return handleValidationError(
            res,
            "Invalid owner region",
            "ownerRegion",
            "Get all leads"
          );
        }
        whereClause.owner = {
          region: ownerRegion,
        };
      }

      if (req.user?.role === UserRole.SALES) {
        if (isUnassignedFilter) {
          whereClause.ownerId = null;
        } else {
          whereClause.ownerId = req.user.id;
        }
        if (whereClause.owner) {
          delete whereClause.owner;
        }
      }

      const totalItems = await prisma.lead.count({ where: whereClause });

      const leads = await prisma.lead.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          owner: { select: SAFE_USER_SELECT },
          convertedToContact: true,
          keywords: {
            include: {
              keyword: true,
            },
          },
        },
      });

      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      res.json({
        data: leads,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage,
          hasPreviousPage,
        },
      });
    } catch (error) {
      handleError(error, res, "Get all leads");
    }
  }

  async createLead(req: Request, res: Response) {
    try {
      if (
        !req.body ||
        typeof req.body !== "object" ||
        Array.isArray(req.body)
      ) {
        return handleValidationError(
          res,
          "Request body must be an object",
          "body",
          "Create lead"
        );
      }

      if (!req.body.source) {
        req.body.source = LeadSource.MANUAL;
      }
      if (!req.body.status) {
        req.body.status = LeadStatus.OPEN;
      }
      if (!req.body.ownerId && req.user?.id) {
        req.body.ownerId = req.user.id;
      }

      if (!req.body.firstName && typeof req.body.name === "string") {
        const legacy = splitFullName(req.body.name);
        req.body.firstName = legacy.firstName;
        if (!req.body.lastName && legacy.lastName) {
          req.body.lastName = legacy.lastName;
        }
      }

      const {
        firstName,
        lastName,
        email,
        phone,
        companyName,
        city,
        state,
        pincode,
        source,
        status,
        ownerId,
      } = req.body;

      if (
        !validateRequiredFields(
          req.body,
          ["firstName", "email", "phone"],
          res,
          "Create lead"
        )
      ) {
        return;
      }

      if (!isEnumValue(source, Object.values(LeadSource))) {
        return handleValidationError(
          res,
          "Invalid lead source",
          "source",
          "Create lead"
        );
      }
      if (
        !isEnumValue(status, Object.values(LeadStatus)) ||
        status === LeadStatus.CONVERTED
      ) {
        return handleValidationError(
          res,
          "A new lead must have a valid non-converted status",
          "status",
          "Create lead"
        );
      }

      const parsedOwnerId = parsePositiveInteger(ownerId);
      if (parsedOwnerId === null) {
        return handleValidationError(
          res,
          "Owner ID must be a positive integer",
          "ownerId",
          "Create lead"
        );
      }
      if (req.user?.role === UserRole.SALES && parsedOwnerId !== req.user.id) {
        return handleForbiddenError(
          res,
          "Sales users can only create leads assigned to themselves",
          "Create lead"
        );
      }
      const owner = await prisma.user.findFirst({
        where: { id: parsedOwnerId, deletedAt: null },
        select: { id: true, role: true, permissions: true },
      });
      if (
        !owner ||
        !roleHasPermission(owner.role, owner.permissions, "leads.view")
      ) {
        return handleValidationError(
          res,
          "Owner must be an active user with lead access",
          "ownerId",
          "Create lead"
        );
      }

      if (!isValidName(firstName)) {
        return handleValidationError(
          res,
          "First name is required and must be non-empty (max 255 characters)",
          "firstName",
          "Create lead"
        );
      }

      if (lastName && !isValidName(lastName)) {
        return handleValidationError(
          res,
          "Last name must be non-empty (max 255 characters)",
          "lastName",
          "Create lead"
        );
      }

      if (!isValidEmail(email)) {
        return handleValidationError(
          res,
          "Invalid email address",
          "email",
          "Create lead"
        );
      }

      if (!isValidPhone(phone)) {
        return handleValidationError(
          res,
          "Invalid phone number. Phone must be 10 digits",
          "phone",
          "Create lead"
        );
      }

      if (pincode && !isValidPincode(pincode)) {
        return handleValidationError(
          res,
          "Invalid pincode. Pincode must be exactly 6 digits",
          "pincode",
          "Create lead"
        );
      }

      if (companyName && !validateFieldLength(companyName, 255)) {
        return handleValidationError(
          res,
          "Company name must be 255 characters or less",
          "companyName",
          "Create lead"
        );
      }

      if (city && !validateFieldLength(city, 100)) {
        return handleValidationError(
          res,
          "City must be 100 characters or less",
          "city",
          "Create lead"
        );
      }

      if (state && !validateFieldLength(state, 100)) {
        return handleValidationError(
          res,
          "State must be 100 characters or less",
          "state",
          "Create lead"
        );
      }

      const parsedPhone = parsePhoneNumber(phone);
      const countryCode = parsedPhone?.countryCode || "91";
      const localPhone = parsedPhone?.localNumber || phone;

      const fullName = buildFullName(firstName, lastName);
      const scoreResult = this.scoringService.calculateLeadScore({
        name: fullName,
        email,
        phone: localPhone,
        companyName,
        city,
        state,
        pincode,
      });

      const lead = await prisma.lead.create({
        data: {
          firstName,
          lastName: lastName || null,

          email: normalizeEmail(email) ?? email,
          phone: localPhone,
          countryCode,
          companyName,
          city,
          state,
          pincode,
          source,
          status,
          ownerId: parsedOwnerId,
          assignedAt: new Date(),
          score: scoreResult.totalScore,
          completenessScore: scoreResult.completenessScore,
          qualityScore: scoreResult.qualityScore,
          missingFields: scoreResult.missingFields,
          invalidFields: scoreResult.invalidFields,
        },
        include: {
          owner: { select: SAFE_USER_SELECT },
        },
      });

      res.status(201).json({
        lead,
        scoreBreakdown: {
          totalScore: scoreResult.totalScore,
          completenessScore: scoreResult.completenessScore,
          qualityScore: scoreResult.qualityScore,
          missingFields: scoreResult.missingFields,
          invalidFields: scoreResult.invalidFields,
        },
      });
    } catch (error) {
      handleError(error, res, "Create lead");
    }
  }

  async getAssignmentStats(req: Request, res: Response) {
    try {
      if (!req.user) {
        return handleUnauthorizedError(
          res,
          "Authentication required",
          "Get assignment stats"
        );
      }

      if (
        !roleHasPermission(req.user.role, req.user.permissions, "leads.manage")
      ) {
        return handleForbiddenError(
          res,
          "You do not have permission to view assignment statistics",
          "Get assignment stats"
        );
      }

      const stats = await prisma.$queryRaw<
        Array<{
          userId: number;
          totalLeads: bigint;
          totalConverted: bigint;
        }>
      >`
        SELECT 
          owner_id as "userId",
          COUNT(*)::bigint as "totalLeads",
          COUNT(*) FILTER (
            WHERE converted_to_contact_id IS NOT NULL OR status = 'CONVERTED'
          )::bigint as "totalConverted"
        FROM leads
        WHERE owner_id IS NOT NULL
        GROUP BY owner_id
      `;

      const result = stats.map(stat => {
        const totalLeads = Number(stat.totalLeads);
        const totalConverted = Number(stat.totalConverted);
        const totalRemaining = Math.max(totalLeads - totalConverted, 0);
        const conversionRate =
          totalLeads > 0 ? (totalConverted / totalLeads) * 100 : 0;

        return {
          userId: stat.userId,
          totalLeads,
          totalConverted,
          totalRemaining,
          conversionRate,
        };
      });

      res.json(result);
    } catch (error) {
      handleError(error, res, "Get assignment stats");
    }
  }

  async getLeadById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return handleValidationError(
          res,
          "Lead ID is required",
          "id",
          "Get lead by ID"
        );
      }
      const leadId = parsePositiveInteger(id);
      if (leadId === null) {
        return handleValidationError(
          res,
          "Lead ID must be a positive integer",
          "id",
          "Get lead by ID"
        );
      }
      const lead = await prisma.lead.findFirst({
        where: leadAccessWhere(req, leadId),
        include: {
          owner: { select: SAFE_USER_SELECT },
          convertedToContact: {
            include: {
              account: true,
            },
          },
          campaignMembers: {
            include: {
              campaign: true,
            },
          },
          keywords: {
            include: {
              keyword: true,
            },
          },
        },
      });

      if (!lead) {
        return handleNotFoundError(res, "Lead", "Get lead by ID");
      }

      res.json(lead);
    } catch (error) {
      handleError(error, res, "Get lead by ID");
    }
  }

  async updateLead(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return handleValidationError(
          res,
          "Lead ID is required",
          "id",
          "Update lead"
        );
      }

      const leadId = parsePositiveInteger(id);
      if (leadId === null) {
        return handleValidationError(
          res,
          "Lead ID must be a positive integer",
          "id",
          "Update lead"
        );
      }
      if (
        !req.body ||
        typeof req.body !== "object" ||
        Array.isArray(req.body)
      ) {
        return handleValidationError(
          res,
          "Request body must be an object",
          "body",
          "Update lead"
        );
      }

      const updateData = { ...req.body } as Record<string, unknown>;
      const allowedFields = [
        "name",
        "firstName",
        "lastName",
        "email",
        "phone",
        "ownerId",
        "companyName",
        "city",
        "state",
        "pincode",
        "status",
      ];
      const unsupportedField = Object.keys(updateData).find(
        key => !allowedFields.includes(key)
      );
      if (unsupportedField) {
        return handleValidationError(
          res,
          `Unsupported update field: ${unsupportedField}`,
          unsupportedField,
          "Update lead"
        );
      }
      if (Object.keys(updateData).length === 0) {
        return handleValidationError(
          res,
          "At least one update field is required",
          "body",
          "Update lead"
        );
      }
      if (!updateData.firstName && typeof updateData.name === "string") {
        const legacy = splitFullName(updateData.name);
        updateData.firstName = legacy.firstName;
        if (!updateData.lastName && legacy.lastName) {
          updateData.lastName = legacy.lastName;
        }
      }
      if (
        Object.prototype.hasOwnProperty.call(updateData, "name") &&
        typeof updateData.name !== "string"
      ) {
        return handleValidationError(
          res,
          "Legacy name must be text",
          "name",
          "Update lead"
        );
      }
      if (typeof updateData.firstName === "string") {
        updateData.firstName = updateData.firstName.trim();
      }
      if (
        typeof updateData.lastName === "string" &&
        updateData.lastName.trim() === ""
      ) {
        updateData.lastName = null;
      } else if (typeof updateData.lastName === "string") {
        updateData.lastName = updateData.lastName.trim();
      }
      for (const field of [
        "companyName",
        "city",
        "state",
        "pincode",
      ] as const) {
        if (typeof updateData[field] === "string") {
          updateData[field] = updateData[field].trim() || null;
        }
      }
      if ("name" in updateData) {
        delete updateData.name;
      }

      if (typeof updateData.email === "string") {
        updateData.email = normalizeEmail(updateData.email) ?? updateData.email;
      }

      if (Object.prototype.hasOwnProperty.call(updateData, "ownerId")) {
        const rawOwnerId = updateData.ownerId;
        if (rawOwnerId === "" || rawOwnerId == null) {
          updateData.ownerId = null;
        } else {
          const parsedOwnerId = parsePositiveInteger(rawOwnerId);
          if (parsedOwnerId === null) {
            return handleValidationError(
              res,
              "Owner ID must be a positive integer",
              "ownerId",
              "Update lead"
            );
          }
          updateData.ownerId = parsedOwnerId;
        }
      }

      const currentLead = await prisma.lead.findFirst({
        where: leadAccessWhere(req, leadId),
      });

      if (!currentLead) {
        return handleNotFoundError(res, "Lead", "Update lead");
      }

      if (updateData.status !== undefined) {
        if (!isEnumValue(updateData.status, Object.values(LeadStatus))) {
          return handleValidationError(
            res,
            "Invalid lead status",
            "status",
            "Update lead"
          );
        }
        if (
          updateData.status === LeadStatus.CONVERTED &&
          currentLead.status !== LeadStatus.CONVERTED
        ) {
          return handleValidationError(
            res,
            "Use the conversion workflow to mark a lead as converted",
            "status",
            "Update lead"
          );
        }
        if (
          currentLead.status === LeadStatus.CONVERTED &&
          updateData.status !== LeadStatus.CONVERTED
        ) {
          return handleValidationError(
            res,
            "A converted lead cannot be moved back to an active status",
            "status",
            "Update lead"
          );
        }
      }
      if (typeof updateData.ownerId === "number") {
        const owner = await prisma.user.findFirst({
          where: { id: updateData.ownerId, deletedAt: null },
          select: { role: true, permissions: true },
        });
        if (
          !owner ||
          !roleHasPermission(owner.role, owner.permissions, "leads.view")
        ) {
          return handleValidationError(
            res,
            "Owner must be an active user with lead access",
            "ownerId",
            "Update lead"
          );
        }
      }

      if (
        Object.prototype.hasOwnProperty.call(updateData, "firstName") &&
        (typeof updateData.firstName !== "string" ||
          !isValidName(updateData.firstName))
      ) {
        return handleValidationError(
          res,
          "First name must be non-empty (max 255 characters)",
          "firstName",
          "Update lead"
        );
      }

      if (
        Object.prototype.hasOwnProperty.call(updateData, "lastName") &&
        updateData.lastName !== null &&
        updateData.lastName !== undefined &&
        updateData.lastName !== "" &&
        (typeof updateData.lastName !== "string" ||
          !isValidName(updateData.lastName))
      ) {
        return handleValidationError(
          res,
          "Last name must be non-empty (max 255 characters)",
          "lastName",
          "Update lead"
        );
      }

      if (
        updateData.email !== undefined &&
        (typeof updateData.email !== "string" ||
          !isValidEmail(updateData.email))
      ) {
        return handleValidationError(
          res,
          "Invalid email address",
          "email",
          "Update lead"
        );
      }

      if (
        updateData.phone !== undefined &&
        (typeof updateData.phone !== "string" ||
          !isValidPhone(updateData.phone))
      ) {
        return handleValidationError(
          res,
          "Invalid phone number. Phone must be 10 digits",
          "phone",
          "Update lead"
        );
      }

      if (
        updateData.pincode !== undefined &&
        updateData.pincode &&
        (typeof updateData.pincode !== "string" ||
          !isValidPincode(updateData.pincode))
      ) {
        return handleValidationError(
          res,
          "Invalid pincode. Pincode must be exactly 6 digits",
          "pincode",
          "Update lead"
        );
      }

      if (
        updateData.companyName !== undefined &&
        updateData.companyName &&
        (typeof updateData.companyName !== "string" ||
          !validateFieldLength(updateData.companyName, 255))
      ) {
        return handleValidationError(
          res,
          "Company name must be 255 characters or less",
          "companyName",
          "Update lead"
        );
      }

      if (
        updateData.city !== undefined &&
        updateData.city &&
        (typeof updateData.city !== "string" ||
          !validateFieldLength(updateData.city, 100))
      ) {
        return handleValidationError(
          res,
          "City must be 100 characters or less",
          "city",
          "Update lead"
        );
      }

      if (
        updateData.state !== undefined &&
        updateData.state &&
        (typeof updateData.state !== "string" ||
          !validateFieldLength(updateData.state, 100))
      ) {
        return handleValidationError(
          res,
          "State must be 100 characters or less",
          "state",
          "Update lead"
        );
      }

      const calculateUpdatedScore = (base: typeof currentLead) => {
        const mergedFirstName =
          typeof updateData.firstName === "string"
            ? updateData.firstName
            : base.firstName;
        const mergedLastName = Object.prototype.hasOwnProperty.call(
          updateData,
          "lastName"
        )
          ? typeof updateData.lastName === "string"
            ? updateData.lastName
            : null
          : base.lastName;
        const mergedOptionalText = (
          field: "companyName" | "city" | "state" | "pincode",
          currentValue: string | null
        ): string | undefined =>
          Object.prototype.hasOwnProperty.call(updateData, field)
            ? typeof updateData[field] === "string"
              ? updateData[field]
              : undefined
            : (currentValue ?? undefined);

        return this.scoringService.calculateLeadScore({
          name: buildFullName(mergedFirstName, mergedLastName ?? ""),
          email:
            typeof updateData.email === "string"
              ? updateData.email
              : base.email,
          phone:
            (typeof updateData.phone === "string"
              ? updateData.phone
              : base.phone) ?? undefined,
          companyName: mergedOptionalText("companyName", base.companyName),
          city: mergedOptionalText("city", base.city),
          state: mergedOptionalText("state", base.state),
          pincode: mergedOptionalText("pincode", base.pincode),
        });
      };

      const filteredData = Object.keys(updateData)
        .filter(key => key !== "name")
        .reduce((obj: Record<string, unknown>, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {});

      if (typeof filteredData.phone === "string" && filteredData.phone) {
        const parsedPhone = parsePhoneNumber(filteredData.phone);
        if (parsedPhone) {
          filteredData.phone = parsedPhone.localNumber;
          filteredData.countryCode = parsedPhone.countryCode;
        }
      }

      if (Object.prototype.hasOwnProperty.call(filteredData, "ownerId")) {
        const incomingOwnerId = filteredData.ownerId;
        if (incomingOwnerId == null) {
          filteredData.assignedAt = null;
        } else if (incomingOwnerId !== currentLead.ownerId) {
          filteredData.assignedAt = new Date();
        }
      }

      const { lead, scoreResult } = await prisma.$transaction(async tx => {
        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM leads WHERE id = ${leadId} FOR UPDATE
        `;
        const lockedLead = await tx.lead.findFirst({
          where: leadAccessWhere(req, leadId),
        });
        if (!lockedLead) {
          throw new LeadMutationError("NOT_FOUND", "Lead not found");
        }
        if (
          updateData.status === LeadStatus.CONVERTED &&
          lockedLead.status !== LeadStatus.CONVERTED
        ) {
          throw new LeadMutationError(
            "INVALID_STATE",
            "Use the conversion workflow to mark a lead as converted"
          );
        }
        if (
          lockedLead.status === LeadStatus.CONVERTED &&
          updateData.status !== undefined &&
          updateData.status !== LeadStatus.CONVERTED
        ) {
          throw new LeadMutationError(
            "INVALID_STATE",
            "A converted lead cannot be moved back to an active status"
          );
        }
        if (typeof updateData.ownerId === "number") {
          const owner = await tx.user.findFirst({
            where: { id: updateData.ownerId, deletedAt: null },
            select: { role: true, permissions: true },
          });
          if (
            !owner ||
            !roleHasPermission(owner.role, owner.permissions, "leads.view")
          ) {
            throw new LeadMutationError(
              "INVALID_OWNER",
              "Owner must be an active user with lead access"
            );
          }
        }

        const lockedScore = calculateUpdatedScore(lockedLead);
        const data: Prisma.LeadUncheckedUpdateInput = {
          ...(filteredData as Prisma.LeadUncheckedUpdateInput),
          score: lockedScore.totalScore,
          completenessScore: lockedScore.completenessScore,
          qualityScore: lockedScore.qualityScore,
          missingFields: lockedScore.missingFields,
          invalidFields: lockedScore.invalidFields,
        };
        await tx.lead.update({ where: { id: leadId }, data });

        if (lockedLead.convertedToContactId) {
          const syncsContact = [
            "firstName",
            "lastName",
            "email",
            "phone",
            "city",
            "state",
            "pincode",
          ].some(field =>
            Object.prototype.hasOwnProperty.call(updateData, field)
          );
          if (syncsContact) {
            const refreshedLead = await tx.lead.findUniqueOrThrow({
              where: { id: leadId },
            });
            await tx.contact.update({
              where: { id: lockedLead.convertedToContactId },
              data: {
                name: buildFullName(
                  refreshedLead.firstName,
                  refreshedLead.lastName ?? ""
                ),
                email: refreshedLead.email,
                phone: refreshedLead.phone,
                city: refreshedLead.city,
                state: refreshedLead.state,
                pincode: refreshedLead.pincode,
                countryCode: refreshedLead.countryCode,
              },
            });
          }
        }

        const updatedLead = await tx.lead.findUniqueOrThrow({
          where: { id: leadId },
          include: {
            owner: { select: SAFE_USER_SELECT },
            convertedToContact: { include: { account: true } },
          },
        });
        return { lead: updatedLead, scoreResult: lockedScore };
      });

      const response = {
        lead: {
          ...lead,

          convertedToContactId: lead.convertedToContactId,
        },
        scoreBreakdown: {
          totalScore: scoreResult.totalScore,
          completenessScore: scoreResult.completenessScore,
          qualityScore: scoreResult.qualityScore,
          missingFields: scoreResult.missingFields,
          invalidFields: scoreResult.invalidFields,
        },
      };

      res.json(response);
    } catch (error) {
      if (error instanceof LeadMutationError) {
        if (error.reason === "NOT_FOUND") {
          return handleNotFoundError(res, "Lead", "Update lead");
        }
        if (error.reason === "INVALID_OWNER") {
          return handleValidationError(
            res,
            error.message,
            "ownerId",
            "Update lead"
          );
        }
        return handleConflictError(res, error.message, "Update lead");
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return handleNotFoundError(res, "Lead", "Update lead");
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return handleConflictError(
          res,
          "A contact with this email already exists",
          "Update lead"
        );
      }

      handleError(error, res, "Update lead");
    }
  }

  async deleteLead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return handleValidationError(
          res,
          "Lead ID is required",
          "id",
          "Delete lead"
        );
      }

      const leadId = parsePositiveInteger(id);
      if (leadId === null) {
        return handleValidationError(
          res,
          "Lead ID must be a positive integer",
          "id",
          "Delete lead"
        );
      }

      const deleted = await prisma.lead.updateMany({
        where: leadAccessWhere(req, leadId),
        data: {
          deletedAt: new Date(),
          deletedBy: req.user?.id,
        },
      });
      if (deleted.count !== 1) {
        return handleNotFoundError(res, "Lead", "Delete lead");
      }

      res.status(204).send();
    } catch (error) {
      handleError(error, res, "Delete lead");
    }
  }

  async searchLeads(req: Request, res: Response) {
    try {
      const { q } = req.query;

      if (typeof q !== "string") {
        return handleValidationError(
          res,
          "Search query must be text",
          "q",
          "Search leads"
        );
      }

      const searchTerm = q.trim();
      if (searchTerm.length < 2 || searchTerm.length > 100) {
        return handleValidationError(
          res,
          "Search query must contain between 2 and 100 characters",
          "q",
          "Search leads"
        );
      }

      const nameClauses: Prisma.LeadWhereInput[] = [
        { firstName: { contains: searchTerm, mode: "insensitive" } },
        { lastName: { contains: searchTerm, mode: "insensitive" } },
      ];

      if (searchTerm.includes(" ")) {
        const { firstName, lastName } = splitFullName(searchTerm);

        if (firstName && lastName) {
          nameClauses.push({
            AND: [
              { firstName: { contains: firstName, mode: "insensitive" } },
              { lastName: { contains: lastName, mode: "insensitive" } },
            ],
          });
        }
      }

      const leads = await prisma.lead.findMany({
        where: {
          deletedAt: null,
          ...(req.user?.role === UserRole.SALES
            ? { ownerId: req.user.id }
            : {}),
          OR: [
            ...nameClauses,
            { email: { contains: searchTerm, mode: "insensitive" } },
            { phone: { contains: searchTerm, mode: "insensitive" } },
          ],
        },
        include: {
          owner: { select: SAFE_USER_SELECT },
          convertedToContact: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      res.json(leads);
    } catch (error) {
      handleError(error, res, "Search leads");
    }
  }

  async convertLeadToContact(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const leadId = parsePositiveInteger(id);
      if (leadId === null) {
        return handleValidationError(
          res,
          "Lead ID must be a positive integer",
          "id",
          "Convert lead to contact"
        );
      }

      const keywordInput = req.body?.keywordIds;
      const keywordIds =
        keywordInput === undefined ? [] : positiveIds(keywordInput);
      if (keywordIds === null) {
        return handleValidationError(
          res,
          "Keyword IDs must contain between 1 and 100 positive integers",
          "keywordIds",
          "Convert lead to contact"
        );
      }

      const result = await prisma.$transaction(tx =>
        this.convertLead(tx, req, leadId, keywordIds)
      );

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof LeadMutationError && error.reason === "NOT_FOUND") {
        return handleNotFoundError(res, "Lead", "Convert lead to contact");
      }
      if (
        error instanceof LeadMutationError &&
        error.reason === "INVALID_STATE"
      ) {
        return handleConflictError(
          res,
          error.message,
          "Convert lead to contact"
        );
      }
      if (
        error instanceof LeadMutationError &&
        error.reason === "INVALID_KEYWORDS"
      ) {
        return handleValidationError(
          res,
          error.message,
          "keywordIds",
          "Convert lead to contact"
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return handleConflictError(
          res,
          "A contact with this email already exists",
          "Convert lead to contact"
        );
      }

      handleError(error, res, "Convert lead to contact");
    }
  }

  async getConversionHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return handleValidationError(
          res,
          "Lead ID is required",
          "id",
          "Get conversion history"
        );
      }

      const leadId = parsePositiveInteger(id);
      if (leadId === null) {
        return handleValidationError(
          res,
          "Lead ID must be a positive integer",
          "id",
          "Get conversion history"
        );
      }

      const lead = await prisma.lead.findFirst({
        where: leadAccessWhere(req, leadId),
        include: {
          owner: { select: SAFE_USER_SELECT },
          convertedToContact: {
            include: {
              account: true,
              campaignMembers: {
                include: { campaign: true },
              },
            },
          },
          campaignMembers: {
            include: {
              campaign: true,
            },
          },
          analyticsEvents: {
            orderBy: { occurredAt: "desc" },
            take: 10,
          },
          formSubmissions: {
            orderBy: { submittedAt: "desc" },
            take: 10,
          },
        },
      });

      if (!lead) {
        return handleNotFoundError(res, "Lead", "Get conversion history");
      }

      const conversionHistory = {
        lead: {
          id: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          name: getLeadDisplayName(lead),
          email: lead.email,
          phone: lead.phone,
          source: lead.source,
          status: lead.status,
          score: lead.score,
          createdAt: lead.createdAt,
          owner: lead.owner,
        },
        conversionStatus: {
          isConverted: !!lead.convertedToContactId,
          convertedToContactId: lead.convertedToContactId,
          convertedContact: lead.convertedToContact,
        },
        timeline: {
          campaignInteractions: lead.campaignMembers.length,
          analyticsEvents: lead.analyticsEvents.length,
          formSubmissions: lead.formSubmissions.length,
        },
        details: {
          campaigns: lead.campaignMembers,
          recentEvents: lead.analyticsEvents,
          recentSubmissions: lead.formSubmissions,
        },
      };

      res.json(conversionHistory);
    } catch (error) {
      handleError(error, res, "Get conversion history");
    }
  }

  async convertLeadsBulk(req: Request, res: Response) {
    try {
      const leads = req.body?.leads;
      if (!Array.isArray(leads) || leads.length < 1 || leads.length > 100) {
        return handleValidationError(
          res,
          '"leads" must contain between 1 and 100 conversion requests',
          "leads",
          "Bulk convert leads"
        );
      }

      const successful: unknown[] = [];
      const failed: Array<{ leadId: number | null; reason: string }> = [];

      for (const leadData of leads) {
        if (
          !leadData ||
          typeof leadData !== "object" ||
          Array.isArray(leadData)
        ) {
          failed.push({
            leadId: null,
            reason: "Each conversion request must be an object",
          });
          continue;
        }
        const item = leadData as Record<string, unknown>;
        const leadId = parsePositiveInteger(item.leadId);
        if (leadId === null) {
          failed.push({
            leadId: null,
            reason: "Lead ID must be a positive integer",
          });
          continue;
        }
        const keywordIds =
          item.keywordIds === undefined ? [] : positiveIds(item.keywordIds);
        if (keywordIds === null) {
          failed.push({
            leadId,
            reason:
              "Keyword IDs must contain between 1 and 100 positive integers",
          });
          continue;
        }

        try {
          const result = await prisma.$transaction(tx =>
            this.convertLead(tx, req, leadId, keywordIds)
          );
          successful.push({
            leadId,
            contactId: result.contact.id,
            ...result,
          });
        } catch (error) {
          const reason =
            error instanceof LeadMutationError
              ? error.message
              : error instanceof Prisma.PrismaClientKnownRequestError &&
                  error.code === "P2002"
                ? "A contact with this email already exists"
                : "Lead could not be converted";
          failed.push({
            leadId,
            reason,
          });
        }
      }

      const summary = {
        total: leads.length,
        successful: successful.length,
        failed: failed.length,
      };

      res.status(200).json({
        successful,
        failed,
        summary,
        message: `Bulk conversion completed: ${summary.successful}/${summary.total} successful`,
      });
    } catch (error) {
      handleError(error, res, "Bulk convert leads");
    }
  }

  async assignLeadToUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { userId } = req.body || {};

      const leadId = parsePositiveInteger(id);
      const assignedUserId = parsePositiveInteger(userId);
      if (leadId === null) {
        return handleValidationError(
          res,
          "Lead ID is invalid",
          "id",
          "Assign lead"
        );
      }
      if (assignedUserId === null) {
        return handleValidationError(
          res,
          "User ID is invalid",
          "userId",
          "Assign lead"
        );
      }

      const result = await prisma.$transaction(async tx => {
        const lead = await tx.lead.findFirst({
          where: leadAccessWhere(req, leadId),
          include: {
            owner: { select: SAFE_USER_SELECT },
            convertedToContact: true,
          },
        });

        if (!lead) {
          throw new Error("Lead not found");
        }

        const user = await tx.user.findUnique({
          where: { id: assignedUserId, deletedAt: null },
          select: LEAD_ASSIGNEE_SELECT,
        });

        if (!user) {
          throw new Error("User not found");
        }

        if (!roleHasPermission(user.role, user.permissions, "leads.view")) {
          throw new Error("INVALID_ASSIGNEE_ROLE");
        }

        const assigned = await tx.lead.updateMany({
          where: {
            ...leadAccessWhere(req, leadId),
            ownerId: lead.ownerId,
          },
          data: { ownerId: assignedUserId, assignedAt: new Date() },
        });
        if (assigned.count !== 1) {
          throw new LeadMutationError(
            "INVALID_STATE",
            "Lead ownership changed during assignment"
          );
        }
        const updatedLead = await tx.lead.findUniqueOrThrow({
          where: { id: leadId },
          include: {
            owner: { select: SAFE_USER_SELECT },
            convertedToContact: true,
          },
        });

        return {
          lead: updatedLead,
          previousOwner: lead.owner,
          newOwner: withoutStoredPermissions(user),
          assignmentDetails: {
            leadId: leadId,
            previousOwnerId: lead.ownerId,
            newOwnerId: assignedUserId,
            assignedAt: new Date(),
          },
        };
      });

      const assignedLeadName = getLeadDisplayName(result.lead);
      const newOwnerName =
        `${result.newOwner.firstName || ""} ${result.newOwner.lastName || ""}`.trim();

      res.status(200).json({
        success: true,
        message: `Lead "${assignedLeadName}" successfully assigned to ${newOwnerName}`,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Lead not found") {
        return handleNotFoundError(res, "Lead", "Assign lead");
      }

      if (error instanceof Error && error.message === "User not found") {
        return handleNotFoundError(res, "User", "Assign lead");
      }

      if (error instanceof Error && error.message === "INVALID_ASSIGNEE_ROLE") {
        return res
          .status(400)
          .json({ error: "The assignee does not have lead access" });
      }
      if (
        error instanceof LeadMutationError &&
        error.reason === "INVALID_STATE"
      ) {
        return handleConflictError(res, error.message, "Assign lead");
      }

      handleError(error, res, "Assign lead");
    }
  }

  async assignLeadsBulkToUser(req: Request, res: Response) {
    try {
      const userId = req.body?.userId;
      const leadIds = positiveIds(req.body?.leadIds);

      if (!leadIds) {
        return handleValidationError(
          res,
          '"leadIds" must contain between 1 and 100 positive integer IDs',
          "leadIds",
          "Bulk assign leads"
        );
      }

      const assignedUserId = parsePositiveInteger(userId);
      if (assignedUserId === null) {
        return handleValidationError(
          res,
          "User ID is invalid",
          "userId",
          "Bulk assign leads"
        );
      }

      const result = await prisma.$transaction(async tx => {
        const user = await tx.user.findUnique({
          where: { id: assignedUserId, deletedAt: null },
          select: LEAD_ASSIGNEE_SELECT,
        });

        if (!user) {
          throw new Error("User not found");
        }

        if (!roleHasPermission(user.role, user.permissions, "leads.view")) {
          throw new Error("INVALID_ASSIGNEE_ROLE");
        }

        const assignments = [];

        for (const leadId of leadIds) {
          const lead = await tx.lead.findFirst({
            where: leadAccessWhere(req, leadId),
            include: {
              owner: { select: SAFE_USER_SELECT },
              convertedToContact: true,
            },
          });

          if (!lead) {
            throw new Error(`Lead not found: ${leadId}`);
          }

          const assigned = await tx.lead.updateMany({
            where: {
              ...leadAccessWhere(req, leadId),
              ownerId: lead.ownerId,
            },
            data: { ownerId: assignedUserId, assignedAt: new Date() },
          });
          if (assigned.count !== 1) {
            throw new LeadMutationError(
              "INVALID_STATE",
              `Lead ownership changed during assignment: ${leadId}`
            );
          }
          const updatedLead = await tx.lead.findUniqueOrThrow({
            where: { id: leadId },
            include: {
              owner: { select: SAFE_USER_SELECT },
              convertedToContact: true,
            },
          });

          assignments.push({
            leadId,
            leadName: getLeadDisplayName(updatedLead),
            previousOwner: lead.owner,
            previousOwnerId: lead.ownerId,
            assignedAt: new Date(),
          });
        }

        return {
          user: withoutStoredPermissions(user),
          assignments,
        };
      });

      const resultUserFullName =
        `${result.user.firstName || ""} ${result.user.lastName || ""}`.trim();
      const summary = {
        total: leadIds.length,
        successful: result.assignments.length,
        assignedToUser: {
          id: result.user.id,
          name: resultUserFullName,
          email: result.user.email,
        },
      };

      if (result.user.email) {
        try {
          const leadCount = result.assignments.length;

          await emailService.sendLeadAssignmentNotificationEmail(
            result.user.email,
            resultUserFullName || result.user.email,
            leadCount
          );
        } catch {
          logWarn("lead_assignment_notification_failed", {
            userId: result.user.id,
          });
        }
      }

      const response = {
        success: true,
        message: `Successfully assigned ${summary.successful} leads to ${resultUserFullName}`,
        summary,
        assignments: result.assignments,
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && error.message === "User not found") {
        return handleNotFoundError(res, "User", "Bulk assign leads");
      }

      if (error instanceof Error && error.message === "INVALID_ASSIGNEE_ROLE") {
        return res
          .status(400)
          .json({ error: "The assignee does not have lead access" });
      }

      if (
        error instanceof Error &&
        error.message.startsWith("Lead not found:")
      ) {
        return handleNotFoundError(res, error.message, "Bulk assign leads");
      }
      if (error instanceof LeadMutationError) {
        return handleConflictError(res, error.message, "Bulk assign leads");
      }

      handleError(error, res, "Bulk assign leads");
    }
  }

  async claimLead(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return handleValidationError(
          res,
          "Lead ID is required",
          "id",
          "Claim lead"
        );
      }

      const leadId = parsePositiveInteger(id);
      if (leadId === null) {
        return handleValidationError(
          res,
          "Lead ID is invalid",
          "id",
          "Claim lead"
        );
      }
      const claimingUserId = req.user!.id;
      const claimingUser = {
        id: req.user!.id,
        email: req.user!.email,
        firstName: req.user!.firstName,
        lastName: req.user!.lastName,
        role: req.user!.role,
      };

      const result = await prisma.$transaction(async tx => {
        const lead = await tx.lead.findFirst({
          where: { id: leadId, deletedAt: null },
          include: {
            owner: { select: SAFE_USER_SELECT },
            convertedToContact: true,
          },
        });

        if (!lead) {
          throw new Error("Lead not found");
        }

        if (lead.ownerId !== null) {
          throw new Error("Lead has already been claimed by another user");
        }

        const claimed = await tx.lead.updateMany({
          where: { id: leadId, ownerId: null, deletedAt: null },
          data: { ownerId: claimingUserId, assignedAt: new Date() },
        });
        if (claimed.count !== 1) {
          throw new Error("Lead has already been claimed by another user");
        }
        const updatedLead = await tx.lead.findUniqueOrThrow({
          where: { id: leadId },
          include: {
            owner: { select: SAFE_USER_SELECT },
            convertedToContact: true,
          },
        });

        return {
          lead: updatedLead,
          claimDetails: {
            leadId: leadId,
            claimedBy: claimingUserId,
            claimedByUser: claimingUser,
            claimedAt: new Date(),
          },
        };
      });

      const claimedLeadName = getLeadDisplayName(result.lead);
      const claimedByUserName =
        `${result.claimDetails.claimedByUser.firstName || ""} ${result.claimDetails.claimedByUser.lastName || ""}`.trim();

      res.status(200).json({
        success: true,
        message: `Lead "${claimedLeadName}" successfully claimed by ${claimedByUserName}`,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Lead not found") {
        return handleNotFoundError(res, "Lead", "Claim lead");
      }

      if (
        error instanceof Error &&
        error.message === "Lead has already been claimed by another user"
      ) {
        return handleConflictError(res, error.message, "Claim lead");
      }

      handleError(error, res, "Claim lead");
    }
  }

  async claimLeadsBulk(req: Request, res: Response) {
    try {
      const leadIds = positiveIds(req.body?.leadIds);

      if (!leadIds) {
        return handleValidationError(
          res,
          '"leadIds" must contain between 1 and 100 positive integer IDs',
          "leadIds",
          "Bulk claim leads"
        );
      }

      const claimingUserId = req.user!.id;
      const claimingUser = {
        id: req.user!.id,
        email: req.user!.email,
        firstName: req.user!.firstName,
        lastName: req.user!.lastName,
        role: req.user!.role,
      };

      const successful: unknown[] = [];
      const failed: Array<{ leadId: number; reason: string }> = [];

      for (const leadId of leadIds) {
        try {
          const result = await prisma.$transaction(async tx => {
            const lead = await tx.lead.findFirst({
              where: { id: leadId, deletedAt: null },
              include: {
                owner: { select: SAFE_USER_SELECT },
                convertedToContact: true,
              },
            });

            if (!lead) {
              throw new Error("Lead not found");
            }

            if (lead.ownerId !== null) {
              throw new Error("Lead has already been claimed by another user");
            }

            const claimed = await tx.lead.updateMany({
              where: { id: lead.id, ownerId: null, deletedAt: null },
              data: { ownerId: claimingUserId, assignedAt: new Date() },
            });
            if (claimed.count !== 1) {
              throw new Error("Lead has already been claimed by another user");
            }
            const updatedLead = await tx.lead.findUniqueOrThrow({
              where: { id: lead.id },
              include: {
                owner: { select: SAFE_USER_SELECT },
                convertedToContact: true,
              },
            });

            return {
              leadId: lead.id,
              lead: updatedLead,
              claimDetails: {
                leadId: lead.id,
                claimedBy: claimingUserId,
                claimedByUser: claimingUser,
                claimedAt: new Date(),
              },
            };
          });

          successful.push(result);
        } catch (error) {
          const reason =
            (error instanceof Error && error.message === "Lead not found") ||
            (error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2025")
              ? "Lead not found"
              : error instanceof Error &&
                  error.message ===
                    "Lead has already been claimed by another user"
                ? "Lead has already been claimed by another user"
                : "Lead could not be claimed";

          failed.push({
            leadId,
            reason,
          });
        }
      }

      const summary = {
        total: leadIds.length,
        successful: successful.length,
        failed: failed.length,
      };

      const response = {
        successful,
        failed,
        summary,
        message: `Bulk claim completed: ${summary.successful}/${summary.total} successful`,
      };

      res.status(200).json(response);
    } catch (error) {
      handleError(error, res, "Bulk claim leads");
    }
  }
}
