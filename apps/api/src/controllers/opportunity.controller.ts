import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { roleHasPermission } from "@repo/db/permissions";
import { Prisma, OpportunityStage } from "@prisma/client";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  validateRequiredFields,
} from "../utils/error-handler.js";
import { buildFullName } from "../utils/name-helpers.js";
import { OpportunityType } from "@prisma/client";
import { emailService } from "../services/email.service.js";
import { logError } from "../utils/logger.js";
import {
  parseBoundedInteger,
  parseIsoDate,
  parseNonNegativeDecimal,
  parsePositiveInteger,
} from "../utils/validators.js";
import {
  nextDocumentNumber,
  SEQUENCE_KEYS,
} from "../services/supplyChain/numbering.service.js";

export class OpportunityController {
  private parseId(
    id: string | undefined,
    res: Response,
    label: string,
    operation: string
  ): number | null {
    const parsed = parsePositiveInteger(id);
    if (parsed === null) {
      handleValidationError(res, `Invalid ${label}`, "id", operation);
      return null;
    }
    return parsed;
  }

  private pagination(
    req: Request,
    res: Response,
    operation: string
  ): { page: number; limit: number; skip: number } | null {
    const page =
      req.query.page === undefined
        ? 1
        : parseBoundedInteger(req.query.page, 1, 1_000_000);
    const limit =
      req.query.limit === undefined
        ? 10
        : parseBoundedInteger(req.query.limit, 1, 100);
    if (page === null || limit === null) {
      handleValidationError(
        res,
        "page must be positive and limit must be between 1 and 100",
        undefined,
        operation
      );
      return null;
    }
    return { page, limit, skip: (page - 1) * limit };
  }

  private quoteVersionLabel(version: number): string {
    let value = version;
    let label = "";
    while (value > 0) {
      value -= 1;
      label = String.fromCharCode(65 + (value % 26)) + label;
      value = Math.floor(value / 26);
    }
    return label;
  }

