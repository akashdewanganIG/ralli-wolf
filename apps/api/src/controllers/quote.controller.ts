import { Request, Response } from "express";
import { createHash } from "node:crypto";
import { prisma } from "@repo/db";
import { roleHasPermission } from "@repo/db/permissions";
import { Prisma, QuoteStatus } from "@prisma/client";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  handleConflictError,
} from "../utils/error-handler.js";
import { buildFullName } from "../utils/name-helpers.js";
import { emailService } from "../services/email.service.js";
import { logError } from "../utils/logger.js";
import {
  isValidEmail,
  normalizeEmail,
  parseBoundedInteger,
  parsePositiveInteger,
  parseStrictBoolean,
} from "../utils/validators.js";
import {
  nextDocumentNumber,
  SEQUENCE_KEYS,
} from "../services/supplyChain/numbering.service.js";
import {
  quotePdfInclude,
  renderQuotePdf,
} from "../services/quote-pdf.service.js";

class QuoteSubmissionStateError extends Error {}
const DELIVERY_CLAIM_TIMEOUT_MS = 15 * 60 * 1_000;

export class QuoteController {
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

  async getAllQuotes(req: Request, res: Response) {
    const operation = "Get all quotes";
    try {
      const pagination = this.pagination(req, res, operation);
      if (!pagination) return;
      const { page, limit, skip } = pagination;

      const { status, opportunityId, accountId, isPrimary, sortBy, sortOrder } =
        req.query;

      const whereClause: Prisma.QuoteWhereInput = {};

      if (status) {
        const statusArray = status.toString().split(",");
        if (
          statusArray.some(
            value => !Object.values(QuoteStatus).includes(value as QuoteStatus)
          )
        ) {
          return handleValidationError(
            res,
            "Invalid quote status",
            "status",
            operation
          );
        }
        whereClause.status =
          statusArray.length === 1
            ? (statusArray[0] as QuoteStatus)
            : { in: statusArray as QuoteStatus[] };
      }

      if (opportunityId) {
        const parsedOppId = parsePositiveInteger(opportunityId);
        if (parsedOppId === null) {
          return handleValidationError(
            res,
            "Invalid opportunity ID",
            "opportunityId",
            operation
          );
        }
        whereClause.opportunityId = parsedOppId;
      }

      if (accountId) {
        const parsedAccId = parsePositiveInteger(accountId);
        if (parsedAccId === null) {
          return handleValidationError(
            res,
            "Invalid account ID",
            "accountId",
            operation
          );
        }
        whereClause.accountId = parsedAccId;
      }

      if (isPrimary !== undefined) {
        const parsed = parseStrictBoolean(isPrimary);
        if (parsed === null) {
          return handleValidationError(
            res,
            "isPrimary must be true or false",
            "isPrimary",
            operation
          );
        }
        whereClause.isPrimary = parsed;
      }

      const allowedSortFields = [
        "createdAt",
        "quoteNumber",
        "grandTotal",
        "status",
        "validUntil",
      ];
      const orderField = allowedSortFields.includes(sortBy as string)
        ? (sortBy as string)
        : "createdAt";
      const orderDirection = sortOrder === "asc" ? "asc" : "desc";

      const totalItems = await prisma.quote.count({ where: whereClause });

      const quotes = await prisma.quote.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { [orderField]: orderDirection },
        include: {
          opportunity: {
            select: {
              id: true,
              opportunityNumber: true,
              name: true,
              stage: true,
            },
          },
          account: {
            select: { id: true, name: true },
          },
          contact: {
            select: { id: true, name: true, email: true },
          },
          preparedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: {
            select: { lineItems: true },
          },
        },
      });

      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return res.json({
        data: quotes,
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
      handleError(error, res, operation);
    }
  }

