import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { Prisma, QuoteStatus, UserRole } from "@prisma/client";
import PDFDocument from "pdfkit";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
  handleConflictError,
} from "../utils/errorHandler.js";
import { buildFullName } from "../utils/nameHelpers.js";
import { uploadToS3 } from "../services/s3.service.js";
import { emailService } from "../services/email.service.js";

export class QuoteController {
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
   * GET /api/quotes
   * List all quotes (paginated, filterable)
   */
  async getAllQuotes(req: Request, res: Response) {
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
      const { status, opportunityId, accountId, isPrimary, sortBy, sortOrder } =
        req.query;

      // Build where clause for filtering
      const whereClause: any = {};

      if (status) {
        const statusArray = status.toString().split(",");
        whereClause.status =
          statusArray.length === 1 ? statusArray[0] : { in: statusArray };
      }

      if (opportunityId) {
        const parsedOppId = parseInt(opportunityId as string);
        if (!isNaN(parsedOppId)) {
          whereClause.opportunityId = parsedOppId;
        }
      }

      if (accountId) {
        const parsedAccId = parseInt(accountId as string);
        if (!isNaN(parsedAccId)) {
          whereClause.accountId = parsedAccId;
        }
      }

      if (isPrimary !== undefined) {
        whereClause.isPrimary = isPrimary === "true";
      }

      // Build orderBy
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

      // Execute count query with filters
      const totalItems = await prisma.quote.count({ where: whereClause });

      // Execute paginated query with filters
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

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      // Return standardized pagination response
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
      handleError(error, res, "Get all quotes");
    }
  }

  /**
   * GET /api/quotes/:id
   * Get a single quote by quote ID (for detail page).
   * For quotes by opportunity use GET /api/opportunities/:opportunityId/quotes
   */
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

  /**
   * PATCH /api/quotes/:id
   * Update quote status (ADMIN only)
   */
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

      // Build update data with status-specific timestamp fields
      const updateData: Prisma.QuoteUpdateInput = { status };

      if (status === "APPROVED") {
        updateData.approvedAt = new Date();
        updateData.approvedBy = { connect: { id: req.user!.id } };
      } else if (status === "REJECTED") {
        updateData.rejectedAt = new Date();
        updateData.rejectedBy = { connect: { id: req.user!.id } };
      } else if (status === "PRESENTED") {
        updateData.presentedAt = new Date();
      } else if (status === "ACCEPTED") {
        updateData.acceptedAt = new Date();
      }

      // When manually resetting to DRAFT, cancel any dangling PENDING approvals so the
      // user can re-submit for approval without hitting the APPROVAL_EXISTS conflict.
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

        return tx.quote.update({
          where: { id: quoteId },
          data: updateData,
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

      return res.json(updatedQuote);
    } catch (error: any) {
      if (error.code === "P2025") {
        return handleNotFoundError(res, "Quote", operation);
      }
      handleError(error, res, operation);
    }
  }

  /**
   * PATCH /api/quotes/:id/set-primary
   * Set a quote as primary (ADMIN only)
   * Atomically unsets the current primary and sets the new one
   */
  async setPrimaryQuote(req: Request, res: Response) {
    const operation = "Set primary quote";
    try {
      const quoteId = this.parseId(req.params.id, res, "Quote ID", operation);
      if (quoteId === null) return;

      // Fetch the quote to validate it exists and check if already primary
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

      // Atomic transaction: unset old primary + set new primary
      const [, updatedQuote] = await prisma.$transaction([
        // Unset current primary quote(s) for this opportunity
        prisma.quote.updateMany({
          where: { opportunityId: quote.opportunityId, isPrimary: true },
          data: { isPrimary: false },
        }),
        // Set the selected quote as primary
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

  /**
   * Generate order number: ORD-YYMM-XXXX
   */
  private async generateOrderNumber(): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `ORD-${yy}${mm}-`;

    const lastOrder = await prisma.salesOrder.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });

    let sequenceNum = 1;
    if (lastOrder && lastOrder.orderNumber) {
      const parts = lastOrder.orderNumber.split("-");
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
   * POST /api/quotes/:id/generate-order
   * Generate a sales order from an accepted quote (ADMIN only)
   * Copies quote data, pricing, addresses, terms, and line items into a new SalesOrder
   */
  async generateOrder(req: Request, res: Response) {
    const operation = "Generate order from quote";
    try {
      const quoteId = this.parseId(req.params.id, res, "Quote ID", operation);
      if (quoteId === null) return;

      // Fetch quote with line items
      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: { lineItems: true },
      });

      if (!quote) {
        return handleNotFoundError(res, "Quote", operation);
      }

      // Only accepted quotes can generate orders
      if (quote.status !== "ACCEPTED") {
        return handleValidationError(
          res,
          "Only accepted quotes can generate orders. Current status: " +
            quote.status,
          "status",
          operation
        );
      }

      // Check if an order already exists for this quote
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

      // Generate order number
      const orderNumber = await this.generateOrderNumber();

      // Create sales order with line items in a transaction
      const salesOrder = await prisma.$transaction(async tx => {
        const newOrder = await tx.salesOrder.create({
          data: {
            orderNumber,
            name: `Order for ${quote.name}`,
            description: quote.description,
            status: "DRAFT",
            // Pricing snapshot from quote
            subtotal: quote.subtotal,
            discount: quote.discount,
            discountPercent: quote.discountPercent,
            taxAmount: quote.taxAmount,
            taxPercent: quote.taxPercent,
            shippingAmount: quote.shippingAmount,
            grandTotal: quote.grandTotal,
            // Address snapshot from quote
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
            // Terms from quote
            paymentTerms: quote.paymentTerms,
            deliveryTerms: quote.deliveryTerms,
            notes: quote.notes,
            internalNotes: quote.internalNotes,
            // Foreign keys
            quoteId: quote.id,
            accountId: quote.accountId,
            contactId: quote.contactId,
            ownerId: req.user!.id,
            // Line items copied from quote
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

  /**
   * GET /api/quotes/:id/line-items
   * Get line items for a specific quote (paginated)
   */
  async getQuoteLineItems(req: Request, res: Response) {
    const operation = "Get quote line items";
    try {
      const quoteId = this.parseId(req.params.id, res, "Quote ID", operation);
      if (quoteId === null) return;

      // Verify the quote exists
      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        select: { id: true },
      });

      if (!quote) {
        return handleNotFoundError(res, "Quote", operation);
      }

      // Extract and validate pagination parameters
      const pageParam = req.query.page as string;
      const limitParam = req.query.limit as string;

      const page = Math.max(1, parseInt(pageParam) || 1);

      const requestedLimit = parseInt(limitParam);
      const limit =
        requestedLimit >= 1 && requestedLimit <= 100 ? requestedLimit : 10;

      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause = { quoteId };

      // Execute count query
      const totalItems = await prisma.quoteLineItem.count({
        where: whereClause,
      });

      // Execute paginated query
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

      // Calculate pagination metadata
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

  /**
   * GET /api/quotes/:id/orders
   * Get all sales orders for a specific quote (paginated)
   */
  async getQuoteOrders(req: Request, res: Response) {
    const operation = "Get quote orders";
    try {
      const quoteId = this.parseId(req.params.id, res, "Quote ID", operation);
      if (quoteId === null) return;

      // Verify the quote exists
      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        select: { id: true },
      });

      if (!quote) {
        return handleNotFoundError(res, "Quote", operation);
      }

      // Extract and validate pagination parameters
      const pageParam = req.query.page as string;
      const limitParam = req.query.limit as string;

      const page = Math.max(1, parseInt(pageParam) || 1);

      const requestedLimit = parseInt(limitParam);
      const limit =
        requestedLimit >= 1 && requestedLimit <= 100 ? requestedLimit : 10;

      const skip = (page - 1) * limit;

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

  /**
   * GET /api/quotes/:id/pdf
   * Generate a PDF document for the quote
   */
  async generatePdf(req: Request, res: Response) {
    const operation = "Generate quote PDF";
    try {
      const quoteId = this.parseId(req.params.id, res, "Quote ID", operation);
      if (quoteId === null) return;

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
          account: { select: { id: true, name: true } },
          contact: {
            select: { id: true, name: true, email: true, phone: true },
          },
          preparedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          opportunity: {
            select: { id: true, name: true, opportunityNumber: true },
          },
          lineItems: {
            orderBy: { sortOrder: "asc" },
            include: {
              product: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });

      if (!quote) {
        return handleNotFoundError(res, "Quote", operation);
      }

      // Create PDF document
      const doc = new PDFDocument({ margin: 50, size: "A4" });

      // Set response headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${quote.quoteNumber}.pdf"`
      );
      doc.pipe(res);

      // --- HEADER ---
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("QUOTE", { align: "center" });
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .font("Helvetica")
        .text(quote.quoteNumber, { align: "center" });
      doc.moveDown(1);

      // --- QUOTE INFO ---
      doc.fontSize(10).font("Helvetica-Bold").text("Quote Details");
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);

      doc.font("Helvetica").fontSize(9);
      const infoStartY = doc.y;
      // Left column
      doc.text(`Name: ${quote.name}`, 50, infoStartY);
      doc.text(`Status: ${quote.status}`, 50);
      doc.text(`Version: ${quote.version}`, 50);
      doc.text(
        `Valid Until: ${quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : "N/A"}`,
        50
      );

      // Right column
      doc.text(
        `Date: ${new Date(quote.createdAt).toLocaleDateString()}`,
        300,
        infoStartY
      );
      doc.text(`Opportunity: ${quote.opportunity.name}`, 300);
      doc.text(`Type: ${quote.type}`, 300);
      doc.text(`Primary: ${quote.isPrimary ? "Yes" : "No"}`, 300);
      doc.moveDown(1);

      // --- CUSTOMER INFO ---
      const custY = doc.y;
      doc.fontSize(10).font("Helvetica-Bold").text("Customer", 50, custY);
      doc.moveTo(50, doc.y).lineTo(290, doc.y).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(9);
      doc.text(`Account: ${quote.account.name}`, 50);
      if (quote.contact) {
        doc.text(`Contact: ${quote.contact.name}`, 50);
        if (quote.contact.email) doc.text(`Email: ${quote.contact.email}`, 50);
        if (quote.contact.phone) doc.text(`Phone: ${quote.contact.phone}`, 50);
      }
      const afterCustY = doc.y;

      // --- PREPARED BY ---
      doc.fontSize(10).font("Helvetica-Bold").text("Prepared By", 300, custY);
      doc.moveTo(300, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(9);
      doc.text(
        `${quote.preparedBy.firstName || ""} ${quote.preparedBy.lastName || ""}`.trim(),
        300
      );
      doc.y = Math.max(afterCustY, doc.y);
      doc.moveDown(1);

      // --- BILLING & SHIPPING ADDRESS ---
      if (quote.billingName || quote.shippingName) {
        const addrY = doc.y;
        if (quote.billingName) {
          doc
            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Billing Address", 50, addrY);
          doc.moveTo(50, doc.y).lineTo(290, doc.y).stroke();
          doc.moveDown(0.3);
          doc.font("Helvetica").fontSize(9);
          if (quote.billingName) doc.text(quote.billingName, 50);
          if (quote.billingStreet) doc.text(quote.billingStreet, 50);
          const billingCityLine = [
            quote.billingCity,
            quote.billingState,
            quote.billingPostalCode,
          ]
            .filter(Boolean)
            .join(", ");
          if (billingCityLine) doc.text(billingCityLine, 50);
          if (quote.billingCountry) doc.text(quote.billingCountry, 50);
        }
        const afterBillingY = doc.y;

        if (quote.shippingName) {
          doc
            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Shipping Address", 300, addrY);
          doc.moveTo(300, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(0.3);
          doc.font("Helvetica").fontSize(9);
          if (quote.shippingName) doc.text(quote.shippingName, 300);
          if (quote.shippingStreet) doc.text(quote.shippingStreet, 300);
          const shippingCityLine = [
            quote.shippingCity,
            quote.shippingState,
            quote.shippingPostalCode,
          ]
            .filter(Boolean)
            .join(", ");
          if (shippingCityLine) doc.text(shippingCityLine, 300);
          if (quote.shippingCountry) doc.text(quote.shippingCountry, 300);
        }
        doc.y = Math.max(afterBillingY, doc.y);
        doc.moveDown(1);
      }

      // --- LINE ITEMS TABLE ---
      doc.fontSize(10).font("Helvetica-Bold").text("Line Items", 50);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);

      // Table header
      const tableTop = doc.y;
      const colX = {
        num: 50,
        product: 70,
        qty: 280,
        listPrice: 320,
        unitPrice: 380,
        discount: 440,
        total: 490,
      };

      doc.fontSize(8).font("Helvetica-Bold");
      doc.text("#", colX.num, tableTop, { width: 20 });
      doc.text("Product", colX.product, tableTop, { width: 200 });
      doc.text("Qty", colX.qty, tableTop, { width: 40, align: "right" });
      doc.text("List Price", colX.listPrice, tableTop, {
        width: 55,
        align: "right",
      });
      doc.text("Unit Price", colX.unitPrice, tableTop, {
        width: 55,
        align: "right",
      });
      doc.text("Disc %", colX.discount, tableTop, {
        width: 40,
        align: "right",
      });
      doc.text("Total", colX.total, tableTop, { width: 55, align: "right" });

      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);

      // Table rows
      doc.font("Helvetica").fontSize(8);
      quote.lineItems.forEach((item, index) => {
        const rowY = doc.y;

        // Check if we need a new page
        if (rowY > 700) {
          doc.addPage();
        }

        const currentY = doc.y;
        doc.text(`${index + 1}`, colX.num, currentY, { width: 20 });
        doc.text(
          item.product?.name || `Product #${item.productId}`,
          colX.product,
          currentY,
          { width: 200 }
        );
        doc.text(`${item.quantity}`, colX.qty, currentY, {
          width: 40,
          align: "right",
        });
        doc.text(
          `${Number(item.listPrice).toFixed(2)}`,
          colX.listPrice,
          currentY,
          { width: 55, align: "right" }
        );
        doc.text(
          `${Number(item.unitPrice).toFixed(2)}`,
          colX.unitPrice,
          currentY,
          { width: 55, align: "right" }
        );
        doc.text(
          `${Number(item.discount).toFixed(2)}`,
          colX.discount,
          currentY,
          { width: 40, align: "right" }
        );
        doc.text(
          `${Number(item.totalPrice).toFixed(2)}`,
          colX.total,
          currentY,
          { width: 55, align: "right" }
        );
        doc.moveDown(0.5);
      });

      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      // --- PRICING SUMMARY ---
      const summaryX = 380;
      const summaryValX = 490;
      const summaryWidth = 55;

      doc.font("Helvetica").fontSize(9);
      doc.text("Subtotal:", summaryX, doc.y, { width: 100 });
      doc.text(
        `${Number(quote.subtotal).toFixed(2)}`,
        summaryValX,
        doc.y - doc.currentLineHeight(),
        { width: summaryWidth, align: "right" }
      );
      doc.moveDown(0.3);

      if (Number(quote.discount) > 0) {
        doc.text(
          `Discount (${Number(quote.discountPercent).toFixed(2)}%):`,
          summaryX,
          doc.y,
          { width: 100 }
        );
        doc.text(
          `-${Number(quote.discount).toFixed(2)}`,
          summaryValX,
          doc.y - doc.currentLineHeight(),
          { width: summaryWidth, align: "right" }
        );
        doc.moveDown(0.3);
      }

      if (Number(quote.taxAmount) > 0) {
        doc.text(
          `Tax (${Number(quote.taxPercent).toFixed(2)}%):`,
          summaryX,
          doc.y,
          { width: 100 }
        );
        doc.text(
          `${Number(quote.taxAmount).toFixed(2)}`,
          summaryValX,
          doc.y - doc.currentLineHeight(),
          { width: summaryWidth, align: "right" }
        );
        doc.moveDown(0.3);
      }

      if (Number(quote.shippingAmount) > 0) {
        doc.text("Shipping:", summaryX, doc.y, { width: 100 });
        doc.text(
          `${Number(quote.shippingAmount).toFixed(2)}`,
          summaryValX,
          doc.y - doc.currentLineHeight(),
          { width: summaryWidth, align: "right" }
        );
        doc.moveDown(0.3);
      }

      doc.moveTo(summaryX, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(10);
      doc.text("Grand Total:", summaryX, doc.y, { width: 100 });
      doc.text(
        `${Number(quote.grandTotal).toFixed(2)}`,
        summaryValX,
        doc.y - doc.currentLineHeight(),
        { width: summaryWidth, align: "right" }
      );
      doc.moveDown(1.5);

      // --- TERMS & NOTES ---
      doc.font("Helvetica").fontSize(9);
      if (quote.paymentTerms) {
        doc.font("Helvetica-Bold").text("Payment Terms:", 50);
        doc.font("Helvetica").text(quote.paymentTerms, 50);
        doc.moveDown(0.5);
      }
      if (quote.deliveryTerms) {
        doc.font("Helvetica-Bold").text("Delivery Terms:", 50);
        doc.font("Helvetica").text(quote.deliveryTerms, 50);
        doc.moveDown(0.5);
      }
      if (quote.notes) {
        doc.font("Helvetica-Bold").text("Notes:", 50);
        doc.font("Helvetica").text(quote.notes, 50);
        doc.moveDown(0.5);
      }

      // --- FOOTER ---
      doc.fontSize(8).font("Helvetica").fillColor("gray");
      doc.text(
        `Generated on ${new Date().toLocaleString()}`,
        50,
        doc.page.height - 50,
        { align: "center", width: 495 }
      );

      doc.end();
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  /**
   * POST /api/quotes/:id/submit-for-approval
   * Submit a DRAFT quote for internal approval (ADMIN only)
   * Body: { requestedToId: number, comment?: string }
   * Sets quote status to IN_REVIEW and creates an ApprovalProcess record
   */
  async submitForApproval(req: Request, res: Response) {
    const operation = "Submit quote for approval";
    try {
      const quoteId = this.parseId(req.params.id, res, "Quote ID", operation);
      if (quoteId === null) return;

      const userId = req.user!.id;
      const { requestedToId, comment } = req.body;

      if (!requestedToId) {
        return handleValidationError(
          res,
          "requestedToId is required",
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

      // Transactionally: set quote to IN_REVIEW + create ApprovalProcess
      const approval = await prisma.$transaction(async tx => {
        const newApproval = await tx.approvalProcess.create({
          data: {
            targetObjectName: "QUOTE",
            targetRecordId: quoteId,
            requestedToId: parsedRequestedToId,
            createdById: userId,
            comment: comment || null,
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

        await tx.quote.update({
          where: { id: quoteId },
          data: { status: "IN_REVIEW" },
        });

        return newApproval;
      });

      // Notify approver (fire-and-forget)
      const requester = await prisma.user.findUnique({ where: { id: userId } });
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
        .catch(err =>
          console.error("[Quote] Failed to send approval request email:", err)
        );

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
      handleError(error, res, operation);
    }
  }

  /**
   * POST /api/quotes/:id/send
   * Send an APPROVED quote to the client via email (ADMIN only)
   * Generates PDF, uploads to S3, sends email with inline summary + download link
   * Body: { to: string, subject?: string, message?: string, cc?: string[], bcc?: string[] }
   * Sets quote status to PRESENTED on success
   */
  async sendToClient(req: Request, res: Response) {
    const operation = "Send quote to client";
    try {
      const quoteId = this.parseId(req.params.id, res, "Quote ID", operation);
      if (quoteId === null) return;

      const { to, subject, message, cc, bcc } = req.body;

      if (!to || typeof to !== "string" || !to.includes("@")) {
        return handleValidationError(
          res,
          "A valid recipient email (to) is required",
          "to",
          operation
        );
      }

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
          account: { select: { id: true, name: true } },
          contact: {
            select: { id: true, name: true, email: true, phone: true },
          },
          preparedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          opportunity: {
            select: { id: true, name: true, opportunityNumber: true },
          },
          lineItems: {
            orderBy: { sortOrder: "asc" },
            include: {
              product: { select: { id: true, name: true, code: true } },
            },
          },
        },
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

      // --- Generate PDF buffer ---
      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: "A4" });
        const chunks: Buffer[] = [];

        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        // Header
        doc
          .fontSize(20)
          .font("Helvetica-Bold")
          .text("QUOTE", { align: "center" });
        doc.moveDown(0.5);
        doc
          .fontSize(12)
          .font("Helvetica")
          .text(quote.quoteNumber, { align: "center" });
        doc.moveDown(1);

        // Quote info
        doc.fontSize(10).font("Helvetica-Bold").text("Quote Details");
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.3);
        doc.font("Helvetica").fontSize(9);
        const infoY = doc.y;
        doc.text(`Name: ${quote.name}`, 50, infoY);
        doc.text(`Status: ${quote.status}`, 50);
        doc.text(`Version: ${quote.version}`, 50);
        doc.text(
          `Valid Until: ${quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : "N/A"}`,
          50
        );
        doc.text(
          `Date: ${new Date(quote.createdAt).toLocaleDateString()}`,
          300,
          infoY
        );
        doc.text(`Opportunity: ${quote.opportunity.name}`, 300);
        doc.text(`Account: ${quote.account.name}`, 300);
        doc.moveDown(1);

        // Customer info
        if (quote.contact) {
          doc.fontSize(10).font("Helvetica-Bold").text("Customer");
          doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(0.3);
          doc.font("Helvetica").fontSize(9);
          doc.text(`Contact: ${quote.contact.name}`, 50);
          if (quote.contact.email)
            doc.text(`Email: ${quote.contact.email}`, 50);
          if (quote.contact.phone)
            doc.text(`Phone: ${quote.contact.phone}`, 50);
          doc.moveDown(1);
        }

        // Line items
        doc.fontSize(10).font("Helvetica-Bold").text("Line Items");
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.3);
        const tableTop = doc.y;
        const colX = {
          num: 50,
          product: 70,
          qty: 280,
          unitPrice: 330,
          discount: 410,
          total: 470,
        };
        doc.fontSize(8).font("Helvetica-Bold");
        doc.text("#", colX.num, tableTop, { width: 20 });
        doc.text("Product", colX.product, tableTop, { width: 200 });
        doc.text("Qty", colX.qty, tableTop, { width: 45, align: "right" });
        doc.text("Unit Price", colX.unitPrice, tableTop, {
          width: 70,
          align: "right",
        });
        doc.text("Disc %", colX.discount, tableTop, {
          width: 50,
          align: "right",
        });
        doc.text("Total", colX.total, tableTop, { width: 75, align: "right" });
        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.3);
        doc.font("Helvetica").fontSize(8);
        quote.lineItems.forEach((item, index) => {
          if (doc.y > 700) doc.addPage();
          const rowY = doc.y;
          doc.text(`${index + 1}`, colX.num, rowY, { width: 20 });
          doc.text(
            item.product?.name || `Product #${item.productId}`,
            colX.product,
            rowY,
            { width: 200 }
          );
          doc.text(`${item.quantity}`, colX.qty, rowY, {
            width: 45,
            align: "right",
          });
          doc.text(
            `${Number(item.unitPrice).toFixed(2)}`,
            colX.unitPrice,
            rowY,
            { width: 70, align: "right" }
          );
          doc.text(`${Number(item.discount).toFixed(2)}`, colX.discount, rowY, {
            width: 50,
            align: "right",
          });
          doc.text(`${Number(item.totalPrice).toFixed(2)}`, colX.total, rowY, {
            width: 75,
            align: "right",
          });
          doc.moveDown(0.5);
        });
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        // Totals
        const sumX = 380;
        const sumValX = 470;
        doc.font("Helvetica").fontSize(9);
        doc.text("Subtotal:", sumX, doc.y, { width: 85 });
        doc.text(
          `${Number(quote.subtotal).toFixed(2)}`,
          sumValX,
          doc.y - doc.currentLineHeight(),
          { width: 75, align: "right" }
        );
        doc.moveDown(0.3);
        if (Number(quote.discount) > 0) {
          doc.text(
            `Discount (${Number(quote.discountPercent).toFixed(2)}%):`,
            sumX,
            doc.y,
            { width: 85 }
          );
          doc.text(
            `-${Number(quote.discount).toFixed(2)}`,
            sumValX,
            doc.y - doc.currentLineHeight(),
            { width: 75, align: "right" }
          );
          doc.moveDown(0.3);
        }
        if (Number(quote.taxAmount) > 0) {
          doc.text(
            `Tax (${Number(quote.taxPercent).toFixed(2)}%):`,
            sumX,
            doc.y,
            { width: 85 }
          );
          doc.text(
            `${Number(quote.taxAmount).toFixed(2)}`,
            sumValX,
            doc.y - doc.currentLineHeight(),
            { width: 75, align: "right" }
          );
          doc.moveDown(0.3);
        }
        if (Number(quote.shippingAmount) > 0) {
          doc.text("Shipping:", sumX, doc.y, { width: 85 });
          doc.text(
            `${Number(quote.shippingAmount).toFixed(2)}`,
            sumValX,
            doc.y - doc.currentLineHeight(),
            { width: 75, align: "right" }
          );
          doc.moveDown(0.3);
        }
        doc.moveTo(sumX, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").fontSize(10);
        doc.text("Grand Total:", sumX, doc.y, { width: 85 });
        doc.text(
          `${Number(quote.grandTotal).toFixed(2)}`,
          sumValX,
          doc.y - doc.currentLineHeight(),
          { width: 75, align: "right" }
        );
        doc.moveDown(1.5);

        // Terms
        doc.font("Helvetica").fontSize(9);
        if (quote.paymentTerms) {
          doc.font("Helvetica-Bold").text("Payment Terms:", 50);
          doc.font("Helvetica").text(quote.paymentTerms, 50);
          doc.moveDown(0.5);
        }
        if (quote.deliveryTerms) {
          doc.font("Helvetica-Bold").text("Delivery Terms:", 50);
          doc.font("Helvetica").text(quote.deliveryTerms, 50);
          doc.moveDown(0.5);
        }
        if (quote.notes) {
          doc.font("Helvetica-Bold").text("Notes:", 50);
          doc.font("Helvetica").text(quote.notes, 50);
          doc.moveDown(0.5);
        }

        doc.fontSize(8).font("Helvetica").fillColor("gray");
        doc.text(
          `Generated on ${new Date().toLocaleString()}`,
          50,
          doc.page.height - 50,
          { align: "center", width: 495 }
        );
        doc.end();
      });

      // --- Upload PDF to S3 ---
      const s3Result = await uploadToS3(pdfBuffer, {
        folder: "quotes",
        filename: `${quote.quoteNumber}.pdf`,
        contentType: "application/pdf",
        publicRead: true,
      });

      // --- Update quote: save pdfUrl + set PRESENTED status ---
      const contactName = quote.contact?.name ?? quote.account.name;
      await prisma.quote.update({
        where: { id: quoteId },
        data: {
          pdfUrl: s3Result.publicUrl,
          status: "PRESENTED",
          presentedAt: new Date(),
        },
      });

      // --- Send email to client ---
      const sent = await emailService.sendQuoteEmail({
        to,
        contactName,
        subject: subject || undefined,
        message: message || undefined,
        cc: Array.isArray(cc) ? cc : undefined,
        bcc: Array.isArray(bcc) ? bcc : undefined,
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
          pdfUrl: s3Result.publicUrl,
          lineItems: quote.lineItems.map(item => ({
            productName: item.product?.name ?? `Product #${item.productId}`,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount),
            totalPrice: Number(item.totalPrice),
          })),
        },
      });

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
        pdfUrl: s3Result.publicUrl,
        emailSent: sent,
      });
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  /**
   * GET /api/quotes/:id
   * Get all quotes for a specific opportunity (paginated)
   * :id here is the opportunity ID
   */
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

      // Verify the opportunity exists
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        select: { id: true, deletedAt: true },
      });

      if (!opportunity || opportunity.deletedAt) {
        return handleNotFoundError(res, "Opportunity", operation);
      }

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

      // Extract optional filters
      const { status } = req.query;

      // Build where clause
      const whereClause: any = {
        opportunityId,
      };

      if (status) {
        const statusArray = status.toString().split(",");
        whereClause.status =
          statusArray.length === 1 ? statusArray[0] : { in: statusArray };
      }

      // Execute count query
      const totalItems = await prisma.quote.count({ where: whereClause });

      // Execute paginated query
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

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      // Return standardized pagination response
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
