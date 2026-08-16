import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { Prisma, OpportunityStage, UserRole } from "@prisma/client";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  validateRequiredFields,
} from "../utils/errorHandler.js";
import { buildFullName } from "../utils/nameHelpers.js";
import { OpportunityType } from "@prisma/client";
import { emailService } from "../services/email.service.js";

export class OpportunityController {
  private parseId(
    id: string | undefined,
    res: Response,
    label: string,
    operation: string
  ): number | null {
    if (!id) {
      handleValidationError(res, `${label} is required`, "id", operation);
      return null;
    }
    const parsed = parseInt(id, 10);
    if (isNaN(parsed)) {
      handleValidationError(res, `Invalid ${label}`, "id", operation);
      return null;
    }
    return parsed;
  }

  /**
   * Generate opportunity number: OPP-YYMM-XXXX
   */
  private async generateOpportunityNumber(): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `OPP-${yy}${mm}-`;

    const lastOpportunity = await prisma.opportunity.findFirst({
      where: { opportunityNumber: { startsWith: prefix } },
      orderBy: { opportunityNumber: "desc" },
      select: { opportunityNumber: true },
    });

    let sequenceNum = 1;
    if (lastOpportunity && lastOpportunity.opportunityNumber) {
      const parts = lastOpportunity.opportunityNumber.split("-");
      // parts: ["OPP", "YYMM", "XXXX"]
      if (parts.length >= 3 && parts[2]) {
        const num = parseInt(parts[2], 10);
        if (!isNaN(num)) {
          sequenceNum = num + 1;
        }
      }
    }

