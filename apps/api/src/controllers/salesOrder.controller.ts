import { Request, Response } from "express";
import { prisma } from "@repo/db";
import PDFDocument from "pdfkit";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
} from "../utils/errorHandler.js";

export class SalesOrderController {
  /**
   * GET /api/sales-orders
   * List all sales orders (paginated)
   */
  async getAllSalesOrders(req: Request, res: Response) {
    const operation = "List sales orders";
    try {
      const pageParam = req.query.page as string;
      const limitParam = req.query.limit as string;
      const page = Math.max(1, parseInt(pageParam) || 1);
      const requestedLimit = parseInt(limitParam);
      const limit =
        requestedLimit >= 1 && requestedLimit <= 100 ? requestedLimit : 10;
      const skip = (page - 1) * limit;

      const totalItems = await prisma.salesOrder.count();

      const orders = await prisma.salesOrder.findMany({
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
          createdAt: true,
          account: {
            select: { id: true, name: true },
          },
          owner: {
            select: { firstName: true, lastName: true },
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
   * GET /api/sales-orders/:id/get-order-details
   * Get complete order details by ID
   */
  async getOrderDetails(req: Request, res: Response) {
    const operation = "Get Order Details";
    try {
      const orderId = this.parseId(
        req.params.id,
        res,
        "Sales Order ID",
        operation
      );
      if (orderId === null) return;

      const order = await prisma.salesOrder.findUnique({
        where: { id: orderId },
        include: {
          lineItems: {
            orderBy: { sortOrder: "asc" },
            include: {
              product: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          quote: {
            select: {
              id: true,
              quoteNumber: true,
              status: true,
              opportunity: {
                select: { id: true, name: true },
              },
            },
          },
          account: {
            select: { id: true, name: true },
          },
          contact: {
            select: { id: true, name: true, email: true, phone: true },
          },
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          approvedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      if (!order) {
        return handleNotFoundError(res, "Sales Order", operation);
      }

      return res.json({ data: order });
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  /**
   * GET /api/sales-orders/:id/line-items
   * Get line items for a sales order
   */
  async getLineItems(req: Request, res: Response) {
    const operation = "Get Line Items";
    try {
      const orderId = this.parseId(
        req.params.id,
        res,
        "Sales Order ID",
        operation
      );
      if (orderId === null) return;

      const order = await prisma.salesOrder.findUnique({
        where: { id: orderId },
        select: { id: true },
      });

      if (!order) {
        return handleNotFoundError(res, "Sales Order", operation);
      }

      const lineItems = await prisma.salesOrderLineItem.findMany({
        where: { salesOrderId: orderId },
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            select: { id: true, name: true, code: true },
          },
        },
      });

      return res.json({ data: lineItems });
    } catch (error) {
      handleError(error, res, operation);
    }
  }

  /**
   * GET /api/sales-orders/:id/pdf
   * Generate a PDF document for the sales order
   */
  async generatePdf(req: Request, res: Response) {
    const operation = "Generate sales order PDF";
    try {
      const orderId = this.parseId(
        req.params.id,
        res,
        "Sales Order ID",
        operation
      );
      if (orderId === null) return;

      const order = await prisma.salesOrder.findUnique({
        where: { id: orderId },
        include: {
          account: { select: { id: true, name: true } },
          contact: {
            select: { id: true, name: true, email: true, phone: true },
          },
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          quote: { select: { id: true, quoteNumber: true } },
          lineItems: {
            orderBy: { sortOrder: "asc" },
            include: {
              product: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });

      if (!order) {
        return handleNotFoundError(res, "Sales Order", operation);
      }

      // Create PDF document
      const doc = new PDFDocument({ margin: 50, size: "A4" });

      // Set response headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${order.orderNumber}.pdf"`
      );
      doc.pipe(res);

      // --- HEADER ---
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("SALES ORDER", { align: "center" });
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .font("Helvetica")
        .text(order.orderNumber, { align: "center" });
      doc.moveDown(1);

      // --- ORDER INFO ---
      doc.fontSize(10).font("Helvetica-Bold").text("Order Details");
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);

      doc.font("Helvetica").fontSize(9);
      const infoStartY = doc.y;
      // Left column
      doc.text(`Name: ${order.name}`, 50, infoStartY);
      doc.text(`Status: ${order.status}`, 50);
      doc.text(
        `Order Date: ${new Date(order.orderDate).toLocaleDateString()}`,
        50
      );
      doc.text(`Quote: ${order.quote?.quoteNumber || "N/A"}`, 50);

      // Right column
      doc.text(
        `Created: ${new Date(order.createdAt).toLocaleDateString()}`,
        300,
        infoStartY
      );
      doc.text(
        `Expected Ship: ${order.expectedShipDate ? new Date(order.expectedShipDate).toLocaleDateString() : "N/A"}`,
        300
      );
      doc.text(
        `Expected Delivery: ${order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString() : "N/A"}`,
        300
      );
      doc.text(
        `Actual Ship: ${order.actualShipDate ? new Date(order.actualShipDate).toLocaleDateString() : "N/A"}`,
        300
      );
      doc.moveDown(1);

      // --- CUSTOMER INFO ---
      const custY = doc.y;
      doc.fontSize(10).font("Helvetica-Bold").text("Customer", 50, custY);
      doc.moveTo(50, doc.y).lineTo(290, doc.y).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(9);
      doc.text(`Account: ${order.account.name}`, 50);
      if (order.contact) {
        doc.text(`Contact: ${order.contact.name}`, 50);
        if (order.contact.email) doc.text(`Email: ${order.contact.email}`, 50);
        if (order.contact.phone) doc.text(`Phone: ${order.contact.phone}`, 50);
      }
      const afterCustY = doc.y;

      // --- OWNER ---
      doc.fontSize(10).font("Helvetica-Bold").text("Owner", 300, custY);
      doc.moveTo(300, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(9);
      doc.text(
        `${order.owner.firstName || ""} ${order.owner.lastName || ""}`.trim(),
        300
      );
      if (order.owner.email) doc.text(`${order.owner.email}`, 300);
      doc.y = Math.max(afterCustY, doc.y);
      doc.moveDown(1);

      // --- BILLING & SHIPPING ADDRESS ---
      if (order.billingName || order.shippingName) {
        const addrY = doc.y;
        if (order.billingName) {
          doc
            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Billing Address", 50, addrY);
          doc.moveTo(50, doc.y).lineTo(290, doc.y).stroke();
          doc.moveDown(0.3);
          doc.font("Helvetica").fontSize(9);
          if (order.billingName) doc.text(order.billingName, 50);
          if (order.billingStreet) doc.text(order.billingStreet, 50);
          const billingCityLine = [
            order.billingCity,
            order.billingState,
            order.billingPostalCode,
          ]
            .filter(Boolean)
            .join(", ");
          if (billingCityLine) doc.text(billingCityLine, 50);
          if (order.billingCountry) doc.text(order.billingCountry, 50);
        }
        const afterBillingY = doc.y;

        if (order.shippingName) {
          doc
            .fontSize(10)
            .font("Helvetica-Bold")
            .text("Shipping Address", 300, addrY);
          doc.moveTo(300, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(0.3);
          doc.font("Helvetica").fontSize(9);
          if (order.shippingName) doc.text(order.shippingName, 300);
          if (order.shippingStreet) doc.text(order.shippingStreet, 300);
          const shippingCityLine = [
            order.shippingCity,
            order.shippingState,
            order.shippingPostalCode,
          ]
            .filter(Boolean)
            .join(", ");
          if (shippingCityLine) doc.text(shippingCityLine, 300);
          if (order.shippingCountry) doc.text(order.shippingCountry, 300);
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
      order.lineItems.forEach((item, index) => {
        // Check if we need a new page
        if (doc.y > 700) {
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
        `${Number(order.subtotal).toFixed(2)}`,
        summaryValX,
        doc.y - doc.currentLineHeight(),
        { width: summaryWidth, align: "right" }
      );
      doc.moveDown(0.3);

      if (Number(order.discount) > 0) {
        doc.text(
          `Discount (${Number(order.discountPercent).toFixed(2)}%):`,
          summaryX,
          doc.y,
          { width: 100 }
        );
        doc.text(
          `-${Number(order.discount).toFixed(2)}`,
          summaryValX,
          doc.y - doc.currentLineHeight(),
          { width: summaryWidth, align: "right" }
        );
        doc.moveDown(0.3);
      }

      if (Number(order.taxAmount) > 0) {
        doc.text(
          `Tax (${Number(order.taxPercent).toFixed(2)}%):`,
          summaryX,
          doc.y,
          { width: 100 }
        );
        doc.text(
          `${Number(order.taxAmount).toFixed(2)}`,
          summaryValX,
          doc.y - doc.currentLineHeight(),
          { width: summaryWidth, align: "right" }
        );
        doc.moveDown(0.3);
      }

      if (Number(order.shippingAmount) > 0) {
        doc.text("Shipping:", summaryX, doc.y, { width: 100 });
        doc.text(
          `${Number(order.shippingAmount).toFixed(2)}`,
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
        `${Number(order.grandTotal).toFixed(2)}`,
        summaryValX,
        doc.y - doc.currentLineHeight(),
        { width: summaryWidth, align: "right" }
      );
      doc.moveDown(1.5);

      // --- TERMS & NOTES ---
      doc.font("Helvetica").fontSize(9);
      if (order.paymentTerms) {
        doc.font("Helvetica-Bold").text("Payment Terms:", 50);
        doc.font("Helvetica").text(order.paymentTerms, 50);
        doc.moveDown(0.5);
      }
      if (order.deliveryTerms) {
        doc.font("Helvetica-Bold").text("Delivery Terms:", 50);
        doc.font("Helvetica").text(order.deliveryTerms, 50);
        doc.moveDown(0.5);
      }
      if (order.notes) {
        doc.font("Helvetica-Bold").text("Notes:", 50);
        doc.font("Helvetica").text(order.notes, 50);
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
}