  async getQuoteById(req: Request, res: Response) {
    const operation = "Get quote by ID";
    try {
      const quoteId = this.parseId(req.params.id, res, "Quote ID", operation);
      if (quoteId === null) return;

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
          opportunity: {
            select: {
              id: true,
              opportunityNumber: true,
              name: true,
              stage: true,
            },
          },
          account: {
            select: { id: true, name: true },
          },
          contact: {
            select: { id: true, name: true, email: true },
          },
          preparedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          approvedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          rejectedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: {
            select: { lineItems: true, salesOrders: true },
          },
        },
      });

      if (!quote) {
        return handleNotFoundError(res, "Quote", operation);
      }

      return res.json(quote);
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  async updateQuoteStatus(req: Request, res: Response) {
    const operation = "Update quote status";
    try {
      const quoteId = this.parseId(req.params.id, res, "Quote ID", operation);
      if (quoteId === null) return;

      const { status } = req.body;

      if (!status) {
        return handleValidationError(
          res,
          "Status is required",
          "status",
          operation
        );
      }

      const validStatuses: QuoteStatus[] = [
        "DRAFT",
        "IN_REVIEW",
        "APPROVED",
        "REJECTED",
        "PRESENTING",
        "PRESENTED",
        "ACCEPTED",
      ];

      if (!validStatuses.includes(status)) {
        return handleValidationError(
          res,
          `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          "status",
          operation
        );
      }

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        select: { id: true, status: true },
      });
      if (!quote) {
        return handleNotFoundError(res, "Quote", operation);
      }

      const allowedTransitions: Record<QuoteStatus, readonly QuoteStatus[]> = {
        DRAFT: [],
        IN_REVIEW: [],
        APPROVED: [],
        REJECTED: ["DRAFT"],
        PRESENTING: [],
        PRESENTED: ["ACCEPTED", "REJECTED"],
        ACCEPTED: [],
      };
      if (!allowedTransitions[quote.status].includes(status)) {
        return handleValidationError(
          res,
          `Quote cannot move from ${quote.status} to ${status}`,
          "status",
          operation
        );
      }

      const updateData: Prisma.QuoteUncheckedUpdateManyInput = { status };
      if (status === "DRAFT") {
        updateData.rejectedAt = null;
        updateData.rejectedById = null;
        updateData.rejectionComment = null;
      } else if (status === "REJECTED") {
        updateData.rejectedAt = new Date();
        updateData.rejectedById = req.user!.id;
      } else if (status === "ACCEPTED") {
        updateData.acceptedAt = new Date();
      }

      const updatedQuote = await prisma.$transaction(async tx => {
        if (status === "DRAFT") {
          await tx.approvalProcess.updateMany({
            where: {
              targetObjectName: "QUOTE",
              targetRecordId: quoteId,
              status: "PENDING",
            },
            data: {
              status: "REJECTED",
              completedDate: new Date(),
              lastActorId: req.user!.id,
            },
          });
        }

        const changed = await tx.quote.updateMany({
          where: { id: quoteId, status: quote.status },
          data: updateData,
        });
        if (changed.count !== 1) return null;
        return tx.quote.findUnique({
          where: { id: quoteId },
          include: {
            opportunity: {
              select: { id: true, opportunityNumber: true, name: true },
            },
            account: {
              select: { id: true, name: true },
            },
            preparedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });
      });

      if (!updatedQuote) {
        return handleConflictError(
          res,
          "Quote status changed while the request was being processed",
          operation
        );
      }

      return res.json(updatedQuote);
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  async setPrimaryQuote(req: Request, res: Response) {
    const operation = "Set primary quote";
    try {
      const quoteId = this.parseId(req.params.id, res, "Quote ID", operation);
      if (quoteId === null) return;

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        select: { id: true, isPrimary: true, opportunityId: true },
      });

      if (!quote) {
        return handleNotFoundError(res, "Quote", operation);
      }

      if (quote.isPrimary) {
        return handleValidationError(
          res,
          "This quote is already the primary quote",
          "isPrimary",
          operation
        );
      }

      const [, updatedQuote] = await prisma.$transaction([
        prisma.quote.updateMany({
          where: { opportunityId: quote.opportunityId, isPrimary: true },
          data: { isPrimary: false },
        }),

        prisma.quote.update({
          where: { id: quoteId },
          data: { isPrimary: true },
          include: {
            opportunity: {
              select: { id: true, opportunityNumber: true, name: true },
            },
            account: {
              select: { id: true, name: true },
            },
            preparedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        }),
      ]);

      return res.json(updatedQuote);
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  async generateOrder(req: Request, res: Response) {
    const operation = "Generate order from quote";
    try {
      const quoteId = this.parseId(req.params.id, res, "Quote ID", operation);
      if (quoteId === null) return;

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: { lineItems: true },
      });

      if (!quote) {
        return handleNotFoundError(res, "Quote", operation);
      }

      if (quote.status !== "ACCEPTED") {
        return handleValidationError(
          res,
          "Only accepted quotes can generate orders. Current status: " +
            quote.status,
          "status",
          operation
        );
      }

      const existingOrder = await prisma.salesOrder.findFirst({
        where: { quoteId },
        select: { id: true, orderNumber: true },
      });

      if (existingOrder) {
        return handleConflictError(
          res,
          `An order (${existingOrder.orderNumber}) already exists for this quote`,
          operation
        );
      }

      const salesOrder = await prisma.$transaction(async tx => {
        const orderNumber = await nextDocumentNumber(
          tx,
          SEQUENCE_KEYS.SALES_ORDER
        );
        const newOrder = await tx.salesOrder.create({
          data: {
            orderNumber,
            name: `Order for ${quote.name}`,
            description: quote.description,
            status: "DRAFT",

            subtotal: quote.subtotal,
            discount: quote.discount,
            discountPercent: quote.discountPercent,
            taxAmount: quote.taxAmount,
            taxPercent: quote.taxPercent,
            shippingAmount: quote.shippingAmount,
            grandTotal: quote.grandTotal,

            billingName: quote.billingName,
            billingStreet: quote.billingStreet,
            billingCity: quote.billingCity,
            billingState: quote.billingState,
            billingPostalCode: quote.billingPostalCode,
            billingCountry: quote.billingCountry,
            shippingName: quote.shippingName,
            shippingStreet: quote.shippingStreet,
            shippingCity: quote.shippingCity,
            shippingState: quote.shippingState,
            shippingPostalCode: quote.shippingPostalCode,
            shippingCountry: quote.shippingCountry,

            paymentTerms: quote.paymentTerms,
            deliveryTerms: quote.deliveryTerms,
            notes: quote.notes,
            internalNotes: quote.internalNotes,

            quoteId: quote.id,
            accountId: quote.accountId,
            contactId: quote.contactId,
            ownerId: req.user!.id,

            lineItems: {
              create: quote.lineItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                listPrice: item.listPrice,
                unitPrice: item.unitPrice,
                discount: item.discount,
                totalPrice: item.totalPrice,
                description: item.description,
                sortOrder: item.sortOrder,
              })),
            },
          },
          include: {
            lineItems: {
              include: {
                product: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
            account: {
              select: { id: true, name: true },
            },
            quote: {
              select: { id: true, quoteNumber: true, name: true },
            },
            owner: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });

        return newOrder;
      });

      return res.status(201).json({ data: salesOrder });
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  async getQuoteLineItems(req: Request, res: Response) {
    const operation = "Get quote line items";
    try {
      const quoteId = this.parseId(req.params.id, res, "Quote ID", operation);
      if (quoteId === null) return;

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        select: { id: true },
      });

      if (!quote) {
        return handleNotFoundError(res, "Quote", operation);
      }

      const pagination = this.pagination(req, res, operation);
      if (!pagination) return;
      const { page, limit, skip } = pagination;

      const whereClause = { quoteId };

      const totalItems = await prisma.quoteLineItem.count({
        where: whereClause,
      });

      const lineItems = await prisma.quoteLineItem.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            select: { id: true, name: true, code: true },
          },
          priceBookEntry: {
            select: { id: true, listPrice: true },
          },
        },
      });

      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return res.json({
        data: lineItems,
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
      handleError(error, res, operation);
    }
  }

  async getQuoteOrders(req: Request, res: Response) {
    const operation = "Get quote orders";
    try {
      const quoteId = this.parseId(req.params.id, res, "Quote ID", operation);
      if (quoteId === null) return;

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        select: { id: true },
      });

      if (!quote) {
        return handleNotFoundError(res, "Quote", operation);
      }

      const pagination = this.pagination(req, res, operation);
      if (!pagination) return;
      const { page, limit, skip } = pagination;

      const whereClause = { quoteId };

      const totalItems = await prisma.salesOrder.count({ where: whereClause });

      const orders = await prisma.salesOrder.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          name: true,
          status: true,
          grandTotal: true,
          orderDate: true,
          expectedShipDate: true,
          owner: {
            select: { id: true, firstName: true, lastName: true },
          },
          createdAt: true,
        },
      });

      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return res.json({
        data: orders,
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
      handleError(error, res, operation);
    }
  }

  async generatePdf(req: Request, res: Response) {
    const operation = "Generate quote PDF";
    try {
      const quoteId = this.parseId(req.params.id, res, "Quote ID", operation);
      if (quoteId === null) return;

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: quotePdfInclude,
      });

      if (!quote) {
        return handleNotFoundError(res, "Quote", operation);
      }

      const pdfBuffer = await renderQuotePdf(quote);
      const safeQuoteNumber = quote.quoteNumber.replace(
        /[^A-Za-z0-9._-]/g,
        "_"
      );

      res
        .status(200)
        .set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeQuoteNumber}.pdf"`,
          "Content-Length": pdfBuffer.length.toString(),
          "Cache-Control": "private, no-store",
        })
        .send(pdfBuffer);
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  async submitForApproval(req: Request, res: Response) {
    const operation = "Submit quote for approval";
    try {
      const quoteId = this.parseId(req.params.id, res, "Quote ID", operation);
      if (quoteId === null) return;

      const userId = req.user!.id;
      const { requestedToId, comment } = req.body;

      if (requestedToId === undefined || requestedToId === null) {
        return handleValidationError(
          res,
          "requestedToId is required",
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
          "A quote cannot be submitted to its requester for approval",
          "requestedToId",
          operation
        );
      }
      if (
        comment !== undefined &&
        comment !== null &&
        (typeof comment !== "string" || comment.trim().length > 5_000)
      ) {
        return handleValidationError(
          res,
          "comment must be text of at most 5000 characters",
          "comment",
          operation
        );
      }

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        select: { id: true, name: true, quoteNumber: true, status: true },
      });

      if (!quote) {
        return handleNotFoundError(res, "Quote", operation);
      }

      if (quote.status !== "DRAFT") {
        return handleValidationError(
          res,
          `Only DRAFT quotes can be submitted for approval. Current status: ${quote.status}`,
          "status",
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
        !roleHasPermission(approver.role, approver.permissions, "approvals.act")
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
          targetObjectName: "QUOTE",
          targetRecordId: quoteId,
          status: "PENDING",
        },
      });
      if (existing) {
        return res.status(409).json({
          error: "A pending approval already exists for this quote",
          code: "APPROVAL_EXISTS",
          approvalId: existing.id,
        });
      }

      const approval = await prisma.$transaction(async tx => {
        const claimed = await tx.quote.updateMany({
          where: { id: quoteId, status: "DRAFT" },
          data: { status: "IN_REVIEW" },
        });
        if (claimed.count !== 1) {
          throw new QuoteSubmissionStateError();
        }

        const newApproval = await tx.approvalProcess.create({
          data: {
            targetObjectName: "QUOTE",
            targetRecordId: quoteId,
            requestedToId: parsedRequestedToId,
            createdById: userId,
            comment:
              typeof comment === "string" ? comment.trim() || null : null,
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

        return newApproval;
      });

      const requester = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      emailService
        .sendApprovalRequestEmail({
          approverName: buildFullName(approver.firstName, approver.lastName),
          approverEmail: approver.email,
          requesterName: buildFullName(
            requester?.firstName ?? null,
            requester?.lastName ?? null
          ),
          objectType: "Quote",
          objectName: quote.name,
          objectNumber: quote.quoteNumber,
          approvalId: approval.id,
        })
        .catch(err => logError("quote_approval_email_failed", err));

      const updatedQuote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
          opportunity: {
            select: { id: true, opportunityNumber: true, name: true },
          },
          account: { select: { id: true, name: true } },
          preparedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return res.json({ data: updatedQuote, approval });
    } catch (error) {
      if (error instanceof QuoteSubmissionStateError) {
        return handleConflictError(
          res,
          "Quote status changed while it was being submitted",
          operation
        );
      }
      handleError(error, res, operation);
    }
  }

  async sendToClient(req: Request, res: Response) {
    const operation = "Send quote to client";
    try {
      const quoteId = this.parseId(req.params.id, res, "Quote ID", operation);
      if (quoteId === null) return;

      const { to, subject, message, cc, bcc } = req.body;

      const recipient = normalizeEmail(typeof to === "string" ? to : null);
      if (!recipient || !isValidEmail(recipient)) {
        return handleValidationError(
          res,
          "A valid recipient email (to) is required",
          "to",
          operation
        );
      }
      if (
        subject !== undefined &&
        (typeof subject !== "string" ||
          subject.trim().length === 0 ||
          subject.trim().length > 200)
      ) {
        return handleValidationError(
          res,
          "subject must be non-empty text of at most 200 characters",
          "subject",
          operation
        );
      }
      if (
        message !== undefined &&
        (typeof message !== "string" || message.trim().length > 5_000)
      ) {
        return handleValidationError(
          res,
          "message must be text of at most 5000 characters",
          "message",
          operation
        );
      }

      const parseRecipients = (value: unknown): string[] | null => {
        if (value === undefined || value === null) return [];
        if (!Array.isArray(value) || value.length > 20) return null;
        const normalized = value.map(item =>
          normalizeEmail(typeof item === "string" ? item : null)
        );
        if (normalized.some(item => !item || !isValidEmail(item))) return null;
        return [...new Set(normalized as string[])];
      };
      const normalizedCc = parseRecipients(cc);
      const normalizedBcc = parseRecipients(bcc);
      if (normalizedCc === null || normalizedBcc === null) {
        const field = normalizedCc === null ? "cc" : "bcc";
        return handleValidationError(
          res,
          `${field} must contain at most 20 valid email addresses`,
          field,
          operation
        );
      }

      const deliveryState = await prisma.quote.findUnique({
        where: { id: quoteId },
        select: { status: true, updatedAt: true },
      });
      if (!deliveryState) {
        return handleNotFoundError(res, "Quote", operation);
      }
      if (deliveryState.status === QuoteStatus.PRESENTING) {
        const staleBefore = new Date(Date.now() - DELIVERY_CLAIM_TIMEOUT_MS);
        if (deliveryState.updatedAt > staleBefore) {
          return handleConflictError(
            res,
            "Quote delivery is already in progress",
            operation
          );
        }
        const recovered = await prisma.quote.updateMany({
          where: {
            id: quoteId,
            status: QuoteStatus.PRESENTING,
            updatedAt: { lte: staleBefore },
          },
          data: { status: QuoteStatus.APPROVED },
        });
        if (recovered.count !== 1) {
          return handleConflictError(
            res,
            "Quote delivery state changed while it was being recovered",
            operation
          );
        }
      }

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: quotePdfInclude,
      });

      if (!quote) {
        return handleNotFoundError(res, "Quote", operation);
      }

      if (quote.status !== "APPROVED") {
        return handleValidationError(
          res,
          `Only APPROVED quotes can be sent to clients. Current status: ${quote.status}`,
          "status",
          operation
        );
      }

      const pdfBuffer = await renderQuotePdf(quote);

      const claimed = await prisma.quote.updateMany({
        where: { id: quoteId, status: "APPROVED" },
        data: { status: "PRESENTING" },
      });
      if (claimed.count !== 1) {
        return handleConflictError(
          res,
          "Quote delivery is already in progress or the quote status changed",
          operation
        );
      }

      const deliveryDigest = createHash("sha256")
        .update(
          JSON.stringify({
            deliveryFormatVersion: 1,
            quoteId,
            recipient,
            cc: normalizedCc,
            bcc: normalizedBcc,
            subject: typeof subject === "string" ? subject.trim() : null,
            message: typeof message === "string" ? message.trim() : null,
            pdfSha256: createHash("sha256").update(pdfBuffer).digest("hex"),
            quote: {
              quoteNumber: quote.quoteNumber,
              name: quote.name,
              validUntil: quote.validUntil?.toISOString() ?? null,
              subtotal: quote.subtotal.toString(),
              discount: quote.discount.toString(),
              discountPercent: quote.discountPercent.toString(),
              taxAmount: quote.taxAmount.toString(),
              taxPercent: quote.taxPercent.toString(),
              shippingAmount: quote.shippingAmount.toString(),
              grandTotal: quote.grandTotal.toString(),
              paymentTerms: quote.paymentTerms,
              deliveryTerms: quote.deliveryTerms,
              notes: quote.notes,
              lineItems: quote.lineItems.map(item => ({
                productId: item.productId,
                productName: item.product?.name ?? null,
                quantity: item.quantity,
                unitPrice: item.unitPrice.toString(),
                discount: item.discount.toString(),
                totalPrice: item.totalPrice.toString(),
              })),
            },
          })
        )
        .digest("hex")
        .slice(0, 40);

      const contactName = quote.contact?.name ?? quote.account.name;
      const sent = await emailService.sendQuoteEmail({
        to: recipient,
        contactName,
        subject: typeof subject === "string" ? subject.trim() : undefined,
        message: typeof message === "string" ? message.trim() : undefined,
        cc: normalizedCc.length > 0 ? normalizedCc : undefined,
        bcc: normalizedBcc.length > 0 ? normalizedBcc : undefined,
        idempotencyKey: `quote-${quoteId}-${deliveryDigest}`,
        pdfAttachment: {
          filename: `${quote.quoteNumber}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
        quote: {
          quoteNumber: quote.quoteNumber,
          name: quote.name,
          validUntil: quote.validUntil,
          grandTotal: Number(quote.grandTotal),
          subtotal: Number(quote.subtotal),
          discount: Number(quote.discount),
          discountPercent: Number(quote.discountPercent),
          taxAmount: Number(quote.taxAmount),
          taxPercent: Number(quote.taxPercent),
          shippingAmount: Number(quote.shippingAmount),
          paymentTerms: quote.paymentTerms,
          deliveryTerms: quote.deliveryTerms,
          notes: quote.notes,
          lineItems: quote.lineItems.map(item => ({
            productName: item.product?.name ?? `Product #${item.productId}`,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount),
            totalPrice: Number(item.totalPrice),
          })),
        },
      });
      if (!sent) {
        await prisma.quote.updateMany({
          where: { id: quoteId, status: "PRESENTING" },
          data: { status: "APPROVED" },
        });
        return res.status(502).json({
          error: "Quote email could not be delivered",
          code: "EMAIL_DELIVERY_FAILED",
        });
      }

      const finalized = await prisma.quote.updateMany({
        where: { id: quoteId, status: QuoteStatus.PRESENTING },
        data: { status: "PRESENTED", presentedAt: new Date() },
      });
      if (finalized.count !== 1) {
        return handleConflictError(
          res,
          "Quote was delivered, but its status changed before finalization",
          operation
        );
      }

      const updatedQuote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
          opportunity: {
            select: { id: true, opportunityNumber: true, name: true },
          },
          account: { select: { id: true, name: true } },
          contact: { select: { id: true, name: true, email: true } },
          preparedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return res.json({
        data: updatedQuote,
        emailSent: sent,
      });
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  async getQuotesByOpportunityId(req: Request, res: Response) {
    const operation = "Get quotes by opportunity";
    try {
      const opportunityId = this.parseId(
        req.params.id,
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

      const { status } = req.query;

      const whereClause: Prisma.QuoteWhereInput = {
        opportunityId,
      };

      if (status) {
        const statusArray = status.toString().split(",");
        if (
          statusArray.some(
            value => !Object.values(QuoteStatus).includes(value as QuoteStatus)
          )
        ) {
          return handleValidationError(
            res,
            "Invalid quote status",
            "status",
            operation
          );
        }
        whereClause.status =
          statusArray.length === 1
            ? (statusArray[0] as QuoteStatus)
            : { in: statusArray as QuoteStatus[] };
      }

      const totalItems = await prisma.quote.count({ where: whereClause });

      const quotes = await prisma.quote.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          lineItems: {
            orderBy: { sortOrder: "asc" },
            include: {
              product: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          account: {
            select: { id: true, name: true },
          },
          contact: {
            select: { id: true, name: true, email: true },
          },
          preparedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return res.json({
        data: quotes,
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
      handleError(error, res, operation);
    }
  }
}