    return `${prefix}${String(sequenceNum).padStart(4, "0")}`;
  }

  /**
   * POST /api/opportunities
   * Create a new opportunity
   */
  async createOpportunity(req: Request, res: Response) {
    const operation = "Create opportunity";
    try {
      const userId = req.user!.id;

      // Validate required fields
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

      // Validate accountId is a number
      const parsedAccountId = parseInt(accountId, 10);
      if (isNaN(parsedAccountId)) {
        return handleValidationError(
          res,
          "Invalid accountId",
          "accountId",
          operation
        );
      }

      // Validate account exists
      const account = await prisma.account.findUnique({
        where: { id: parsedAccountId },
      });
      if (!account) {
        return handleNotFoundError(res, "Account", operation);
      }

      // Validate contactId if provided
      let parsedContactId: number | null = null;
      if (contactId !== undefined && contactId !== null) {
        parsedContactId = parseInt(contactId, 10);
        if (isNaN(parsedContactId)) {
          return handleValidationError(
            res,
            "Invalid contactId",
            "contactId",
            operation
          );
        }
        const contact = await prisma.contact.findUnique({
          where: { id: parsedContactId },
        });
        if (!contact) {
          return handleNotFoundError(res, "Contact", operation);
        }
      }

      // Validate priceBookId if provided
      let parsedPriceBookId: number | null = null;
      if (priceBookId !== undefined && priceBookId !== null) {
        parsedPriceBookId = parseInt(priceBookId, 10);
        if (isNaN(parsedPriceBookId)) {
          return handleValidationError(
            res,
            "Invalid priceBookId",
            "priceBookId",
            operation
          );
        }
        const priceBook = await prisma.priceBook.findUnique({
          where: { id: parsedPriceBookId },
        });
        if (!priceBook) {
          return handleNotFoundError(res, "Price Book", operation);
        }
      }

      // Validate stage if provided
      const validStages = Object.values(OpportunityStage);
      if (stage && !validStages.includes(stage)) {
        return handleValidationError(
          res,
          `Invalid stage. Must be one of: ${validStages.join(", ")}`,
          "stage",
          operation
        );
      }

      // Validate type if provided
      const validTypes = Object.values(OpportunityType);
      if (type && !validTypes.includes(type)) {
        return handleValidationError(
          res,
          `Invalid type. Must be one of: ${validTypes.join(", ")}`,
          "type",
          operation
        );
      }

      // Validate amount if provided
      let parsedAmount: number | undefined;
      if (amount !== undefined && amount !== null) {
        parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount < 0) {
          return handleValidationError(
            res,
            "Amount must be a non-negative number",
            "amount",
            operation
          );
        }
      }

      // Validate expectedCloseDate if provided
      let parsedExpectedCloseDate: Date | null = null;
      if (expectedCloseDate) {
        const d = new Date(expectedCloseDate);
        if (isNaN(d.getTime())) {
          return handleValidationError(
            res,
            "Invalid expectedCloseDate",
            "expectedCloseDate",
            operation
          );
        }
        parsedExpectedCloseDate = d;
      }

      // Generate opportunity number
      const opportunityNumber = await this.generateOpportunityNumber();

      // Create opportunity and log activity in a transaction
      const opportunity = await prisma.$transaction(async tx => {
        const newOpportunity = await tx.opportunity.create({
          data: {
            opportunityNumber,
            name: name.trim(),
            description: description || null,
            type: type || null,
            stage: stage || undefined,
            amount: parsedAmount !== undefined ? parsedAmount : null,
            expectedCloseDate: parsedExpectedCloseDate,
            leadSource: leadSource || null,
            nextStep: nextStep || null,
            accountId: parsedAccountId,
            contactId: parsedContactId,
            priceBookId: parsedPriceBookId,
            ownerId: userId,
            createdBy: userId,
          },
        });

        // Log creation activity
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

      // Fetch full opportunity with relations
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

  /**
   * GET /api/opportunities
   * List all opportunities (paginated, filterable)
   * Returns slim response: id, name, opportunityOwner, closeDate, stage, createdAt
   */
  async getAllOpportunities(req: Request, res: Response) {
    const operation = "Get all opportunities";
    try {
      const pageParam = req.query.page as string;
      const limitParam = req.query.limit as string;
      const page = Math.max(1, parseInt(pageParam) || 1);
      const requestedLimit = parseInt(limitParam);
      const limit =
        requestedLimit >= 1 && requestedLimit <= 100 ? requestedLimit : 10;
      const skip = (page - 1) * limit;

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
        const stageArray = stage.toString().split(",") as OpportunityStage[];
        whereClause.stage =
          stageArray.length === 1 ? stageArray[0] : { in: stageArray };
      }
      if (ownerId) {
        const parsed = parseInt(ownerId as string);
        if (!isNaN(parsed)) whereClause.ownerId = parsed;
      }
      if (accountId) {
        const parsed = parseInt(accountId as string);
        if (!isNaN(parsed)) whereClause.accountId = parsed;
      }
      if (createdFrom || createdTo) {
        const createdAtFilter: Prisma.DateTimeFilter = {};
        if (createdFrom) {
          const d = new Date(createdFrom as string);
          if (!isNaN(d.getTime())) createdAtFilter.gte = d;
        }
        if (createdTo) {
          const d = new Date(createdTo as string);
          if (!isNaN(d.getTime())) createdAtFilter.lte = d;
        }
        if (Object.keys(createdAtFilter).length > 0)
          whereClause.createdAt = createdAtFilter;
      }
      if (expectedCloseFrom || expectedCloseTo) {
        const expectedCloseFilter: Prisma.DateTimeNullableFilter = {};
        if (expectedCloseFrom) {
          const d = new Date(expectedCloseFrom as string);
          if (!isNaN(d.getTime())) expectedCloseFilter.gte = d;
        }
        if (expectedCloseTo) {
          const d = new Date(expectedCloseTo as string);
          if (!isNaN(d.getTime())) expectedCloseFilter.lte = d;
        }
        if (Object.keys(expectedCloseFilter).length > 0)
          whereClause.expectedCloseDate = expectedCloseFilter;
      }
      if (amountMin !== undefined || amountMax !== undefined) {
        const amountFilter: Prisma.DecimalNullableFilter = {};
        if (amountMin !== undefined) {
          const parsed = parseFloat(amountMin as string);
          if (!isNaN(parsed)) amountFilter.gte = parsed;
        }
        if (amountMax !== undefined) {
          const parsed = parseFloat(amountMax as string);
          if (!isNaN(parsed)) amountFilter.lte = parsed;
        }
        if (Object.keys(amountFilter).length > 0)
          whereClause.amount = amountFilter;
      }

      const allowedSortFields = [
        "createdAt",
        "name",
        "expectedCloseDate",
        "stage",
        "amount",
      ];
      const orderField = allowedSortFields.includes(sortBy as string)
        ? (sortBy as string)
        : "createdAt";
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

  /**
   * Generate a quote number: QUO-YYMM-XXXX-V
   * V = version letter (A, B, C, ...)
   */
  private async generateQuoteNumber(
    opportunityId: number
  ): Promise<{ quoteNumber: string; version: number }> {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `QUO-${yy}${mm}-`;

    // Find the highest existing quote number with this prefix
    const lastQuote = await prisma.quote.findFirst({
      where: { quoteNumber: { startsWith: prefix } },
      orderBy: { quoteNumber: "desc" },
      select: { quoteNumber: true },
    });

    let sequenceNum = 1;
    if (lastQuote && lastQuote.quoteNumber) {
      // Extract XXXX from QUO-YYMM-XXXX-V
      const parts = lastQuote.quoteNumber.split("-");
      // parts: ["QUO", "YYMM", "XXXX", "V"]
      if (parts.length >= 3 && parts[2]) {
        const num = parseInt(parts[2], 10);
        if (!isNaN(num)) {
          sequenceNum = num + 1;
        }
      }
    }

    // Determine version letter based on existing quotes for this opportunity
    const existingQuotesCount = await prisma.quote.count({
      where: { opportunityId },
    });
    const versionNumber = existingQuotesCount + 1;
    const versionLetter = String.fromCharCode(64 + versionNumber); // 1=A, 2=B, 3=C...

    const quoteNumber = `${prefix}${String(sequenceNum).padStart(4, "0")}-${versionLetter}`;
    return { quoteNumber, version: versionNumber };
  }

  /**
   * POST /api/opportunities/:id/generate-quote
   * Generate a quote from an opportunity
   */
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

      // 1. Fetch opportunity with line items, account, and contact
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

      // 2. Check soft delete
      if (opportunity.deletedAt) {
        return handleNotFoundError(res, "Opportunity", operation);
      }

      // 3. Validate opportunity has line items
      if (opportunity.lineItems.length === 0) {
        return res.status(400).json({
          error:
            "Opportunity has no line items. Add at least one line item before generating a quote.",
          code: "NO_LINE_ITEMS",
        });
      }

      // 4. Generate quote number and version
      const { quoteNumber, version } =
        await this.generateQuoteNumber(opportunityId);

      // 5. Check if this is the first quote (will be primary)
      const existingQuoteCount = await prisma.quote.count({
        where: { opportunityId },
      });
      const isPrimary = existingQuoteCount === 0;

      // 6. Calculate totals from line items
      let subtotal = new Prisma.Decimal(0);
      for (const item of opportunity.lineItems) {
        subtotal = subtotal.add(item.totalPrice);
      }

      const grandTotal = subtotal; // discount, tax, shipping default to 0

      // 7. Create quote + copy line items in a transaction
      const quote = await prisma.$transaction(async tx => {
        // Create the quote
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
            validUntil: validUntil ? new Date(validUntil) : null,
            paymentTerms: paymentTerms || null,
            deliveryTerms: deliveryTerms || null,
            notes: notes || null,
            internalNotes: internalNotes || null,
            opportunityId: opportunity.id,
            accountId: opportunity.accountId,
            contactId: opportunity.contactId,
            preparedById: userId,
          },
        });

        // Copy line items from opportunity to quote
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

        // Log activity on opportunity
        await tx.opportunityActivity.create({
          data: {
            opportunityId: opportunity.id,
            userId,
            activityType: "QUOTE_GENERATED",
            description: `Quote ${quoteNumber} generated`,
            newValue: quoteNumber,
          },
        });

        return newQuote;
      });

      // 8. Fetch the complete quote with line items to return
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

  /**
   * PATCH /api/opportunity/:opportunityId
   * Update an opportunity (name, expectedCloseDate, nextStep, type, stage, leadSource)
   */
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

      // Fetch existing opportunity
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

      // Check at least one field is provided
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

      // Validate and set name
      if (name !== undefined) {
        if (!name || typeof name !== "string" || name.trim().length === 0) {
          return handleValidationError(
            res,
            "Name cannot be empty",
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

      // Validate and set expectedCloseDate
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
          const d = new Date(expectedCloseDate);
          if (isNaN(d.getTime())) {
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

      // Validate and set nextStep
      if (nextStep !== undefined) {
        const newVal = nextStep || null;
        if (newVal !== existing.nextStep) {
          activities.push({
            field: "nextStep",
            oldValue: existing.nextStep,
            newValue: newVal,
          });
          updateData.nextStep = newVal;
        }
      }

      // Validate and set type
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

      // Validate and set stage
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

      // Validate and set leadSource
      if (leadSource !== undefined) {
        const newVal = leadSource || null;
        if (newVal !== existing.leadSource) {
          activities.push({
            field: "leadSource",
            oldValue: existing.leadSource,
            newValue: newVal,
          });
          updateData.leadSource = newVal;
        }
      }

      // Validate and set priceBookId
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
          const parsedPriceBookId = parseInt(priceBookId, 10);
          if (isNaN(parsedPriceBookId)) {
            return handleValidationError(
              res,
              "Invalid priceBookId",
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

      // If nothing actually changed, return current data
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

      // Update opportunity and log activities in a transaction
      await prisma.$transaction(async tx => {
        if (deleteLineItems) {
          await tx.opportunityLineItem.deleteMany({ where: { opportunityId } });
        }

        await tx.opportunity.update({
          where: { id: opportunityId },
          data: updateData,
        });

        // Log each field change as an activity
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

      // Fetch full updated opportunity with relations
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

  /**
   * POST /api/opportunities/:id/submit
   * Submit an opportunity for approval.
   * If the max line-item discount exceeds the OPPORTUNITY_DISCOUNT_THRESHOLD global setting,
   * an ApprovalProcess record is created and the opportunity status is set to SUBMITTED.
   * Otherwise the opportunity moves directly to IN_PROGRESS (no approval needed).
   * Body: { requestedToId: number } — required when discount threshold is exceeded
   */
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

      // Fetch opportunity with line items
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

      if (opportunity.lineItems.length === 0) {
        return handleValidationError(
          res,
          "Add at least one line item before submitting",
          "lineItems",
          operation
        );
      }

      // Get discount threshold from global settings (default 0 = always require approval if any discount)
      const thresholdSetting = await prisma.globalSetting.findUnique({
        where: { key: "OPPORTUNITY_DISCOUNT_THRESHOLD" },
      });
      const threshold = thresholdSetting
        ? parseFloat(thresholdSetting.value)
        : 0;

      // Find the maximum discount % across all line items
      const maxDiscount = opportunity.lineItems.reduce((max, item) => {
        const d = parseFloat(item.discount.toString());
        return d > max ? d : max;
      }, 0);

      const requiresApproval = maxDiscount > threshold;

      if (requiresApproval) {
        // requestedToId is mandatory when approval is needed
        if (!requestedToId) {
          return handleValidationError(
            res,
            "requestedToId is required because the opportunity discount exceeds the approval threshold",
            "requestedToId",
            operation
          );
        }

        const parsedRequestedToId = parseInt(requestedToId, 10);
        if (isNaN(parsedRequestedToId)) {
          return handleValidationError(
            res,
            "Invalid requestedToId",
            "requestedToId",
            operation
          );
        }

        const approver = await prisma.user.findUnique({
          where: { id: parsedRequestedToId },
        });
        if (!approver) {
          return handleNotFoundError(res, "Approver user", operation);
        }
        if (approver.role === UserRole.SALES) {
          return handleValidationError(
            res,
            "Approver must have the ADMIN role",
            "requestedToId",
            operation
          );
        }

        // Check for existing pending approval
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

        // Transactionally: create approval + set status to SUBMITTED
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

          return newApproval;
        });

        // Notify approver by email (fire-and-forget)
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
          .catch(err =>
            console.error("[Opportunity] Failed to send approval email:", err)
          );

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
        // No approval needed — move directly to IN_PROGRESS
        await prisma.$transaction(async tx => {
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

  /**
   * GET /api/opportunity/:opportunityId
   * Get opportunity details by ID
   */
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

  /**
   * DELETE /api/opportunities/:opportunityId
   * Delete an opportunity (soft delete — sets deletedAt).
   */
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

  /**
   * GET /api/opportunities/:opportunityId/line-items
   * Get all line items for an opportunity.
   */
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

  /**
   * POST /api/opportunities/:opportunityId/line-items
   * Add a line item to an opportunity.
   * Body: productId (required), quantity (optional, default 1), priceBookEntryId (optional), listPrice (required if no priceBookEntryId), discount (optional, default 0), description (optional).
   */
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
        select: { id: true, deletedAt: true, priceBookId: true },
      });
      if (!opportunity || opportunity.deletedAt) {
        return handleNotFoundError(res, "Opportunity", operation);
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

      const parsedProductId = parseInt(productId, 10);
      if (isNaN(parsedProductId)) {
        return handleValidationError(
          res,
          "Invalid productId",
          "productId",
          operation
        );
      }

      const product = await prisma.product.findUnique({
        where: { id: parsedProductId },
      });
      if (!product) {
        return handleNotFoundError(res, "Product", operation);
      }

      let listPrice: number;
      let parsedPriceBookEntryId: number | null = null;

      if (priceBookEntryId !== undefined && priceBookEntryId !== null) {
        parsedPriceBookEntryId = parseInt(priceBookEntryId, 10);
        if (isNaN(parsedPriceBookEntryId)) {
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
          },
        });
        if (!priceBookEntry) {
          return handleNotFoundError(res, "Price book entry", operation);
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
        listPrice = Number(priceBookEntry.listPrice);
      } else {
        if (listPriceParam === undefined || listPriceParam === null) {
          return handleValidationError(
            res,
            "listPrice is required when priceBookEntryId is not provided",
            "listPrice",
            operation
          );
        }
        listPrice = parseFloat(listPriceParam);
        if (isNaN(listPrice) || listPrice < 0) {
          return handleValidationError(
            res,
            "listPrice must be a non-negative number",
            "listPrice",
            operation
          );
        }
      }

      const quantity =
        quantityParam !== undefined && quantityParam !== null
          ? Math.max(1, parseInt(quantityParam, 10) || 1)
          : 1;
      if (isNaN(quantity) || quantity < 1) {
        return handleValidationError(
          res,
          "quantity must be a positive integer",
          "quantity",
          operation
        );
      }

      const discount =
        discountParam !== undefined && discountParam !== null
          ? parseFloat(discountParam)
          : 0;
      if (isNaN(discount) || discount < 0 || discount > 100) {
        return handleValidationError(
          res,
          "discount must be a number between 0 and 100",
          "discount",
          operation
        );
      }

      const unitPrice = listPrice * (1 - discount / 100);
      const totalPrice = quantity * unitPrice;

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

  /**
   * PATCH /api/opportunities/:opportunityId/line-items/:lineItemId
   * Update a line item.
   * Body: quantity, listPrice, discount, description, sortOrder (all optional; at least one required).
   * unitPrice and totalPrice are recomputed from listPrice, discount, and quantity when provided.
   */
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
        select: { id: true, deletedAt: true },
      });
      if (!opportunity || opportunity.deletedAt) {
        return handleNotFoundError(res, "Opportunity", operation);
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
          ? parseInt(quantityParam, 10)
          : existing.quantity;
      if (isNaN(quantity) || quantity < 1) {
        return handleValidationError(
          res,
          "quantity must be a positive integer",
          "quantity",
          operation
        );
      }

      const listPrice =
        listPriceParam !== undefined && listPriceParam !== null
          ? parseFloat(listPriceParam)
          : Number(existing.listPrice);
      if (isNaN(listPrice) || listPrice < 0) {
        return handleValidationError(
          res,
          "listPrice must be a non-negative number",
          "listPrice",
          operation
        );
      }

      const discount =
        discountParam !== undefined && discountParam !== null
          ? parseFloat(discountParam)
          : Number(existing.discount);
      if (isNaN(discount) || discount < 0 || discount > 100) {
        return handleValidationError(
          res,
          "discount must be a number between 0 and 100",
          "discount",
          operation
        );
      }

      const unitPrice = listPrice * (1 - discount / 100);
      const totalPrice = quantity * unitPrice;

      const updateData: Prisma.OpportunityLineItemUpdateInput = {
        quantity,
        listPrice,
        unitPrice,
        discount,
        totalPrice,
      };
      if (description !== undefined) {
        updateData.description =
          description && typeof description === "string"
            ? description.trim() || null
            : null;
      }
      if (sortOrderParam !== undefined && sortOrderParam !== null) {
        const sortOrder = parseInt(sortOrderParam, 10);
        if (!isNaN(sortOrder) && sortOrder >= 0) {
          updateData.sortOrder = sortOrder;
        }
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

  /**
   * GET /api/opportunities/:opportunityId/quotes
   * Get all quotes for an opportunity (paginated, newest first).
   */
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

      const pageParam = req.query.page as string;
      const limitParam = req.query.limit as string;
      const page = Math.max(1, parseInt(pageParam) || 1);
      const requestedLimit = parseInt(limitParam);
      const limit =
        requestedLimit >= 1 && requestedLimit <= 100 ? requestedLimit : 10;
      const skip = (page - 1) * limit;

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

  /**
   * DELETE /api/opportunities/:opportunityId/line-items/:lineItemId
   * Delete a line item (hard delete). Recalculates opportunity amount after deletion.
   */
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
        select: { id: true, deletedAt: true },
      });
      if (!opportunity || opportunity.deletedAt) {
        return handleNotFoundError(res, "Opportunity", operation);
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
