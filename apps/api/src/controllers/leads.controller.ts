import type { Request, Response } from "express";
import { prisma } from "@repo/db";
import { LeadScoringService } from "../services/leadScoring.service.js";
import { LeadStatus, LeadSource, UserRole, Prisma } from "@prisma/client";
import { roleHasPermission } from "@repo/db/permissions";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  handleConflictError,
  handleUnauthorizedError,
  handleForbiddenError,
  validateRequiredFields,
} from "../utils/errorHandler.js";
import {
  isValidEmail,
  isValidPhone,
  isValidName,
  isValidPincode,
  validateFieldLength,
} from "../utils/validators.js";
import { buildFullName, splitFullName } from "../utils/nameHelpers.js";
import { parsePhoneNumber } from "../utils/phoneHelper.js";

const getLeadDisplayName = (lead: {
  firstName?: string | null;
  lastName?: string | null;
}): string => buildFullName(lead.firstName ?? "", lead.lastName ?? "");
import { emailService } from "../services/email.service.js";

export class LeadController {
  private scoringService: LeadScoringService;

  constructor() {
    this.scoringService = new LeadScoringService();
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

      const leadId = parseInt(id);

      // SALES can only view their own leads' submissions
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
      // Extract and validate pagination parameters
      const pageParam = req.query.page as string;
      const limitParam = req.query.limit as string;

      // Validate page parameter
      const page = Math.max(1, parseInt(pageParam) || 1);

      // Validate limit parameter with custom support
      const requestedLimit = parseInt(limitParam);
      const limit =
        requestedLimit >= 1 && requestedLimit <= 100 ? requestedLimit : 10;

      // Calculate pagination offset
      const skip = (page - 1) * limit;

      // Extract filter parameters
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

      // Build where clause for filtering
      const whereClause: any = {
        deletedAt: null, // Exclude soft-deleted leads
      };

      if (status) {
        // Handle comma-separated status values
        const statusArray = status.toString().split(",");
        whereClause.status =
          statusArray.length === 1 ? statusArray[0] : { in: statusArray };
      }

      if (source) {
        whereClause.source = source;
      }

      if (createdFrom || createdTo) {
        whereClause.createdAt = {};
        if (createdFrom)
          whereClause.createdAt.gte = new Date(createdFrom as string);
        if (createdTo)
          whereClause.createdAt.lte = new Date(createdTo as string);
      }

      // Keyword filtering - filter leads that have any of the selected keywords
      if (keywordIds) {
        const keywordIdsArray = keywordIds
          .toString()
          .split(",")
          .map((id: string) => parseInt(id.trim()))
          .filter((id: number) => !isNaN(id));
        if (keywordIdsArray.length > 0) {
          whereClause.keywords = {
            some: {
              keywordId: {
                in: keywordIdsArray,
              },
            },
          };
        }
      }

      const isUnassignedFilter =
        typeof unassigned === "string" && unassigned.toLowerCase() === "true";
      const isAssignedFilter =
        typeof assigned === "string" && assigned.toLowerCase() === "true";

      // Owner filtering
      if (isUnassignedFilter) {
        // Explicitly request unassigned leads
        whereClause.ownerId = null;
      } else if (isAssignedFilter) {
        whereClause.ownerId = {
          not: null,
        };
      } else if (ownerId) {
        // Owner-specific filtering (admins/managers)
        const parsedOwnerId = parseInt(ownerId as string);
        if (!Number.isNaN(parsedOwnerId)) {
          whereClause.ownerId = parsedOwnerId;
        }
      }

      if (ownerRegion && !isUnassignedFilter) {
        whereClause.owner = {
          ...(whereClause.owner || {}),
          region: ownerRegion,
        };
      }

      // SALES: Only see their own leads unless explicitly fetching unassigned
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

      console.log("Lead filters applied:", whereClause);

      // Execute count query with filters
      const totalItems = await prisma.lead.count({ where: whereClause });

      // Execute paginated query with filters
      const leads = await prisma.lead.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          owner: true,
          convertedToContact: true,
          keywords: {
            include: {
              keyword: true,
            },
          },
        },
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      // Return standardized pagination response
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
      console.log("=== CREATE LEAD WITH AUTO-SCORING ===");
      // Default missing fields to ensure smoother UX
      if (!req.body.source) {
        req.body.source = "MANUAL";
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

      console.log("Request body:", JSON.stringify(req.body, null, 2));
      if (
        !validateRequiredFields(
          req.body,
          ["firstName", "email", "phone", "source", "status"],
          res,
          "Create lead"
        )
      ) {
        return;
      }

      // Validate field formats and lengths
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
          "Invalid email format. Email must be a valid address ending with .com, .co, .in, .org, .net, .edu, .gov, .io, or .info",
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

      // Parse phone number to extract country code
      const parsedPhone = parsePhoneNumber(phone);
      const countryCode = parsedPhone?.countryCode || "91";
      const localPhone = parsedPhone?.localNumber || phone;

      // Calculate automatic score
      console.log("About to calculate lead score...");
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
      console.log(
        "Lead score calculated successfully:",
        JSON.stringify(scoreResult, null, 2)
      );

      console.log("Creating lead with calculated score...");

      const lead = await prisma.lead.create({
        data: {
          firstName,
          lastName: lastName || null,
          email,
          phone: localPhone,
          countryCode,
          companyName,
          city,
          state,
          pincode,
          source,
          status,
          ownerId,
          assignedAt: ownerId ? new Date() : null,
          score: scoreResult.totalScore,
          completenessScore: scoreResult.completenessScore,
          qualityScore: scoreResult.qualityScore,
          missingFields: scoreResult.missingFields,
          invalidFields: scoreResult.invalidFields,
        },
        include: {
          owner: true,
        },
      });

      console.log("Lead created successfully:");
      console.log(JSON.stringify(lead, null, 2));
      console.log("=== CREATE LEAD COMPLETED ===\n");

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
      console.error("Create Lead Error:", error);
      handleError(error, res, "Create lead");
    }
  }

  async getAllLeadsComplete(req: Request, res: Response) {
    try {
      const completeLeadData = await prisma.lead.findMany({
        where: { deletedAt: null },
        include: {
          owner: true,
          convertedToContact: {
            include: {
              account: true,
            },
          },
          campaignMembers: {
            include: {
              campaign: {
                include: {
                  creator: {
                    // include: { permissions: true }
                  },
                },
              },
            },
          },
          analyticsEvents: {
            include: {
              campaign: true,
            },
            orderBy: {
              occurredAt: "desc",
            },
          },
          formSubmissions: {
            orderBy: {
              submittedAt: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json(completeLeadData);
    } catch (error) {
      handleError(error, res, "Get all leads complete");
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

      // Use optimized raw SQL query for better performance
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
      const lead = await prisma.lead.findUnique({
        where: { id: parseInt(id), deletedAt: null },
        include: {
          owner: true,
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
      console.log("=== UPDATE LEAD WITH AUTO-SCORING ===");
      const { id } = req.params;

      if (!id) {
        console.log("❌ Lead ID is missing from request params");
        return handleValidationError(
          res,
          "Lead ID is required",
          "id",
          "Update lead"
        );
      }

      const updateData = req.body;
      if (!updateData.firstName && typeof updateData.name === "string") {
        const legacy = splitFullName(updateData.name);
        updateData.firstName = legacy.firstName;
        if (!updateData.lastName && legacy.lastName) {
          updateData.lastName = legacy.lastName;
        }
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
      if ("name" in updateData) {
        delete updateData.name;
      }
      // Normalize ownerId: allow unassignment and ensure numeric type
      if (Object.prototype.hasOwnProperty.call(updateData, "ownerId")) {
        const rawOwnerId = (updateData as any).ownerId;
        (updateData as any).ownerId =
          rawOwnerId === "" || rawOwnerId == null
            ? null
            : parseInt(String(rawOwnerId), 10);
      }
      console.log("Lead ID:", id);
      console.log("Update data received:", JSON.stringify(updateData, null, 2));
      console.log("Request headers:", req.headers);
      console.log("Request method:", req.method);
      console.log("Request URL:", req.url);

      // Get current lead data
      console.log("🔍 Looking for lead with ID:", parseInt(id));
      const currentLead = await prisma.lead.findUnique({
        where: { id: parseInt(id), deletedAt: null },
      });

      if (!currentLead) {
        console.log("❌ Lead not found with ID:", parseInt(id));
        return handleNotFoundError(res, "Lead", "Update lead");
      }

      console.log("✅ Lead found:", {
        id: currentLead.id,
        name: getLeadDisplayName(currentLead),
        email: currentLead.email,
      });

      // Validate fields that are being updated
      if (
        Object.prototype.hasOwnProperty.call(updateData, "firstName") &&
        !isValidName(updateData.firstName)
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
        !isValidName(updateData.lastName)
      ) {
        return handleValidationError(
          res,
          "Last name must be non-empty (max 255 characters)",
          "lastName",
          "Update lead"
        );
      }

      if (updateData.email !== undefined && !isValidEmail(updateData.email)) {
        return handleValidationError(
          res,
          "Invalid email format. Email must be a valid address ending with .com, .co, .in, .org, .net, .edu, .gov, .io, or .info",
          "email",
          "Update lead"
        );
      }

      if (updateData.phone !== undefined && !isValidPhone(updateData.phone)) {
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
        !isValidPincode(updateData.pincode)
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
        !validateFieldLength(updateData.companyName, 255)
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
        !validateFieldLength(updateData.city, 100)
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
        !validateFieldLength(updateData.state, 100)
      ) {
        return handleValidationError(
          res,
          "State must be 100 characters or less",
          "state",
          "Update lead"
        );
      }

      // Merge current data with updates for scoring
      const mergedFirstName =
        updateData.firstName !== undefined
          ? updateData.firstName
          : currentLead.firstName;
      const mergedLastName = Object.prototype.hasOwnProperty.call(
        updateData,
        "lastName"
      )
        ? (updateData.lastName ?? null)
        : currentLead.lastName;
      const mergedData = {
        name: buildFullName(mergedFirstName ?? "", mergedLastName ?? ""),
        email: updateData.email ?? currentLead.email,
        phone: updateData.phone ?? currentLead.phone,
        companyName: updateData.companyName ?? currentLead.companyName,
        city: updateData.city ?? currentLead.city,
        state: updateData.state ?? currentLead.state,
        pincode: updateData.pincode ?? currentLead.pincode,
      };

      // Recalculate score with updated data
      console.log(
        "🔄 Calculating lead score with merged data:",
        JSON.stringify(mergedData, null, 2)
      );
      let scoreResult;
      try {
        scoreResult = this.scoringService.calculateLeadScore(mergedData);
        console.log(
          "✅ Score calculation successful:",
          JSON.stringify(scoreResult, null, 2)
        );
      } catch (scoreError) {
        console.error("❌ Score calculation failed:", scoreError);
        // Use default scores if calculation fails
        scoreResult = {
          totalScore: 0,
          completenessScore: 0,
          qualityScore: 0,
          missingFields: [],
          invalidFields: [],
        };
      }

      // Filter allowed fields
      const allowedFields = [
        "firstName",
        "lastName",
        "email",
        "phone",
        "ownerId",
        "companyName",
        "city",
        "state",
        "pincode",
        "source",
        "status",
      ];
      const filteredData = Object.keys(updateData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj: Record<string, any>, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {});

      // Parse phone number to extract country code if phone is being updated
      if (filteredData.phone) {
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

      // Clear convertedToContactId when status changes from CONVERTED to any other status
      if (Object.prototype.hasOwnProperty.call(filteredData, "status")) {
        const currentStatus = currentLead.status;
        const newStatus = filteredData.status;
        // Normalize status values for comparison (handle both enum and string)
        const currentStatusStr = String(currentStatus || "").toUpperCase();
        const newStatusStr = String(newStatus || "").toUpperCase();
        const convertedStatusStr = String(LeadStatus.CONVERTED).toUpperCase();

        // If current status is CONVERTED and new status is different, clear the conversion reference
        if (
          currentStatusStr === convertedStatusStr &&
          newStatusStr !== convertedStatusStr
        ) {
          filteredData.convertedToContactId = null;
          console.log(
            "🔄 Clearing convertedToContactId: status changed from CONVERTED to",
            newStatus
          );
          console.log(
            "🔄 Current convertedToContactId:",
            currentLead.convertedToContactId
          );
        }
      }

      // Add calculated scores
      filteredData.score = scoreResult.totalScore;
      filteredData.completenessScore = scoreResult.completenessScore;
      filteredData.qualityScore = scoreResult.qualityScore;
      filteredData.missingFields = scoreResult.missingFields;
      filteredData.invalidFields = scoreResult.invalidFields;

      console.log("Updating lead with recalculated scores...");

      const lead = await prisma.lead.update({
        where: { id: parseInt(id) },
        data: filteredData,
        include: {
          owner: true,
          convertedToContact: {
            include: {
              account: true,
            },
          },
        },
      });

      console.log("✅ Lead updated successfully:");
      console.log(JSON.stringify(lead, null, 2));
      console.log(
        "🔄 Updated lead convertedToContactId:",
        lead.convertedToContactId
      );
      console.log("=== UPDATE LEAD COMPLETED ===\n");

      const response = {
        lead: {
          ...lead,
          // Explicitly ensure convertedToContactId is included in response
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

      console.log(
        "📤 Sending response with convertedToContactId:",
        response.lead.convertedToContactId
      );
      console.log(
        "📤 Full response lead:",
        JSON.stringify(response.lead, null, 2)
      );
      res.json(response);
    } catch (error: any) {
      console.error("❌ Update Lead Error:", {
        message: error.message,
        code: error.code,
        stack: error.stack,
        leadId: req.params.id,
        updateData: req.body,
      });

      if (error.code === "P2025") {
        console.log("❌ Lead not found error (P2025)");
        return handleNotFoundError(res, "Lead", "Update lead");
      }

      console.log("❌ Sending 500 error response");
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

      // Soft delete: set deletedAt and deletedBy
      await prisma.lead.update({
        where: { id: parseInt(id) },
        data: {
          deletedAt: new Date(),
          deletedBy: req.user?.id,
        },
      });

      res.status(204).send();
    } catch (error: any) {
      if (error.code === "P2025") {
        // Record not found
        return handleNotFoundError(res, "Lead", "Delete lead");
      }
      handleError(error, res, "Delete lead");
    }
  }

  //Lead Filtering and Search API

  async filterLeads(req: Request, res: Response) {
    try {
      const { status, source, ownerId, createdFrom, createdTo } = req.query;
      const whereClause: any = {
        deletedAt: null, // Exclude soft-deleted leads
      };

      if (status) whereClause.status = status;
      if (source) whereClause.source = source;
      if (ownerId) whereClause.ownerId = parseInt(ownerId as string);

      if (createdFrom || createdTo) {
        whereClause.createdAt = {};
        if (createdFrom)
          whereClause.createdAt.gte = new Date(createdFrom as string);
        if (createdTo)
          whereClause.createdAt.lte = new Date(createdTo as string);
      }
      console.log("Filter Query Params:", req.query);
      console.log("Prisma where Clause:", JSON.stringify(whereClause, null, 2));

      const leads = await prisma.lead.findMany({
        where: whereClause,
        include: {
          owner: true,
          convertedToContact: true,
        },
        orderBy: { createdAt: "desc" },
      });

      console.log(`Found ${leads.length} leads matching criteria`);
      res.json(leads);
    } catch (error) {
      console.error("Filter Error:", error);
      handleError(error, res, "Filter leads");
    }
  }

  async getLeadsByStatus(req: Request, res: Response) {
    try {
      const { status } = req.params;
      console.log("Filtering by status:", status);

      const leads = await prisma.lead.findMany({
        where: { status: status as LeadStatus, deletedAt: null },
        include: {
          owner: true,
          convertedToContact: true,
        },
      });
      console.log(`Found ${leads.length} leads with status: ${status}`);
      res.json(leads);
    } catch (error) {
      console.error("Status Filter Error:", error);
      handleError(error, res, "Get leads by status");
    }
  }

  async getLeadsBySource(req: Request, res: Response) {
    try {
      const { source } = req.params;
      console.log("Filtering by source:", source);

      const leads = await prisma.lead.findMany({
        where: { source: source as LeadSource, deletedAt: null },
        include: {
          owner: true,
          convertedToContact: true,
        },
      });

      console.log(`Found ${leads.length} leads with source: ${source}`);
      res.json(leads);
    } catch (error) {
      console.error("Source Filter Error:", error);
      handleError(error, res, "Get leads by source");
    }
  }

  async getLeadsByOwner(req: Request, res: Response) {
    try {
      const { ownerId } = req.params;
      console.log("Filtering by owner ID:", ownerId);

      // Extract and validate pagination parameters
      const pageParam = req.query.page as string;
      const limitParam = req.query.limit as string;

      // Validate page parameter
      const page = Math.max(1, parseInt(pageParam) || 1);

      // Validate limit parameter with custom support
      const requestedLimit = parseInt(limitParam);
      const limit =
        requestedLimit >= 1 && requestedLimit <= 100 ? requestedLimit : 10;

      // Calculate pagination offset
      const skip = (page - 1) * limit;

      // Define where clause for owner filtering
      const where = { ownerId: parseInt(ownerId as string), deletedAt: null };

      // Execute count query to get total items
      const totalItems = await prisma.lead.count({ where });

      // Execute paginated query
      const leads = await prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          owner: true,
          convertedToContact: true,
        },
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      console.log(
        `Found ${leads.length} leads for owner ID: ${ownerId} (page ${page}/${totalPages})`
      );

      // Return standardized pagination response
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
      console.error("Owner Filter Error:", error);
      handleError(error, res, "Get leads by owner");
    }
  }

  async getLeadsByScore(req: Request, res: Response) {
    try {
      const { min, max } = req.query;
      console.log("Filtering by score range:", { min, max });

      const whereClause: any = { score: {}, deletedAt: null };
      if (min) whereClause.score.gte = parseInt(min as string);
      if (max) whereClause.score.lte = parseInt(max as string);

      const leads = await prisma.lead.findMany({
        where: whereClause,
        include: {
          owner: true,
          convertedToContact: true,
        },
      });

      console.log(
        `Found ${leads.length} leads with score between ${min || "min"} and ${max || "max"}`
      );
      res.json(leads);
    } catch (error) {
      console.error("Score Filter Error:", error);
      handleError(error, res, "Get leads by score");
    }
  }

  async searchLeads(req: Request, res: Response) {
    try {
      const { q } = req.query;
      console.log("Search query:", q);

      if (!q) {
        return res
          .status(400)
          .json({ error: 'Search query parameter "q" is required' });
      }

      const searchTerm = (q as string).trim();
      if (!searchTerm) {
        return res
          .status(400)
          .json({ error: 'Search query parameter "q" is required' });
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
          OR: [
            ...nameClauses,
            { email: { contains: searchTerm, mode: "insensitive" } },
            { phone: { contains: searchTerm, mode: "insensitive" } },
          ],
        },
        include: {
          owner: true,
          convertedToContact: true,
        },
      });

      console.log(`Search found ${leads.length} leads for query: "${q}"`);
      res.json(leads);
    } catch (error) {
      console.error("Search Error:", error);
      handleError(error, res, "Search leads");
    }
  }

  //Lead Conversion API

  async convertLeadToContact(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { keywordIds } = req.body;

      console.log(`Converting lead ID: ${id}`);
      console.log("Request body:", req.body);

      if (!id) {
        return handleValidationError(
          res,
          "Lead ID is required",
          "id",
          "Convert lead to contact"
        );
      }

      const leadId = parseInt(id);

      // Use Prisma transaction to ensure atomic operation
      const result = await prisma.$transaction(async tx => {
        // 1. Find the lead to convert
        const lead = await tx.lead.findUnique({
          where: { id: leadId },
          include: {
            owner: true,
            convertedToContact: true,
          },
        });

        if (!lead) {
          throw new Error("Lead not found");
        }

        console.log("Lead found:", {
          id: lead.id,
          name: getLeadDisplayName(lead),
          email: lead.email,
          alreadyConverted: !!lead.convertedToContactId,
        });

        // 2. Check if lead is already converted
        if (lead.convertedToContactId) {
          throw new Error("Lead has already been converted to a contact");
        }

        // 3. Handle account creation or linking
        let finalAccountId = null;

        // Determine company name - use provided companyName or extract from email domain
        let companyName = lead.companyName;
        if (!companyName && lead.email) {
          // Extract domain from email (user@example.com -> example)
          const domain = lead.email.split("@")[1]?.split(".")[0];
          if (domain) {
            companyName = domain.charAt(0).toUpperCase() + domain.slice(1);
          }
        }

        if (companyName) {
          // Use existing account if one already exists with the same unique name
          const existingAccount = await tx.account.findUnique({
            where: { name: companyName },
          });

          if (existingAccount) {
            finalAccountId = existingAccount.id;
            console.log("Existing account reused:", {
              id: existingAccount.id,
              name: existingAccount.name,
            });
          } else {
            // Create new account from lead's company information
            const newAccount = await tx.account.create({
              data: {
                name: companyName,
                industry: null,
                website: null,
              },
            });
            finalAccountId = newAccount.id;
            console.log("New account created:", {
              id: newAccount.id,
              name: newAccount.name,
            });
          }
        }

        const leadFullName = getLeadDisplayName(lead);

        // 4. Create new contact from lead data
        const newContact = await tx.contact.create({
          data: {
            name: leadFullName,
            email: lead.email,
            phone: lead.phone,
            position: null,
            accountId: finalAccountId,
          },
          include: {
            account: true,
          },
        });

        console.log("Contact created:", {
          id: newContact.id,
          name: newContact.name,
          email: newContact.email,
        });

        // 5. Update lead with conversion reference and change status
        const updatedLead = await tx.lead.update({
          where: { id: leadId },
          data: {
            convertedToContactId: newContact.id,
            status: LeadStatus.CONVERTED,
          },
          include: {
            owner: true,
            convertedToContact: {
              include: { account: true },
            },
          },
        });

        console.log("Lead updated with conversion:", {
          leadId: updatedLead.id,
          convertedToContactId: updatedLead.convertedToContactId,
          status: updatedLead.status,
        });

        // 6. Associate keywords with lead, contact, and account if provided
        if (keywordIds && Array.isArray(keywordIds) && keywordIds.length > 0) {
          const validKeywordIds = keywordIds
            .map((id: any) => parseInt(id))
            .filter((id: number) => !isNaN(id));

          if (validKeywordIds.length > 0) {
            // Verify all keywords exist
            const keywords = await tx.keyword.findMany({
              where: { id: { in: validKeywordIds } },
            });

            if (keywords.length !== validKeywordIds.length) {
              throw new Error("One or more keywords not found");
            }

            // Associate keywords with lead
            await tx.leadKeyword.createMany({
              data: validKeywordIds.map((keywordId: number) => ({
                leadId: leadId,
                keywordId: keywordId,
              })),
              skipDuplicates: true,
            });

            // Associate keywords with contact
            await tx.contactKeyword.createMany({
              data: validKeywordIds.map((keywordId: number) => ({
                contactId: newContact.id,
                keywordId: keywordId,
              })),
              skipDuplicates: true,
            });

            // Associate keywords with account if account exists
            if (finalAccountId) {
              await tx.accountKeyword.createMany({
                data: validKeywordIds.map((keywordId: number) => ({
                  accountId: finalAccountId,
                  keywordId: keywordId,
                })),
                skipDuplicates: true,
              });
            }

            console.log("Keywords associated:", {
              leadId: leadId,
              contactId: newContact.id,
              accountId: finalAccountId,
              keywordIds: validKeywordIds,
            });
          }
        }

        return {
          lead: updatedLead,
          contact: newContact,
          message: "Lead successfully converted to contact",
        };
      });

      console.log("Conversion completed successfully");
      res.status(201).json(result);
    } catch (error: any) {
      console.error("Conversion Error:", error);

      if (error.message === "Lead not found") {
        return handleNotFoundError(res, "Lead", "Convert lead to contact");
      }

      if (error.message === "Lead has already been converted to a contact") {
        return handleConflictError(
          res,
          error.message,
          "Convert lead to contact"
        );
      }

      // Handle unique constraint violation (email already exists)
      if (error.code === "P2002") {
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
      console.log(`Fetching conversion history for lead ID: ${id}`);

      if (!id) {
        return handleValidationError(
          res,
          "Lead ID is required",
          "id",
          "Get conversion history"
        );
      }

      const leadId = parseInt(id);

      // Get the lead with conversion details
      const lead = await prisma.lead.findUnique({
        where: { id: leadId, deletedAt: null },
        include: {
          owner: true,
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
        console.log(`Lead not found: ${id}`);
        return handleNotFoundError(res, "Lead", "Get conversion history");
      }

      console.log("Lead conversion status:", {
        leadId: lead.id,
        isConverted: !!lead.convertedToContactId,
        convertedToContactId: lead.convertedToContactId,
        status: lead.status,
      });

      // Build conversion history object
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

      console.log("Conversion history retrieved:", {
        leadId: lead.id,
        isConverted: conversionHistory.conversionStatus.isConverted,
        totalInteractions:
          conversionHistory.timeline.campaignInteractions +
          conversionHistory.timeline.analyticsEvents +
          conversionHistory.timeline.formSubmissions,
      });

      res.json(conversionHistory);
    } catch (error) {
      console.error("Conversion History Error:", error);
      handleError(error, res, "Get conversion history");
    }
  }

  async updateLeadScore(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { score, reason } = req.body;

      console.log(`Updating score for lead ID: ${id}`);
      console.log("Score update request:", { score, reason });

      if (!id) {
        return handleValidationError(
          res,
          "Lead ID is required",
          "id",
          "Update lead score"
        );
      }

      if (score === undefined || score === null) {
        return handleValidationError(
          res,
          "Score value is required",
          "score",
          "Update lead score"
        );
      }

      const leadId = parseInt(id);
      const newScore = parseInt(score);

      // Validate score range (0-100)
      if (newScore < 0 || newScore > 100) {
        console.log("Invalid score value:", newScore);
        return handleValidationError(
          res,
          "Score must be between 0 and 100",
          "score",
          "Update lead score"
        );
      }

      // Get current lead to track score change
      const currentLead = await prisma.lead.findUnique({
        where: { id: leadId, deletedAt: null },
        select: { score: true, email: true, firstName: true, lastName: true },
      });

      if (!currentLead) {
        console.log(`Lead not found: ${id}`);
        return handleNotFoundError(res, "Lead", "Update lead score");
      }

      console.log("Current score:", currentLead.score);
      console.log("New score:", newScore);
      console.log("Score change:", newScore - currentLead.score);

      // Update the lead score
      const updatedLead = await prisma.lead.update({
        where: { id: leadId },
        data: { score: newScore },
        include: {
          owner: true,
          convertedToContact: true,
        },
      });

      console.log("Score updated successfully:", {
        leadId: updatedLead.id,
        leadName: getLeadDisplayName(updatedLead),
        previousScore: currentLead.score,
        newScore: updatedLead.score,
        scoreDifference: updatedLead.score - currentLead.score,
        reason: reason || "Not specified",
      });

      // Return detailed response
      res.json({
        lead: updatedLead,
        scoreUpdate: {
          previousScore: currentLead.score,
          newScore: updatedLead.score,
          change: updatedLead.score - currentLead.score,
          reason: reason || null,
          updatedAt: new Date(),
        },
        message: "Lead score updated successfully",
      });
    } catch (error: any) {
      console.error("Score Update Error:", error);

      if (error.code === "P2025") {
        return handleNotFoundError(res, "Lead", "Update lead score");
      }

      handleError(error, res, "Update lead score");
    }
  }

  //Bulk conversion API
  async convertLeadsBulk(req: Request, res: Response) {
    try {
      console.log("=== BULK LEAD CONVERSION STARTED ===");

      const { leads } = req.body;

      // Validate request body
      if (!leads || !Array.isArray(leads) || leads.length === 0) {
        console.log("Invalid request: leads array is required");
        return handleValidationError(
          res,
          'Request body must contain a "leads" array with at least one lead',
          "leads",
          "Bulk convert leads"
        );
      }

      console.log("Total leads to convert:", leads.length);
      console.log("Leads data:", JSON.stringify(leads, null, 2));

      const successful: any[] = [];
      const failed: any[] = [];

      // Process each lead independently
      for (const leadData of leads) {
        const { leadId, keywordIds } = leadData;

        console.log("\n--- Processing lead ID:", leadId);

        if (!leadId) {
          console.log("Lead conversion failed: Missing leadId");
          failed.push({
            leadId: null,
            error: "Missing leadId",
            reason: "Lead ID is required for each lead in the array",
          });
          continue;
        }

        try {
          // Use transaction for atomic operation
          const result = await prisma.$transaction(async tx => {
            // 1. Find the lead to convert
            const lead = await tx.lead.findUnique({
              where: { id: parseInt(leadId) },
              include: {
                owner: true,
                convertedToContact: true,
              },
            });

            if (!lead) {
              throw new Error("Lead not found");
            }

            console.log("Lead found:", {
              id: lead.id,
              name: getLeadDisplayName(lead),
              email: lead.email,
              alreadyConverted: !!lead.convertedToContactId,
            });

            // 2. Check if lead is already converted
            if (lead.convertedToContactId) {
              throw new Error("Lead has already been converted to a contact");
            }

            // 3. Handle account creation or linking
            let finalAccountId = null;

            // Determine company name - use provided companyName or extract from email domain
            let companyName = lead.companyName;
            if (!companyName && lead.email) {
              // Extract domain from email (user@example.com -> example)
              const domain = lead.email.split("@")[1]?.split(".")[0];
              if (domain) {
                companyName = domain.charAt(0).toUpperCase() + domain.slice(1);
              }
            }

            if (companyName) {
              // Use existing account if one already exists with the same unique name
              const existingAccount = await tx.account.findUnique({
                where: { name: companyName },
              });

              if (existingAccount) {
                finalAccountId = existingAccount.id;
              } else {
                // Create new account from lead's company information
                const newAccount = await tx.account.create({
                  data: {
                    name: companyName,
                    industry: null,
                    website: null,
                  },
                });
                finalAccountId = newAccount.id;
                console.log("New account created for bulk conversion:", {
                  id: newAccount.id,
                  name: newAccount.name,
                });
              }
            }

            // 4. Create new contact from lead data
            const leadFullName = getLeadDisplayName(lead);

            const newContact = await tx.contact.create({
              data: {
                name: leadFullName,
                email: lead.email,
                phone: lead.phone,
                position: null,
                accountId: finalAccountId,
              },
              include: {
                account: true,
              },
            });

            console.log("Contact created from lead:", {
              leadId: lead.id,
              contactId: newContact.id,
              name: newContact.name,
              email: newContact.email,
            });

            // 5. Update lead with conversion reference and change status
            const updatedLead = await tx.lead.update({
              where: { id: lead.id },
              data: {
                convertedToContactId: newContact.id,
                status: LeadStatus.CONVERTED,
              },
              include: {
                owner: true,
                convertedToContact: {
                  include: { account: true },
                },
              },
            });

            console.log("Lead updated with conversion:", {
              leadId: updatedLead.id,
              convertedToContactId: updatedLead.convertedToContactId,
              status: updatedLead.status,
            });

            // 6. Associate keywords with lead, contact, and account if provided
            if (
              keywordIds &&
              Array.isArray(keywordIds) &&
              keywordIds.length > 0
            ) {
              const validKeywordIds = keywordIds
                .map((id: any) => parseInt(id))
                .filter((id: number) => !isNaN(id));

              if (validKeywordIds.length > 0) {
                // Verify all keywords exist
                const keywords = await tx.keyword.findMany({
                  where: { id: { in: validKeywordIds } },
                });

                if (keywords.length === validKeywordIds.length) {
                  // Associate keywords with lead
                  await tx.leadKeyword.createMany({
                    data: validKeywordIds.map((keywordId: number) => ({
                      leadId: lead.id,
                      keywordId: keywordId,
                    })),
                    skipDuplicates: true,
                  });

                  // Associate keywords with contact
                  await tx.contactKeyword.createMany({
                    data: validKeywordIds.map((keywordId: number) => ({
                      contactId: newContact.id,
                      keywordId: keywordId,
                    })),
                    skipDuplicates: true,
                  });

                  // Associate keywords with account if account exists
                  if (finalAccountId) {
                    await tx.accountKeyword.createMany({
                      data: validKeywordIds.map((keywordId: number) => ({
                        accountId: finalAccountId,
                        keywordId: keywordId,
                      })),
                      skipDuplicates: true,
                    });
                  }
                }
              }
            }

            return {
              leadId: lead.id,
              contactId: newContact.id,
              lead: updatedLead,
              contact: newContact,
              message: `Lead ${lead.id} successfully converted to contact ${newContact.id}`,
            };
          });

          console.log("✓ Lead conversion successful:", result.leadId);
          successful.push(result);
        } catch (error: any) {
          console.log("✗ Lead conversion failed:", {
            leadId,
            error: error.message,
          });

          let reason = error.message;

          // Handle specific Prisma errors
          if (error.code === "P2002") {
            reason = "A contact with this email already exists";
          } else if (error.code === "P2025") {
            reason = "Lead not found";
          }

          failed.push({
            leadId: parseInt(leadId),
            error: error.message,
            reason: reason,
          });
        }
      }

      // Build summary
      const summary = {
        total: leads.length,
        successful: successful.length,
        failed: failed.length,
      };

      console.log("\n=== BULK CONVERSION SUMMARY ===");
      console.log("Total leads processed:", summary.total);
      console.log("Successfully converted:", summary.successful);
      console.log("Failed conversions:", summary.failed);
      console.log(
        "Success rate:",
        `${((summary.successful / summary.total) * 100).toFixed(2)}%`
      );

      // Build response
      const response = {
        successful,
        failed,
        summary,
        message: `Bulk conversion completed: ${summary.successful}/${summary.total} successful`,
      };

      console.log("\n=== FINAL RESPONSE ===");
      console.log(JSON.stringify(response, null, 2));
      console.log("=== BULK LEAD CONVERSION ENDED ===\n");

      res.status(200).json(response);
    } catch (error) {
      console.error("=== BULK CONVERSION CRITICAL ERROR ===");
      console.error("Error:", error);
      handleError(error, res, "Bulk convert leads");
    }
  }

  //Lead Assignment API

  //Single Lead Assignment API
  async assignLeadToUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { userId, reason } = req.body;

      console.log(`=== SINGLE LEAD ASSIGNMENT STARTED ===`);
      console.log(`Assigning lead ID: ${id} to user ID: ${userId}`);
      console.log("Assignment request:", { leadId: id, userId, reason });

      if (!id) {
        console.log("Assignment failed: Missing lead ID");
        return res.status(400).json({ error: "Lead ID is required" });
      }

      if (!userId) {
        console.log("Assignment failed: Missing user ID");
        return res.status(400).json({ error: "User ID is required" });
      }

      const leadId = parseInt(id);
      const assignedUserId = parseInt(userId);

      const result = await prisma.$transaction(async tx => {
        const lead = await tx.lead.findUnique({
          where: { id: leadId },
          include: {
            owner: true,
            convertedToContact: true,
          },
        });

        if (!lead) {
          throw new Error("Lead not found");
        }

        const user = await tx.user.findUnique({
          where: { id: assignedUserId },
        });

        if (!user) {
          throw new Error("User not found");
        }

        if (user.role !== UserRole.SALES) {
          throw new Error("INVALID_ASSIGNEE_ROLE");
        }

        const updatedLead = await tx.lead.update({
          where: { id: leadId },
          data: { ownerId: assignedUserId, assignedAt: new Date() },
          include: {
            owner: true,
            convertedToContact: true,
          },
        });

        return {
          lead: updatedLead,
          previousOwner: lead.owner,
          newOwner: user,
          assignmentDetails: {
            leadId: leadId,
            previousOwnerId: lead.ownerId,
            newOwnerId: assignedUserId,
            reason: reason || null,
            assignedAt: new Date(),
          },
        };
      });

      console.log("=== SINGLE ASSIGNMENT SUCCESS ===");
      const assignedLeadName = getLeadDisplayName(result.lead);
      const previousOwnerName = result.previousOwner
        ? `${result.previousOwner.firstName || ""} ${result.previousOwner.lastName || ""}`.trim()
        : "Unassigned";
      const newOwnerName =
        `${result.newOwner.firstName || ""} ${result.newOwner.lastName || ""}`.trim();
      console.log("Assignment completed:", {
        leadId: result.assignmentDetails.leadId,
        leadName: assignedLeadName,
        previousOwner: previousOwnerName || "Unassigned",
        newOwner: newOwnerName,
        reason: result.assignmentDetails.reason,
      });
      console.log("Full response:", JSON.stringify(result, null, 2));

      res.status(200).json({
        success: true,
        message: `Lead "${assignedLeadName}" successfully assigned to ${newOwnerName}`,
        data: result,
      });
    } catch (error: any) {
      console.error("=== SINGLE ASSIGNMENT ERROR ===");
      console.error("Assignment failed:", error.message);

      if (error.message === "Lead not found") {
        return res.status(404).json({ error: error.message });
      }

      if (error.message === "User not found") {
        return res.status(404).json({ error: error.message });
      }

      if (error.message === "INVALID_ASSIGNEE_ROLE") {
        return res
          .status(400)
          .json({ error: "Leads can only be assigned to sales users" });
      }

      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Bulk Lead Assignment API
  async assignLeadsBulkToUser(req: Request, res: Response) {
    try {
      console.log("=== BULK LEAD ASSIGNMENT STARTED ===");

      const { leadIds, userId, reason } = req.body;

      console.log("Bulk assignment request:", {
        totalLeads: leadIds?.length || 0,
        userId,
        reason,
      });

      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        console.log("Bulk assignment failed: Invalid leadIds array");
        return handleValidationError(
          res,
          'Request body must contain a "leadIds" array with at least one lead ID',
          "leadIds",
          "Bulk assign leads"
        );
      }

      if (!userId) {
        console.log("Bulk assignment failed: Missing user ID");
        return handleValidationError(
          res,
          "User ID is required",
          "userId",
          "Bulk assign leads"
        );
      }

      const assignedUserId = parseInt(userId);

      // Use a single transaction - if any assignment fails, all rollback
      const result = await prisma.$transaction(async tx => {
        // Verify user exists first
        const user = await tx.user.findUnique({
          where: { id: assignedUserId },
        });

        if (!user) {
          throw new Error("User not found");
        }

        if (user.role !== UserRole.SALES) {
          throw new Error("INVALID_ASSIGNEE_ROLE");
        }

        const userFullName =
          `${user.firstName || ""} ${user.lastName || ""}`.trim();
        console.log(
          `Assigning ${leadIds.length} leads to user: ${userFullName}`
        );

        const assignments = [];

        // Process each lead
        for (const leadId of leadIds) {
          console.log(`--- Processing lead ID: ${leadId} ---`);

          const lead = await tx.lead.findUnique({
            where: { id: parseInt(leadId) },
            include: {
              owner: true,
              convertedToContact: true,
            },
          });

          if (!lead) {
            throw new Error(`Lead not found: ${leadId}`);
          }

          const updatedLead = await tx.lead.update({
            where: { id: parseInt(leadId) },
            data: { ownerId: assignedUserId, assignedAt: new Date() },
            include: {
              owner: true,
              convertedToContact: true,
            },
          });

          console.log(`✓ Lead ${leadId} assigned successfully`);

          assignments.push({
            leadId: parseInt(leadId),
            leadName: getLeadDisplayName(updatedLead),
            previousOwner: lead.owner,
            previousOwnerId: lead.ownerId,
            assignedAt: new Date(),
          });
        }

        return {
          user,
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
        reason: reason || null,
      };

      // Send notification email to the assigned user
      if (result.user.email) {
        try {
          const leadCount = result.assignments.length;

          await emailService.sendLeadAssignmentNotificationEmail(
            result.user.email,
            resultUserFullName || result.user.email,
            leadCount
          );

          console.log(`✓ Notification email sent to ${result.user.email}`);
        } catch (emailError) {
          console.error("Failed to send notification email:", emailError);
          // Don't fail the assignment if email fails
        }
      }

      console.log("\n=== BULK ASSIGNMENT SUMMARY ===");
      console.log("Total leads processed:", summary.total);
      console.log("Successfully assigned:", summary.successful);
      console.log("Assigned to user:", summary.assignedToUser.name);
      console.log("Reason:", summary.reason);

      const response = {
        success: true,
        message: `Successfully assigned ${summary.successful} leads to ${resultUserFullName}`,
        summary,
        assignments: result.assignments,
      };

      console.log("\n=== FINAL BULK ASSIGNMENT RESPONSE ===");
      console.log(JSON.stringify(response, null, 2));
      console.log("=== BULK LEAD ASSIGNMENT ENDED ===\n");

      res.status(200).json(response);
    } catch (error: any) {
      console.error("=== BULK ASSIGNMENT ERROR ===");
      console.error("Error:", error.message);
      console.error("All assignments rolled back");

      if (error.message === "User not found") {
        return handleNotFoundError(res, "User", "Bulk assign leads");
      }

      if (error.message === "INVALID_ASSIGNEE_ROLE") {
        return res
          .status(400)
          .json({ error: "Leads can only be assigned to sales users" });
      }

      if (error.message?.startsWith("Lead not found:")) {
        return handleNotFoundError(res, error.message, "Bulk assign leads");
      }

      handleError(error, res, "Bulk assign leads");
    }
  }

  //Lead Claim APIs

  //Single Lead Claim API
  async claimLead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      console.log(`=== SINGLE LEAD CLAIM STARTED ===`);
      console.log(`Claiming lead ID: ${id} for user ID: ${userId}`);
      console.log("Claim request:", { leadId: id, userId });

      if (!id) {
        console.log("Claim failed: Missing lead ID");
        return handleValidationError(
          res,
          "Lead ID is required",
          "id",
          "Claim lead"
        );
      }

      if (!userId) {
        console.log("Claim failed: Missing user ID");
        return handleValidationError(
          res,
          "User ID is required",
          "userId",
          "Claim lead"
        );
      }

      const leadId = parseInt(id);
      const claimingUserId = parseInt(userId);

      const result = await prisma.$transaction(async tx => {
        // 1. Find the lead to claim
        const lead = await tx.lead.findUnique({
          where: { id: leadId },
          include: {
            owner: true,
            convertedToContact: true,
          },
        });

        if (!lead) {
          throw new Error("Lead not found");
        }

        const leadDisplayName = getLeadDisplayName(lead);
        const currentOwnerName = lead.owner
          ? `${lead.owner.firstName || ""} ${lead.owner.lastName || ""}`.trim()
          : "Unclaimed";
        console.log("Lead found:", {
          id: lead.id,
          name: leadDisplayName,
          email: lead.email,
          currentOwner: currentOwnerName || "Unclaimed",
          currentOwnerId: lead.ownerId,
        });

        // 2. Check if lead is already claimed
        if (lead.ownerId !== null) {
          throw new Error("Lead has already been claimed by another user");
        }

        // 3. Verify user exists
        const user = await tx.user.findUnique({
          where: { id: claimingUserId },
        });

        if (!user) {
          throw new Error("User not found");
        }

        const userFullName =
          `${user.firstName || ""} ${user.lastName || ""}`.trim();
        console.log("User found:", {
          id: user.id,
          name: userFullName,
          email: user.email,
        });

        // 4. Update lead with new owner
        const updatedLead = await tx.lead.update({
          where: { id: leadId },
          data: { ownerId: claimingUserId, assignedAt: new Date() },
          include: {
            owner: true,
            convertedToContact: true,
          },
        });

        const updatedLeadName = getLeadDisplayName(updatedLead);
        const newOwnerName = updatedLead.owner
          ? `${updatedLead.owner.firstName || ""} ${updatedLead.owner.lastName || ""}`.trim()
          : "";
        console.log("Lead claimed successfully:", {
          leadId: updatedLead.id,
          leadName: updatedLeadName,
          newOwner: newOwnerName,
          newOwnerId: updatedLead.ownerId,
        });

        return {
          lead: updatedLead,
          claimDetails: {
            leadId: leadId,
            claimedBy: claimingUserId,
            claimedByUser: user,
            claimedAt: new Date(),
          },
        };
      });

      console.log("=== SINGLE CLAIM SUCCESS ===");
      const claimedLeadName = getLeadDisplayName(result.lead);
      const claimedByUserName =
        `${result.claimDetails.claimedByUser.firstName || ""} ${result.claimDetails.claimedByUser.lastName || ""}`.trim();
      console.log("Claim completed:", {
        leadId: result.claimDetails.leadId,
        leadName: claimedLeadName,
        claimedBy: claimedByUserName,
        claimedAt: result.claimDetails.claimedAt,
      });
      console.log("Full response:", JSON.stringify(result, null, 2));

      res.status(200).json({
        success: true,
        message: `Lead "${claimedLeadName}" successfully claimed by ${claimedByUserName}`,
        data: result,
      });
    } catch (error: any) {
      console.error("=== SINGLE CLAIM ERROR ===");
      console.error("Claim failed:", error.message);

      if (error.message === "Lead not found") {
        return handleNotFoundError(res, "Lead", "Claim lead");
      }

      if (error.message === "User not found") {
        return handleNotFoundError(res, "User", "Claim lead");
      }

      if (error.message === "Lead has already been claimed by another user") {
        return handleConflictError(res, error.message, "Claim lead");
      }

      handleError(error, res, "Claim lead");
    }
  }

  //Bulk Lead Claim API
  async claimLeadsBulk(req: Request, res: Response) {
    try {
      console.log("=== BULK LEAD CLAIM STARTED ===");

      const { leadIds, userId } = req.body;

      console.log("Bulk claim request:", {
        totalLeads: leadIds?.length || 0,
        userId,
      });

      // Validate request body
      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        console.log("Bulk claim failed: Invalid leadIds array");
        return handleValidationError(
          res,
          'Request body must contain a "leadIds" array with at least one lead ID',
          "leadIds",
          "Bulk claim leads"
        );
      }

      if (!userId) {
        console.log("Bulk claim failed: Missing user ID");
        return handleValidationError(
          res,
          "User ID is required",
          "userId",
          "Bulk claim leads"
        );
      }

      const claimingUserId = parseInt(userId);

      console.log("Total leads to claim:", leadIds.length);
      console.log("Leads data:", JSON.stringify(leadIds, null, 2));

      const successful: any[] = [];
      const failed: any[] = [];

      // Process each lead independently
      for (const leadId of leadIds) {
        console.log("\n--- Processing lead ID:", leadId);

        if (!leadId) {
          console.log("Lead claim failed: Missing leadId");
          failed.push({
            leadId: null,
            error: "Missing leadId",
            reason: "Lead ID is required for each lead in the array",
          });
          continue;
        }

        try {
          // Use transaction for atomic operation
          const result = await prisma.$transaction(async tx => {
            // 1. Find the lead to claim
            const lead = await tx.lead.findUnique({
              where: { id: parseInt(leadId) },
              include: {
                owner: true,
                convertedToContact: true,
              },
            });

            if (!lead) {
              throw new Error("Lead not found");
            }

            const leadDisplayName = getLeadDisplayName(lead);
            const currentOwnerNameBulk = lead.owner
              ? `${lead.owner.firstName || ""} ${lead.owner.lastName || ""}`.trim()
              : "Unclaimed";
            console.log("Lead found:", {
              id: lead.id,
              name: leadDisplayName,
              email: lead.email,
              currentOwner: currentOwnerNameBulk || "Unclaimed",
              currentOwnerId: lead.ownerId,
            });

            // 2. Check if lead is already claimed
            if (lead.ownerId !== null) {
              throw new Error("Lead has already been claimed by another user");
            }

            // 3. Verify user exists
            const user = await tx.user.findUnique({
              where: { id: claimingUserId },
            });

            if (!user) {
              throw new Error("User not found");
            }

            const bulkUserFullName =
              `${user.firstName || ""} ${user.lastName || ""}`.trim();
            console.log("User found:", {
              id: user.id,
              name: bulkUserFullName,
              email: user.email,
            });

            // 4. Update lead with new owner
            const updatedLead = await tx.lead.update({
              where: { id: lead.id },
              data: { ownerId: claimingUserId, assignedAt: new Date() },
              include: {
                owner: true,
                convertedToContact: true,
              },
            });

            const updatedLeadName = getLeadDisplayName(updatedLead);
            const bulkNewOwnerName = updatedLead.owner
              ? `${updatedLead.owner.firstName || ""} ${updatedLead.owner.lastName || ""}`.trim()
              : "";
            console.log("Lead claimed successfully:", {
              leadId: updatedLead.id,
              leadName: updatedLeadName,
              newOwner: bulkNewOwnerName,
              newOwnerId: updatedLead.ownerId,
            });

            return {
              leadId: lead.id,
              lead: updatedLead,
              claimDetails: {
                leadId: lead.id,
                claimedBy: claimingUserId,
                claimedByUser: user,
                claimedAt: new Date(),
              },
            };
          });

          console.log("✓ Lead claim successful:", result.leadId);
          successful.push(result);
        } catch (error: any) {
          console.log("✗ Lead claim failed:", { leadId, error: error.message });

          let reason = error.message;

          // Handle specific Prisma errors
          if (error.code === "P2025") {
            reason = "Lead not found";
          }

          failed.push({
            leadId: parseInt(leadId),
            error: error.message,
            reason: reason,
          });
        }
      }

      // Build summary
      const summary = {
        total: leadIds.length,
        successful: successful.length,
        failed: failed.length,
      };

      console.log("\n=== BULK CLAIM SUMMARY ===");
      console.log("Total leads processed:", summary.total);
      console.log("Successfully claimed:", summary.successful);
      console.log("Failed claims:", summary.failed);
      console.log(
        "Success rate:",
        `${((summary.successful / summary.total) * 100).toFixed(2)}%`
      );

      // Build response
      const response = {
        successful,
        failed,
        summary,
        message: `Bulk claim completed: ${summary.successful}/${summary.total} successful`,
      };

      console.log("\n=== FINAL RESPONSE ===");
      console.log(JSON.stringify(response, null, 2));
      console.log("=== BULK LEAD CLAIM ENDED ===\n");

      res.status(200).json(response);
    } catch (error) {
      console.error("=== BULK CLAIM CRITICAL ERROR ===");
      console.error("Error:", error);
      handleError(error, res, "Bulk claim leads");
    }
  }
}
