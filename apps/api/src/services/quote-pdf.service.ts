import { Prisma } from "@prisma/client";
import PDFDocument from "pdfkit";

export const quotePdfInclude = {
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
    orderBy: { sortOrder: "asc" as const },
    include: {
      product: { select: { id: true, name: true, code: true } },
    },
  },
} satisfies Prisma.QuoteInclude;

export type QuotePdfData = Prisma.QuoteGetPayload<{
  include: typeof quotePdfInclude;
}>;

const quoteDateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});

function formatDate(value: Date | null): string {
  return value ? quoteDateFormatter.format(value) : "N/A";
}

export async function renderQuotePdf(quote: QuotePdfData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const documentDate = quote.approvedAt ?? quote.createdAt;
    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
      info: {
        Title: `Quote ${quote.quoteNumber}`,
        Author: "Ralli Wolf",
        Subject: quote.name,
        CreationDate: documentDate,
        ModDate: documentDate,
      },
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).font("Helvetica-Bold").text("QUOTE", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font("Helvetica")
      .text(quote.quoteNumber, { align: "center" });
    doc.moveDown(1);

    doc.fontSize(10).font("Helvetica-Bold").text("Quote Details");
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);

    doc.font("Helvetica").fontSize(9);
    const infoStartY = doc.y;
    doc.text(`Name: ${quote.name}`, 50, infoStartY);
    doc.text(`Status: ${quote.status}`, 50);
    doc.text(`Version: ${quote.version}`, 50);
    doc.text(`Valid Until: ${formatDate(quote.validUntil)}`, 50);
    doc.text(`Date: ${formatDate(quote.createdAt)}`, 300, infoStartY);
    doc.text(`Opportunity: ${quote.opportunity.name}`, 300);
    doc.text(`Type: ${quote.type}`, 300);
    doc.text(`Primary: ${quote.isPrimary ? "Yes" : "No"}`, 300);
    doc.moveDown(1);

    const customerY = doc.y;
    doc.fontSize(10).font("Helvetica-Bold").text("Customer", 50, customerY);
    doc.moveTo(50, doc.y).lineTo(290, doc.y).stroke();
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9);
    doc.text(`Account: ${quote.account.name}`, 50);
    if (quote.contact) {
      doc.text(`Contact: ${quote.contact.name}`, 50);
      if (quote.contact.email) doc.text(`Email: ${quote.contact.email}`, 50);
      if (quote.contact.phone) doc.text(`Phone: ${quote.contact.phone}`, 50);
    }
    const afterCustomerY = doc.y;

    doc.fontSize(10).font("Helvetica-Bold").text("Prepared By", 300, customerY);
    doc.moveTo(300, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9);
    doc.text(
      `${quote.preparedBy.firstName ?? ""} ${quote.preparedBy.lastName ?? ""}`.trim(),
      300
    );
    doc.y = Math.max(afterCustomerY, doc.y);
    doc.moveDown(1);

    if (quote.billingName || quote.shippingName) {
      const addressY = doc.y;
      if (quote.billingName) {
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .text("Billing Address", 50, addressY);
        doc.moveTo(50, doc.y).lineTo(290, doc.y).stroke();
        doc.moveDown(0.3);
        doc.font("Helvetica").fontSize(9);
        doc.text(quote.billingName, 50);
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
          .text("Shipping Address", 300, addressY);
        doc.moveTo(300, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.3);
        doc.font("Helvetica").fontSize(9);
        doc.text(quote.shippingName, 300);
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

    doc.fontSize(10).font("Helvetica-Bold").text("Line Items", 50);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);

    const columns = {
      num: 50,
      product: 70,
      qty: 280,
      listPrice: 320,
      unitPrice: 380,
      discount: 440,
      total: 490,
    };

    const writeTableHeader = () => {
      const tableTop = doc.y;
      doc.fontSize(8).font("Helvetica-Bold");
      doc.text("#", columns.num, tableTop, { width: 20 });
      doc.text("Product", columns.product, tableTop, { width: 200 });
      doc.text("Qty", columns.qty, tableTop, { width: 40, align: "right" });
      doc.text("List Price", columns.listPrice, tableTop, {
        width: 55,
        align: "right",
      });
      doc.text("Unit Price", columns.unitPrice, tableTop, {
        width: 55,
        align: "right",
      });
      doc.text("Disc %", columns.discount, tableTop, {
        width: 40,
        align: "right",
      });
      doc.text("Total", columns.total, tableTop, {
        width: 55,
        align: "right",
      });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(8);
    };

    writeTableHeader();
    quote.lineItems.forEach((item, index) => {
      if (doc.y > 700) {
        doc.addPage();
        writeTableHeader();
      }

      const rowY = doc.y;
      doc.text(`${index + 1}`, columns.num, rowY, { width: 20 });
      doc.text(
        item.product?.name ?? `Product #${item.productId}`,
        columns.product,
        rowY,
        { width: 200 }
      );
      doc.text(`${item.quantity}`, columns.qty, rowY, {
        width: 40,
        align: "right",
      });
      doc.text(Number(item.listPrice).toFixed(2), columns.listPrice, rowY, {
        width: 55,
        align: "right",
      });
      doc.text(Number(item.unitPrice).toFixed(2), columns.unitPrice, rowY, {
        width: 55,
        align: "right",
      });
      doc.text(Number(item.discount).toFixed(2), columns.discount, rowY, {
        width: 40,
        align: "right",
      });
      doc.text(Number(item.totalPrice).toFixed(2), columns.total, rowY, {
        width: 55,
        align: "right",
      });
      doc.moveDown(0.5);
    });

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);

    const summaryX = 380;
    const summaryValueX = 490;
    const summaryWidth = 55;
    const writeSummaryValue = (label: string, value: string) => {
      doc.text(label, summaryX, doc.y, { width: 100 });
      doc.text(value, summaryValueX, doc.y - doc.currentLineHeight(), {
        width: summaryWidth,
        align: "right",
      });
      doc.moveDown(0.3);
    };

    doc.font("Helvetica").fontSize(9);
    writeSummaryValue("Subtotal:", Number(quote.subtotal).toFixed(2));
    if (Number(quote.discount) > 0) {
      writeSummaryValue(
        `Discount (${Number(quote.discountPercent).toFixed(2)}%):`,
        `-${Number(quote.discount).toFixed(2)}`
      );
    }
    if (Number(quote.taxAmount) > 0) {
      writeSummaryValue(
        `Tax (${Number(quote.taxPercent).toFixed(2)}%):`,
        Number(quote.taxAmount).toFixed(2)
      );
    }
    if (Number(quote.shippingAmount) > 0) {
      writeSummaryValue("Shipping:", Number(quote.shippingAmount).toFixed(2));
    }

    doc.moveTo(summaryX, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(10);
    writeSummaryValue("Grand Total:", Number(quote.grandTotal).toFixed(2));
    doc.moveDown(1.2);

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
      `Generated from approved data dated ${formatDate(documentDate)}`,
      50,
      doc.page.height - 50,
      {
        align: "center",
        width: 495,
      }
    );
    doc.end();
  });
}