  async createOpportunity(req: Request, res: Response) {
    const operation = "Create opportunity";
    try {
      const userId = req.user!.id;

      if (
        !validateRequiredFields(req.body, ["name", "accountId"], res, operation)
      ) {
        return;
      }

      const {
        name,
        accountId,
        contactId,
        priceBookId,
        type,
        stage,
        amount,
        expectedCloseDate,
        leadSource,
        nextStep,
        description,
      } = req.body;

      if (
        typeof name !== "string" ||
        name.trim().length === 0 ||
        name.trim().length > 255
      ) {
        return handleValidationError(
          res,
          "Name is required and cannot exceed 255 characters",
          "name",
          operation
        );
      }

      const parsedAccountId = parsePositiveInteger(accountId);
      if (parsedAccountId === null) {
        return handleValidationError(
          res,
          "Invalid accountId",
          "accountId",
          operation
        );
      }

      const account = await prisma.account.findUnique({
        where: { id: parsedAccountId },
        select: { id: true },
      });
      if (!account) {
        return handleNotFoundError(res, "Account", operation);
      }

      let parsedContactId: number | null = null;
      if (contactId !== undefined && contactId !== null) {
        parsedContactId = parsePositiveInteger(contactId);
        if (parsedContactId === null) {
          return handleValidationError(
            res,
            "Invalid contactId",
            "contactId",
            operation
          );
        }
        const contact = await prisma.contact.findUnique({
          where: { id: parsedContactId },
          select: { id: true, accountId: true },
        });
        if (!contact) {
          return handleNotFoundError(res, "Contact", operation);
        }
        if (
          contact.accountId !== null &&
          contact.accountId !== parsedAccountId
        ) {
          return handleValidationError(
            res,
            "Contact does not belong to the selected account",
            "contactId",
            operation
          );
        }
      }

      let parsedPriceBookId: number | null = null;
      if (priceBookId !== undefined && priceBookId !== null) {
        parsedPriceBookId = parsePositiveInteger(priceBookId);
        if (parsedPriceBookId === null) {
          return handleValidationError(
            res,
            "Invalid priceBookId",
            "priceBookId",
            operation
          );
        }
        const priceBook = await prisma.priceBook.findUnique({
          where: { id: parsedPriceBookId },
          select: { id: true, isActive: true },
        });
        if (!priceBook) {
          return handleNotFoundError(res, "Price Book", operation);
        }
        if (!priceBook.isActive) {
          return handleValidationError(
            res,
            "Price Book must be active",
            "priceBookId",
            operation
          );
        }
      }

      const validStages = Object.values(OpportunityStage);
      if (stage && !validStages.includes(stage)) {
        return handleValidationError(
          res,
          `Invalid stage. Must be one of: ${validStages.join(", ")}`,
          "stage",
          operation
        );
      }

      const validTypes = Object.values(OpportunityType);
      if (type && !validTypes.includes(type)) {
        return handleValidationError(
          res,
          `Invalid type. Must be one of: ${validTypes.join(", ")}`,
          "type",
          operation
        );
      }

      let parsedAmount: string | undefined;
      if (amount !== undefined && amount !== null) {
        parsedAmount = parseNonNegativeDecimal(amount, 13, 2) ?? undefined;
        if (parsedAmount === undefined) {
          return handleValidationError(
            res,
            "Amount must be a non-negative number",
            "amount",
            operation
          );
        }
      }

      let parsedExpectedCloseDate: Date | null = null;
      if (expectedCloseDate) {
        const d = parseIsoDate(expectedCloseDate);
        if (!d) {
          return handleValidationError(
            res,
            "Invalid expectedCloseDate",
            "expectedCloseDate",
            operation
          );
        }
        parsedExpectedCloseDate = d;
      }

      const optionalTextFields: Array<[string, unknown, number]> = [
        ["description", description, 5_000],
        ["leadSource", leadSource, 255],
        ["nextStep", nextStep, 1_000],
      ];
      for (const [field, value, maximum] of optionalTextFields) {
        if (
          value !== undefined &&
          value !== null &&
          (typeof value !== "string" || value.trim().length > maximum)
        ) {
          return handleValidationError(
            res,
            `${field} must be text of at most ${maximum} characters`,
            field,
            operation
          );
        }
      }

      const opportunity = await prisma.$transaction(async tx => {
        const opportunityNumber = await nextDocumentNumber(
          tx,
          SEQUENCE_KEYS.SALES_OPPORTUNITY
        );
        const newOpportunity = await tx.opportunity.create({
          data: {
            opportunityNumber,
            name: name.trim(),
            description:
              typeof description === "string"
                ? description.trim() || null
                : null,
            type: type || null,
            stage: stage || undefined,
            amount: parsedAmount !== undefined ? parsedAmount : null,
            expectedCloseDate: parsedExpectedCloseDate,
            leadSource:
              typeof leadSource === "string" ? leadSource.trim() || null : null,
            nextStep:
              typeof nextStep === "string" ? nextStep.trim() || null : null,
            accountId: parsedAccountId,
            contactId: parsedContactId,
            priceBookId: parsedPriceBookId,
            ownerId: userId,
            createdBy: userId,
          },
        });

        await tx.opportunityActivity.create({
          data: {
            opportunityId: newOpportunity.id,
            userId,
            activityType: "CREATED",
            description: `Opportunity ${opportunityNumber} created`,
            newValue: opportunityNumber,
          },
        });

        return newOpportunity;
      });

      const fullOpportunity = await prisma.opportunity.findUnique({
        where: { id: opportunity.id },
        include: {
          account: { select: { id: true, name: true } },
          contact: { select: { id: true, name: true } },
          owner: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return res.status(201).json({ data: fullOpportunity });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return handleError(error, res, operation);
      }
      handleError(error, res, operation);
    }
  }

  async getAllOpportunities(req: Request, res: Response) {
    const operation = "Get all opportunities";
    try {
      const pagination = this.pagination(req, res, operation);
      if (!pagination) return;
      const { page, limit, skip } = pagination;

      const {
        stage,
        ownerId,
        accountId,
        createdFrom,
        createdTo,
        expectedCloseFrom,
        expectedCloseTo,
        amountMin,
        amountMax,
        sortBy,
        sortOrder,
      } = req.query;

      const whereClause: Prisma.OpportunityWhereInput = { deletedAt: null };

      if (stage) {
        if (typeof stage !== "string") {
          return handleValidationError(
            res,
            "Invalid stage",
            "stage",
            operation
          );
        }
        const stageArray = stage.split(",");
        if (
          stageArray.some(
            value =>
              !Object.values(OpportunityStage).includes(
                value as OpportunityStage
              )
          )
        ) {
          return handleValidationError(
            res,
            "Invalid stage",
            "stage",
            operation
          );
        }
        whereClause.stage =
          stageArray.length === 1
            ? (stageArray[0] as OpportunityStage)
            : { in: stageArray as OpportunityStage[] };
      }
      if (ownerId) {
        const parsed = parsePositiveInteger(ownerId);
        if (parsed === null) {
          return handleValidationError(
            res,
            "Invalid ownerId",
            "ownerId",
            operation
          );
        }
        whereClause.ownerId = parsed;
      }
      if (accountId) {
        const parsed = parsePositiveInteger(accountId);
        if (parsed === null) {
          return handleValidationError(
            res,
            "Invalid accountId",
            "accountId",
            operation
          );
        }
        whereClause.accountId = parsed;
      }
      if (createdFrom || createdTo) {
        const createdAtFilter: Prisma.DateTimeFilter = {};
        if (createdFrom) {
          const d = parseIsoDate(createdFrom);
          if (!d) {
            return handleValidationError(
              res,
              "Invalid createdFrom",
              "createdFrom",
              operation
            );
          }
          createdAtFilter.gte = d;
        }
        if (createdTo) {
          const d = parseIsoDate(createdTo);
          if (!d) {
            return handleValidationError(
              res,
              "Invalid createdTo",
              "createdTo",
              operation
            );
          }
          createdAtFilter.lte = d;
        }
        if (
          createdAtFilter.gte instanceof Date &&
          createdAtFilter.lte instanceof Date &&
          createdAtFilter.gte > createdAtFilter.lte
        ) {
          return handleValidationError(
            res,
            "createdFrom cannot be after createdTo",
            "createdFrom",
            operation
          );
        }
        whereClause.createdAt = createdAtFilter;
      }
      if (expectedCloseFrom || expectedCloseTo) {
        const expectedCloseFilter: Prisma.DateTimeNullableFilter = {};
        if (expectedCloseFrom) {
          const d = parseIsoDate(expectedCloseFrom);
          if (!d) {
            return handleValidationError(
              res,
              "Invalid expectedCloseFrom",
              "expectedCloseFrom",
              operation
            );
          }
          expectedCloseFilter.gte = d;
        }
        if (expectedCloseTo) {
          const d = parseIsoDate(expectedCloseTo);
          if (!d) {
            return handleValidationError(
              res,
              "Invalid expectedCloseTo",
              "expectedCloseTo",
              operation
            );
          }
          expectedCloseFilter.lte = d;
        }
        if (
          expectedCloseFilter.gte instanceof Date &&
          expectedCloseFilter.lte instanceof Date &&
          expectedCloseFilter.gte > expectedCloseFilter.lte
        ) {
          return handleValidationError(
            res,
            "expectedCloseFrom cannot be after expectedCloseTo",
            "expectedCloseFrom",
            operation
          );
        }
        whereClause.expectedCloseDate = expectedCloseFilter;
      }
      if (amountMin !== undefined || amountMax !== undefined) {
        const amountFilter: Prisma.DecimalNullableFilter = {};
        let minimum: string | null = null;
        let maximum: string | null = null;
        if (amountMin !== undefined) {
          minimum = parseNonNegativeDecimal(amountMin, 13, 2);
          if (minimum === null) {
            return handleValidationError(
              res,
              "Invalid amountMin",
              "amountMin",
              operation
            );
          }
          amountFilter.gte = minimum;
        }
        if (amountMax !== undefined) {
          maximum = parseNonNegativeDecimal(amountMax, 13, 2);
          if (maximum === null) {
            return handleValidationError(
              res,
              "Invalid amountMax",
              "amountMax",
              operation
            );
          }
          amountFilter.lte = maximum;
        }
        if (
          minimum !== null &&
          maximum !== null &&
          new Prisma.Decimal(minimum).greaterThan(new Prisma.Decimal(maximum))
        ) {
          return handleValidationError(
            res,
            "amountMin cannot exceed amountMax",
            "amountMin",
            operation
          );
        }
        whereClause.amount = amountFilter;
      }

      const allowedSortFields = [
        "createdAt",
        "name",
        "expectedCloseDate",
        "stage",
        "amount",
      ];
      if (
        sortBy !== undefined &&
        (typeof sortBy !== "string" || !allowedSortFields.includes(sortBy))
      ) {
        return handleValidationError(
          res,
          "Invalid sortBy",
          "sortBy",
          operation
        );
      }
      if (
        sortOrder !== undefined &&
        sortOrder !== "asc" &&
        sortOrder !== "desc"
      ) {
        return handleValidationError(
          res,
          "sortOrder must be asc or desc",
          "sortOrder",
          operation
        );
      }
      const orderField = typeof sortBy === "string" ? sortBy : "createdAt";
      const orderDirection = sortOrder === "asc" ? "asc" : "desc";

      const totalItems = await prisma.opportunity.count({ where: whereClause });

      const opportunities = await prisma.opportunity.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { [orderField]: orderDirection },
        select: {
          id: true,
          name: true,
          expectedCloseDate: true,
          stage: true,
          createdAt: true,
          owner: {
            select: { firstName: true, lastName: true },
          },
          account: {
            select: { name: true },
          },
        },
      });

      const data = opportunities.map(opp => ({
        id: opp.id,
        name: opp.name,
        accountName: opp.account.name,
        opportunityOwner: buildFullName(
          opp.owner.firstName,
          opp.owner.lastName
        ),
        closeDate: opp.expectedCloseDate,
        stage: opp.stage,
        createdAt: opp.createdAt,
      }));

      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return res.json({
        data,
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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return handleError(error, res, operation);
      }
      handleError(error, res, operation);
    }
  }

  async generateQuote(req: Request, res: Response) {
    const operation = "Generate quote from opportunity";
    try {
      const opportunityId = this.parseId(
        req.params.id,
        res,
        "Opportunity ID",
        operation
      );
      if (opportunityId === null) return;

      const userId = req.user!.id;
      const { validUntil, paymentTerms, deliveryTerms, notes, internalNotes } =
        req.body;

      const parsedValidUntil =
        validUntil === undefined || validUntil === null || validUntil === ""
          ? null
          : parseIsoDate(validUntil);
      if (
        validUntil !== undefined &&
        validUntil !== null &&
        !parsedValidUntil
      ) {
        return handleValidationError(
          res,
          "validUntil must be a valid ISO date",
          "validUntil",
          operation
        );
      }
      const quoteTextFields: Array<[string, unknown, number]> = [
        ["paymentTerms", paymentTerms, 2_000],
        ["deliveryTerms", deliveryTerms, 2_000],
        ["notes", notes, 5_000],
        ["internalNotes", internalNotes, 5_000],
      ];
      for (const [field, value, maximum] of quoteTextFields) {
        if (
          value !== undefined &&
          value !== null &&
          (typeof value !== "string" || value.trim().length > maximum)
        ) {
          return handleValidationError(
            res,
            `${field} must be text of at most ${maximum} characters`,
            field,
            operation
          );
        }
      }

      const opportunity = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        include: {
          lineItems: {
            orderBy: { sortOrder: "asc" },
            include: { product: true },
          },
          account: true,
          contact: true,
        },
      });

      if (!opportunity) {
        return handleNotFoundError(res, "Opportunity", operation);
      }

      if (opportunity.deletedAt) {
        return handleNotFoundError(res, "Opportunity", operation);
      }

      if (
        !["IN_PROGRESS", "APPROVED", "QUOTE_CREATED"].includes(
          opportunity.status
        )
      ) {
        return handleValidationError(
          res,
          `Opportunity must be approved or active before a quote can be generated. Current status: ${opportunity.status}`,
          "status",
          operation
        );
      }

      if (opportunity.lineItems.length === 0) {
        return res.status(400).json({
          error:
            "Opportunity has no line items. Add at least one line item before generating a quote.",
          code: "NO_LINE_ITEMS",
        });
      }

      let subtotal = new Prisma.Decimal(0);
      for (const item of opportunity.lineItems) {
        subtotal = subtotal.add(item.totalPrice);
      }

      const grandTotal = subtotal;

      const quote = await prisma.$transaction(async tx => {
        await tx.$queryRaw`
          SELECT "id" FROM "opportunities"
          WHERE "id" = ${opportunityId}
          FOR UPDATE
        `;
        const versionAggregate = await tx.quote.aggregate({
          where: { opportunityId },
          _max: { version: true },
        });
        const version = (versionAggregate._max.version ?? 0) + 1;
        const quoteBaseNumber = await nextDocumentNumber(
          tx,
          SEQUENCE_KEYS.SALES_QUOTE
        );
        const quoteNumber = `${quoteBaseNumber}-${this.quoteVersionLabel(version)}`;
        const isPrimary = version === 1;

        const newQuote = await tx.quote.create({
          data: {
            quoteNumber,
            name: `${opportunity.name} - Quote`,
            description: opportunity.description,
            status: "DRAFT",
            type: "QUOTE",
            version,
            isPrimary,
            subtotal,
            grandTotal,
            validUntil: parsedValidUntil,
            paymentTerms:
              typeof paymentTerms === "string"
                ? paymentTerms.trim() || null
                : null,
            deliveryTerms:
              typeof deliveryTerms === "string"
                ? deliveryTerms.trim() || null
                : null,
            notes: typeof notes === "string" ? notes.trim() || null : null,
            internalNotes:
              typeof internalNotes === "string"
                ? internalNotes.trim() || null
                : null,
            opportunityId: opportunity.id,
            accountId: opportunity.accountId,
            contactId: opportunity.contactId,
            preparedById: userId,
          },
        });

        for (const item of opportunity.lineItems) {
          await tx.quoteLineItem.create({
            data: {
              quoteId: newQuote.id,
              productId: item.productId,
              priceBookEntryId: item.priceBookEntryId,
              quantity: item.quantity,
              listPrice: item.listPrice,
              unitPrice: item.unitPrice,
              discount: item.discount,
              totalPrice: item.totalPrice,
              description: item.description,
              sortOrder: item.sortOrder,
            },
          });
        }

        await tx.opportunityActivity.create({
          data: {
            opportunityId: opportunity.id,
            userId,
            activityType: "QUOTE_GENERATED",
            description: `Quote ${quoteNumber} generated`,
            newValue: quoteNumber,
          },
        });

        await tx.opportunity.update({
          where: { id: opportunityId },
          data: { status: "QUOTE_CREATED" },
        });

        return newQuote;
      });

      const fullQuote = await prisma.quote.findUnique({
        where: { id: quote.id },
        include: {
          lineItems: {
            orderBy: { sortOrder: "asc" },
            include: {
              product: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          account: { select: { id: true, name: true } },
          contact: { select: { id: true, name: true, email: true } },
          preparedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return res.status(201).json({ data: fullQuote });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return handleError(error, res, operation);
      }
      handleError(error, res, operation);
    }
  }

  async updateOpportunity(req: Request, res: Response) {
    const operation = "Update opportunity";
    try {
      const opportunityId = this.parseId(
        req.params.opportunityId,
        res,
        "Opportunity ID",
        operation
      );
      if (opportunityId === null) return;

      const userId = req.user!.id;

      const existing = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
      });
      if (!existing || existing.deletedAt) {
        return handleNotFoundError(res, "Opportunity", operation);
      }

      const {
        name,
        expectedCloseDate,
        nextStep,
        type,
        stage,
        leadSource,
        priceBookId,
      } = req.body;

      if (
        name === undefined &&
        expectedCloseDate === undefined &&
        nextStep === undefined &&
        type === undefined &&
        stage === undefined &&
        leadSource === undefined &&
        priceBookId === undefined
      ) {
        return handleValidationError(
          res,
          "At least one field must be provided: name, expectedCloseDate, nextStep, type, stage, leadSource, priceBookId",
          "body",
          operation
        );
      }

      const updateData: Prisma.OpportunityUpdateInput = {};
      const activities: {
        field: string;
        oldValue: string | null;
        newValue: string | null;
      }[] = [];
      let deleteLineItems = false;

      if (name !== undefined) {
        if (
          typeof name !== "string" ||
          name.trim().length === 0 ||
          name.trim().length > 255
        ) {
          return handleValidationError(
            res,
            "Name cannot be empty or exceed 255 characters",
            "name",
            operation
          );
        }
        if (name.trim() !== existing.name) {
          activities.push({
            field: "name",
            oldValue: existing.name,
            newValue: name.trim(),
          });
          updateData.name = name.trim();
        }
      }

      if (expectedCloseDate !== undefined) {
        if (expectedCloseDate === null) {
          if (existing.expectedCloseDate !== null) {
            activities.push({
              field: "expectedCloseDate",
              oldValue: existing.expectedCloseDate?.toISOString() ?? null,
              newValue: null,
            });
            updateData.expectedCloseDate = null;
          }
        } else {
          const d = parseIsoDate(expectedCloseDate);
          if (!d) {
            return handleValidationError(
              res,
              "Invalid expectedCloseDate",
              "expectedCloseDate",
              operation
            );
          }
          activities.push({
            field: "expectedCloseDate",
            oldValue: existing.expectedCloseDate?.toISOString() ?? null,
            newValue: d.toISOString(),
          });
          updateData.expectedCloseDate = d;
        }
      }

      if (nextStep !== undefined) {
        if (
          nextStep !== null &&
          (typeof nextStep !== "string" || nextStep.trim().length > 1_000)
        ) {
          return handleValidationError(
            res,
            "nextStep must be text of at most 1000 characters",
            "nextStep",
            operation
          );
        }
        const newVal =
          typeof nextStep === "string" ? nextStep.trim() || null : null;
        if (newVal !== existing.nextStep) {
          activities.push({
            field: "nextStep",
            oldValue: existing.nextStep,
            newValue: newVal,
          });
          updateData.nextStep = newVal;
        }
      }

      if (type !== undefined) {
        if (type === null) {
          if (existing.type !== null) {
            activities.push({
              field: "type",
              oldValue: existing.type,
              newValue: null,
            });
            updateData.type = null;
          }
        } else {
          const validTypes = Object.values(OpportunityType);
          if (!validTypes.includes(type)) {
            return handleValidationError(
              res,
              `Invalid type. Must be one of: ${validTypes.join(", ")}`,
              "type",
              operation
            );
          }
          if (type !== existing.type) {
            activities.push({
              field: "type",
              oldValue: existing.type,
              newValue: type,
            });
            updateData.type = type;
          }
        }
      }

      if (stage !== undefined) {
        const validStages = Object.values(OpportunityStage);
        if (!validStages.includes(stage)) {
          return handleValidationError(
            res,
            `Invalid stage. Must be one of: ${validStages.join(", ")}`,
            "stage",
            operation
          );
        }
        if (stage !== existing.stage) {
          activities.push({
            field: "stage",
            oldValue: existing.stage,
            newValue: stage,
          });
          updateData.stage = stage;
        }
      }

      if (leadSource !== undefined) {
        if (
          leadSource !== null &&
          (typeof leadSource !== "string" || leadSource.trim().length > 255)
        ) {
          return handleValidationError(
            res,
            "leadSource must be text of at most 255 characters",
            "leadSource",
            operation
          );
        }
        const newVal =
          typeof leadSource === "string" ? leadSource.trim() || null : null;
        if (newVal !== existing.leadSource) {
          activities.push({
            field: "leadSource",
            oldValue: existing.leadSource,
            newValue: newVal,
          });
          updateData.leadSource = newVal;
        }
      }

      if (priceBookId !== undefined) {
        if (priceBookId === null) {
          if (existing.priceBookId !== null) {
            activities.push({
              field: "priceBookId",
              oldValue: String(existing.priceBookId),
              newValue: null,
            });
            updateData.priceBook = { disconnect: true };
          }
        } else {
          const parsedPriceBookId = parsePositiveInteger(priceBookId);
          if (parsedPriceBookId === null) {
            return handleValidationError(
              res,
              "Invalid priceBookId",
              "priceBookId",
              operation
            );
          }
          const priceBook = await prisma.priceBook.findUnique({
            where: { id: parsedPriceBookId },
            select: { id: true, isActive: true },
          });
          if (!priceBook) {
            return handleNotFoundError(res, "Price Book", operation);
          }
          if (!priceBook.isActive) {
            return handleValidationError(
              res,
              "Price Book must be active",
              "priceBookId",
              operation
            );
          }
          if (parsedPriceBookId !== existing.priceBookId) {
            deleteLineItems = true;
            activities.push({
              field: "priceBookId",
              oldValue: String(existing.priceBookId ?? ""),
              newValue: String(parsedPriceBookId),
            });
            updateData.priceBook = { connect: { id: parsedPriceBookId } };
          }
        }
      }

      if (Object.keys(updateData).length === 0) {
        const fullOpportunity = await prisma.opportunity.findUnique({
          where: { id: opportunityId },
          include: {
            account: { select: { id: true, name: true } },
            contact: { select: { id: true, name: true } },
            owner: { select: { id: true, firstName: true, lastName: true } },
          },
        });
        return res.json({ data: fullOpportunity });
      }

      await prisma.$transaction(async tx => {
        if (deleteLineItems) {
          await tx.opportunityLineItem.deleteMany({ where: { opportunityId } });
        }

        await tx.opportunity.update({
          where: { id: opportunityId },
          data: updateData,
        });

        for (const activity of activities) {
          await tx.opportunityActivity.create({
            data: {
              opportunityId,
              userId,
              activityType: "FIELD_UPDATED",
              description: `Updated ${activity.field}`,
              oldValue: activity.oldValue,
              newValue: activity.newValue,
            },
          });
        }
      });

      const fullOpportunity = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        include: {
          account: { select: { id: true, name: true } },
          contact: { select: { id: true, name: true } },
          owner: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return res.json({ data: fullOpportunity });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return handleError(error, res, operation);
      }
      handleError(error, res, operation);
    }
  }

  async submitOpportunityForApproval(req: Request, res: Response) {
    const operation = "Submit opportunity for approval";
    try {
      const opportunityId = this.parseId(
        req.params.id,
        res,
        "Opportunity ID",
        operation
      );
      if (opportunityId === null) return;

      const userId = req.user!.id;
      const { requestedToId } = req.body;

      const opportunity = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        include: {
          lineItems: { select: { discount: true } },
          creator: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      if (!opportunity || opportunity.deletedAt) {
        return handleNotFoundError(res, "Opportunity", operation);
      }

      if (!["DRAFT", "REJECTED"].includes(opportunity.status)) {
        return handleValidationError(
          res,
          `Only DRAFT or REJECTED opportunities can be submitted. Current status: ${opportunity.status}`,
          "status",
          operation
        );
      }

      if (opportunity.lineItems.length === 0) {
        return handleValidationError(
          res,
          "Add at least one line item before submitting",
          "lineItems",
          operation
        );
      }

      const thresholdSetting = await prisma.globalSetting.findUnique({
        where: { key: "OPPORTUNITY_DISCOUNT_THRESHOLD" },
      });
      const thresholdText = thresholdSetting?.value ?? "0";
      const thresholdParsed = parseNonNegativeDecimal(thresholdText, 3, 4);
      if (
        thresholdParsed === null ||
        new Prisma.Decimal(thresholdParsed).greaterThan(100)
      ) {
        throw new Error(
          "OPPORTUNITY_DISCOUNT_THRESHOLD must be a decimal between 0 and 100"
        );
      }
      const threshold = Number(thresholdParsed);

      const maxDiscount = opportunity.lineItems.reduce((max, item) => {
        const d = parseFloat(item.discount.toString());
        return d > max ? d : max;
      }, 0);

      const requiresApproval = maxDiscount > threshold;

      if (requiresApproval) {
        if (requestedToId === undefined || requestedToId === null) {
          return handleValidationError(
            res,
            "requestedToId is required because the opportunity discount exceeds the approval threshold",
            "requestedToId",
            operation
          );
        }

        const parsedRequestedToId = parsePositiveInteger(requestedToId);
        if (parsedRequestedToId === null) {
          return handleValidationError(
            res,
            "Invalid requestedToId",
            "requestedToId",
            operation
          );
        }
        if (parsedRequestedToId === userId) {
          return handleValidationError(
            res,
            "An approval request must be assigned to a different user",
            "requestedToId",
            operation
          );
        }

        const approver = await prisma.user.findUnique({
          where: { id: parsedRequestedToId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            permissions: true,
            deletedAt: true,
          },
        });
        if (!approver) {
          return handleNotFoundError(res, "Approver user", operation);
        }
        if (
          approver.deletedAt !== null ||
          !roleHasPermission(
            approver.role,
            approver.permissions,
            "approvals.act"
          )
        ) {
          return handleValidationError(
            res,
            "Approver must be active and have approval permission",
            "requestedToId",
            operation
          );
        }

        const existing = await prisma.approvalProcess.findFirst({
          where: {
            targetObjectName: "OPP",
            targetRecordId: opportunityId,
            status: "PENDING",
          },
        });
        if (existing) {
          return res.status(409).json({
            error: "A pending approval already exists for this opportunity",
            code: "APPROVAL_EXISTS",
            approvalId: existing.id,
          });
        }

        const approval = await prisma.$transaction(async tx => {
          const newApproval = await tx.approvalProcess.create({
            data: {
              targetObjectName: "OPP",
              targetRecordId: opportunityId,
              requestedToId: parsedRequestedToId,
              createdById: userId,
            },
            include: {
              requestedTo: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              createdBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          });

          await tx.opportunityActivity.create({
            data: {
              opportunityId,
              userId,
              activityType: "SUBMITTED_FOR_APPROVAL",
              description: `Submitted for approval to ${buildFullName(approver.firstName, approver.lastName)} (max discount: ${maxDiscount}% > threshold: ${threshold}%)`,
              newValue: "SUBMITTED",
            },
          });

          await tx.opportunity.update({
            where: { id: opportunityId },
            data: { status: "SUBMITTED" },
          });

          return newApproval;
        });

        const requester = await prisma.user.findUnique({
          where: { id: userId },
        });
        emailService
          .sendApprovalRequestEmail({
            approverName: buildFullName(approver.firstName, approver.lastName),
            approverEmail: approver.email,
            requesterName: buildFullName(
              requester?.firstName ?? null,
              requester?.lastName ?? null
            ),
            objectType: "Opportunity",
            objectName: opportunity.name,
            objectNumber: opportunity.opportunityNumber,
            approvalId: approval.id,
          })
          .catch(err => logError("opportunity_approval_email_failed", err));

        const fullOpportunity = await prisma.opportunity.findUnique({
          where: { id: opportunityId },
          include: {
            account: { select: { id: true, name: true } },
            contact: { select: { id: true, name: true } },
            owner: { select: { id: true, firstName: true, lastName: true } },
          },
        });

        return res.json({
          data: fullOpportunity,
          approval,
          requiresApproval: true,
          message: `Approval request created. Max discount ${maxDiscount}% exceeds threshold ${threshold}%.`,
        });
      } else {
        await prisma.$transaction(async tx => {
          await tx.opportunity.update({
            where: { id: opportunityId },
            data: { status: "IN_PROGRESS" },
          });
          await tx.opportunityActivity.create({
            data: {
              opportunityId,
              userId,
              activityType: "SUBMITTED",
              description: `Submitted and auto-approved (discount ${maxDiscount}% within threshold ${threshold}%)`,
              newValue: "IN_PROGRESS",
            },
          });
        });

        const fullOpportunity = await prisma.opportunity.findUnique({
          where: { id: opportunityId },
          include: {
            account: { select: { id: true, name: true } },
            contact: { select: { id: true, name: true } },
            owner: { select: { id: true, firstName: true, lastName: true } },
          },
        });

        return res.json({
          data: fullOpportunity,
          requiresApproval: false,
          message: `Opportunity activated. Discount ${maxDiscount}% is within the ${threshold}% threshold.`,
        });
      }
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  async getOpportunityById(req: Request, res: Response) {
    const operation = "Get opportunity details";
    try {
      const opportunityId = this.parseId(
        req.params.opportunityId,
        res,
        "Opportunity ID",
        operation
      );
      if (opportunityId === null) return;

      const opportunity = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        include: {
          account: { select: { id: true, name: true } },
          contact: {
            select: { id: true, name: true, email: true, phone: true },
          },
          priceBook: { select: { id: true, name: true } },
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          creator: { select: { id: true, firstName: true, lastName: true } },
          lineItems: {
            orderBy: { sortOrder: "asc" },
            include: {
              product: { select: { id: true, name: true, code: true } },
            },
          },
          activities: {
            orderBy: { createdAt: "desc" },
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          quotes: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              quoteNumber: true,
              name: true,
              status: true,
              grandTotal: true,
              createdAt: true,
            },
          },
        },
      });

      if (!opportunity || opportunity.deletedAt) {
        return handleNotFoundError(res, "Opportunity", operation);
      }

      return res.json({ data: opportunity });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return handleError(error, res, operation);
      }
      handleError(error, res, operation);
    }
  }

  async deleteOpportunity(req: Request, res: Response) {
    const operation = "Delete opportunity";
    try {
      const opportunityId = this.parseId(
        req.params.opportunityId,
        res,
        "Opportunity ID",
        operation
      );
      if (opportunityId === null) return;

      const existing = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
      });
      if (!existing || existing.deletedAt) {
        return handleNotFoundError(res, "Opportunity", operation);
      }

      await prisma.opportunity.update({
        where: { id: opportunityId },
        data: { deletedAt: new Date() },
      });

      return res.status(204).send();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return handleError(error, res, operation);
      }
      handleError(error, res, operation);
    }
  }

  async getOpportunityLineItems(req: Request, res: Response) {
    const operation = "Get opportunity line items";
    try {
      const opportunityId = this.parseId(
        req.params.opportunityId,
        res,
        "Opportunity ID",
        operation
      );
      if (opportunityId === null) return;

      const opportunity = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        select: { id: true, deletedAt: true },
      });
      if (!opportunity || opportunity.deletedAt) {
        return handleNotFoundError(res, "Opportunity", operation);
      }

      const lineItems = await prisma.opportunityLineItem.findMany({
        where: { opportunityId },
        orderBy: { sortOrder: "asc" },
        include: {
          product: { select: { id: true, name: true, code: true } },
        },
      });

      return res.json({ data: lineItems });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return handleError(error, res, operation);
      }
      handleError(error, res, operation);
    }
  }

  async addOpportunityLineItem(req: Request, res: Response) {
    const operation = "Add opportunity line item";
    try {
      const opportunityId = this.parseId(
        req.params.opportunityId,
        res,
        "Opportunity ID",
        operation
      );
      if (opportunityId === null) return;

      const opportunity = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        select: { id: true, deletedAt: true, priceBookId: true, status: true },
      });
      if (!opportunity || opportunity.deletedAt) {
        return handleNotFoundError(res, "Opportunity", operation);
      }
      if (!["DRAFT", "REJECTED"].includes(opportunity.status)) {
        return handleValidationError(
          res,
          "Line items are locked after an opportunity is submitted",
          "status",
          operation
        );
      }

      if (!validateRequiredFields(req.body, ["productId"], res, operation)) {
        return;
      }

      const {
        productId,
        quantity: quantityParam,
        priceBookEntryId,
        listPrice: listPriceParam,
        discount: discountParam,
        description,
      } = req.body;

      const parsedProductId = parsePositiveInteger(productId);
      if (parsedProductId === null) {
        return handleValidationError(
          res,
          "Invalid productId",
          "productId",
          operation
        );
      }

      const product = await prisma.product.findUnique({
        where: { id: parsedProductId },
        select: { id: true, active: true, isSellable: true },
      });
      if (!product) {
        return handleNotFoundError(res, "Product", operation);
      }
      if (!product.active || !product.isSellable) {
        return handleValidationError(
          res,
          "Product must be active and sellable",
          "productId",
          operation
        );
      }

      let listPrice: Prisma.Decimal;
      let parsedPriceBookEntryId: number | null = null;

      if (priceBookEntryId !== undefined && priceBookEntryId !== null) {
        parsedPriceBookEntryId = parsePositiveInteger(priceBookEntryId);
        if (parsedPriceBookEntryId === null) {
          return handleValidationError(
            res,
            "Invalid priceBookEntryId",
            "priceBookEntryId",
            operation
          );
        }
        const priceBookEntry = await prisma.priceBookEntry.findUnique({
          where: { id: parsedPriceBookEntryId },
          select: {
            id: true,
            productId: true,
            listPrice: true,
            priceBookId: true,
            isActive: true,
            priceBook: { select: { isActive: true } },
          },
        });
        if (!priceBookEntry) {
          return handleNotFoundError(res, "Price book entry", operation);
        }
        if (!priceBookEntry.isActive || !priceBookEntry.priceBook.isActive) {
          return handleValidationError(
            res,
            "Price book entry must be active",
            "priceBookEntryId",
            operation
          );
        }
        if (priceBookEntry.productId !== parsedProductId) {
          return handleValidationError(
            res,
            "Price book entry does not match product",
            "priceBookEntryId",
            operation
          );
        }
        if (
          opportunity.priceBookId &&
          priceBookEntry.priceBookId !== opportunity.priceBookId
        ) {
          return handleValidationError(
            res,
            "Price book entry does not belong to opportunity price book",
            "priceBookEntryId",
            operation
          );
        }
        listPrice = priceBookEntry.listPrice;
      } else {
        if (opportunity.priceBookId !== null) {
          return handleValidationError(
            res,
            "priceBookEntryId is required for the opportunity price book",
            "priceBookEntryId",
            operation
          );
        }
        if (listPriceParam === undefined || listPriceParam === null) {
          return handleValidationError(
            res,
            "listPrice is required when priceBookEntryId is not provided",
            "listPrice",
            operation
          );
        }
        const parsedListPrice = parseNonNegativeDecimal(listPriceParam, 13, 2);
        if (parsedListPrice === null) {
          return handleValidationError(
            res,
            "listPrice must be a non-negative number",
            "listPrice",
            operation
          );
        }
        listPrice = new Prisma.Decimal(parsedListPrice);
      }

      const quantity =
        quantityParam !== undefined && quantityParam !== null
          ? parseBoundedInteger(quantityParam, 1, 1_000_000)
          : 1;
      if (quantity === null) {
        return handleValidationError(
          res,
          "quantity must be a positive integer",
          "quantity",
          operation
        );
      }

      const discountText =
        discountParam !== undefined && discountParam !== null
          ? parseNonNegativeDecimal(discountParam, 3, 2)
          : "0";
      if (
        discountText === null ||
        new Prisma.Decimal(discountText).greaterThan(100)
      ) {
        return handleValidationError(
          res,
          "discount must be a number between 0 and 100",
          "discount",
          operation
        );
      }
      const discount = new Prisma.Decimal(discountText);

      const unitPrice = listPrice
        .mul(new Prisma.Decimal(100).minus(discount))
        .div(100)
        .toDecimalPlaces(2);
      const totalPrice = unitPrice.mul(quantity).toDecimalPlaces(2);

      if (
        description !== undefined &&
        description !== null &&
        (typeof description !== "string" || description.trim().length > 2_000)
      ) {
        return handleValidationError(
          res,
          "description must be text of at most 2000 characters",
          "description",
          operation
        );
      }

      const lastItem = await prisma.opportunityLineItem.findFirst({
        where: { opportunityId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      const sortOrder = (lastItem?.sortOrder ?? 0) + 1;

      const lineItem = await prisma.$transaction(async tx => {
        const created = await tx.opportunityLineItem.create({
          data: {
            opportunityId,
            productId: parsedProductId,
            priceBookEntryId: parsedPriceBookEntryId,
            quantity,
            listPrice,
            unitPrice,
            discount,
            totalPrice,
            description:
              description && typeof description === "string"
                ? description.trim() || null
                : null,
            sortOrder,
          },
          include: {
            product: { select: { id: true, name: true, code: true } },
          },
        });

        const lineItemsSum = await tx.opportunityLineItem.aggregate({
          where: { opportunityId },
          _sum: { totalPrice: true },
        });
        const newAmount = lineItemsSum._sum.totalPrice ?? 0;
        await tx.opportunity.update({
          where: { id: opportunityId },
          data: { amount: newAmount },
        });

        return created;
      });

      return res.status(201).json({ data: lineItem });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return handleError(error, res, operation);
      }
      handleError(error, res, operation);
    }
  }

  async updateOpportunityLineItem(req: Request, res: Response) {
    const operation = "Update opportunity line item";
    try {
      const opportunityId = this.parseId(
        req.params.opportunityId,
        res,
        "Opportunity ID",
        operation
      );
      if (opportunityId === null) return;

      const lineItemId = this.parseId(
        req.params.lineItemId,
        res,
        "Line item ID",
        operation
      );
      if (lineItemId === null) return;

      const opportunity = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        select: { id: true, deletedAt: true, status: true },
      });
      if (!opportunity || opportunity.deletedAt) {
        return handleNotFoundError(res, "Opportunity", operation);
      }
      if (!["DRAFT", "REJECTED"].includes(opportunity.status)) {
        return handleValidationError(
          res,
          "Line items are locked after an opportunity is submitted",
          "status",
          operation
        );
      }

      const existing = await prisma.opportunityLineItem.findFirst({
        where: { id: lineItemId, opportunityId },
      });
      if (!existing) {
        return handleNotFoundError(res, "Line item", operation);
      }

      const {
        quantity: quantityParam,
        listPrice: listPriceParam,
        discount: discountParam,
        description,
        sortOrder: sortOrderParam,
      } = req.body;

      const hasAnyField =
        quantityParam !== undefined ||
        listPriceParam !== undefined ||
        discountParam !== undefined ||
        description !== undefined ||
        sortOrderParam !== undefined;

      if (!hasAnyField) {
        return handleValidationError(
          res,
          "At least one field must be provided: quantity, listPrice, discount, description, sortOrder",
          "body",
          operation
        );
      }

      const quantity =
        quantityParam !== undefined && quantityParam !== null
          ? parseBoundedInteger(quantityParam, 1, 1_000_000)
          : existing.quantity;
      if (quantity === null) {
        return handleValidationError(
          res,
          "quantity must be a positive integer",
          "quantity",
          operation
        );
      }

      if (existing.priceBookEntryId !== null && listPriceParam !== undefined) {
        return handleValidationError(
          res,
          "listPrice is controlled by the selected price book entry",
          "listPrice",
          operation
        );
      }
      const parsedListPrice =
        listPriceParam !== undefined && listPriceParam !== null
          ? parseNonNegativeDecimal(listPriceParam, 13, 2)
          : existing.listPrice.toString();
      if (parsedListPrice === null) {
        return handleValidationError(
          res,
          "listPrice must be a non-negative number",
          "listPrice",
          operation
        );
      }
      let listPrice = new Prisma.Decimal(parsedListPrice);
      if (existing.priceBookEntryId !== null) {
        const currentEntry = await prisma.priceBookEntry.findUnique({
          where: { id: existing.priceBookEntryId },
          select: {
            listPrice: true,
            isActive: true,
            priceBook: { select: { isActive: true } },
          },
        });
        if (
          !currentEntry ||
          !currentEntry.isActive ||
          !currentEntry.priceBook.isActive
        ) {
          return handleValidationError(
            res,
            "The selected price book entry is no longer active",
            "priceBookEntryId",
            operation
          );
        }
        listPrice = currentEntry.listPrice;
      }

      const discountText =
        discountParam !== undefined && discountParam !== null
          ? parseNonNegativeDecimal(discountParam, 3, 2)
          : existing.discount.toString();
      if (
        discountText === null ||
        new Prisma.Decimal(discountText).greaterThan(100)
      ) {
        return handleValidationError(
          res,
          "discount must be a number between 0 and 100",
          "discount",
          operation
        );
      }
      const discount = new Prisma.Decimal(discountText);

      const unitPrice = listPrice
        .mul(new Prisma.Decimal(100).minus(discount))
        .div(100)
        .toDecimalPlaces(2);
      const totalPrice = unitPrice.mul(quantity).toDecimalPlaces(2);

      const updateData: Prisma.OpportunityLineItemUpdateInput = {
        quantity,
        listPrice,
        unitPrice,
        discount,
        totalPrice,
      };
      if (description !== undefined) {
        if (
          description !== null &&
          (typeof description !== "string" || description.trim().length > 2_000)
        ) {
          return handleValidationError(
            res,
            "description must be text of at most 2000 characters",
            "description",
            operation
          );
        }
        updateData.description =
          description && typeof description === "string"
            ? description.trim() || null
            : null;
      }
      if (sortOrderParam !== undefined && sortOrderParam !== null) {
        const sortOrder = parseBoundedInteger(sortOrderParam, 0, 1_000_000);
        if (sortOrder === null) {
          return handleValidationError(
            res,
            "sortOrder must be a non-negative integer",
            "sortOrder",
            operation
          );
        }
        updateData.sortOrder = sortOrder;
      }

      const lineItem = await prisma.$transaction(async tx => {
        const updated = await tx.opportunityLineItem.update({
          where: { id: lineItemId },
          data: updateData,
          include: {
            product: { select: { id: true, name: true, code: true } },
          },
        });

        const lineItemsSum = await tx.opportunityLineItem.aggregate({
          where: { opportunityId },
          _sum: { totalPrice: true },
        });
        const newAmount = lineItemsSum._sum.totalPrice ?? 0;
        await tx.opportunity.update({
          where: { id: opportunityId },
          data: { amount: newAmount },
        });

        return updated;
      });

      return res.json({ data: lineItem });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return handleError(error, res, operation);
      }
      handleError(error, res, operation);
    }
  }

  async getOpportunityQuotes(req: Request, res: Response) {
    const operation = "Get opportunity quotes";
    try {
      const opportunityId = this.parseId(
        req.params.opportunityId,
        res,
        "Opportunity ID",
        operation
      );
      if (opportunityId === null) return;

      const opportunity = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        select: { id: true, deletedAt: true },
      });
      if (!opportunity || opportunity.deletedAt) {
        return handleNotFoundError(res, "Opportunity", operation);
      }

      const pagination = this.pagination(req, res, operation);
      if (!pagination) return;
      const { page, limit, skip } = pagination;

      const totalItems = await prisma.quote.count({ where: { opportunityId } });

      const quotes = await prisma.quote.findMany({
        where: { opportunityId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          quoteNumber: true,
          name: true,
          status: true,
          type: true,
          version: true,
          isPrimary: true,
          grandTotal: true,
          createdAt: true,
        },
      });

      const totalPages = Math.ceil(totalItems / limit);

      return res.json({
        data: quotes,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return handleError(error, res, operation);
      }
      handleError(error, res, operation);
    }
  }

  async deleteOpportunityLineItem(req: Request, res: Response) {
    const operation = "Delete opportunity line item";
    try {
      const opportunityId = this.parseId(
        req.params.opportunityId,
        res,
        "Opportunity ID",
        operation
      );
      if (opportunityId === null) return;

      const lineItemId = this.parseId(
        req.params.lineItemId,
        res,
        "Line item ID",
        operation
      );
      if (lineItemId === null) return;

      const opportunity = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        select: { id: true, deletedAt: true, status: true },
      });
      if (!opportunity || opportunity.deletedAt) {
        return handleNotFoundError(res, "Opportunity", operation);
      }
      if (!["DRAFT", "REJECTED"].includes(opportunity.status)) {
        return handleValidationError(
          res,
          "Line items are locked after an opportunity is submitted",
          "status",
          operation
        );
      }

      const existing = await prisma.opportunityLineItem.findFirst({
        where: { id: lineItemId, opportunityId },
      });
      if (!existing) {
        return handleNotFoundError(res, "Line item", operation);
      }

      await prisma.$transaction(async tx => {
        await tx.opportunityLineItem.delete({
          where: { id: lineItemId },
        });

        const lineItemsSum = await tx.opportunityLineItem.aggregate({
          where: { opportunityId },
          _sum: { totalPrice: true },
        });
        const newAmount = lineItemsSum._sum.totalPrice ?? 0;
        await tx.opportunity.update({
          where: { id: opportunityId },
          data: { amount: newAmount },
        });
      });

      return res.status(204).send();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return handleError(error, res, operation);
      }
      handleError(error, res, operation);
    }
  }
}
