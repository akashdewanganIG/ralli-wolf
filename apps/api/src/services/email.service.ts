import {
  EMAIL_COLORS,
  EMAIL_FONT_STACKS,
  renderEmail,
  type EmailRow,
} from "./email-template.js";
import { sendResendEmail, type ResendAttachment } from "./resend-client.js";
import { logError, logInfo } from "../utils/logger.js";

const INDIAN_DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});

interface EmailOptions {
  to: string;
  subject: string;

  body: string;

  name?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Record<string, { content: string; mime: string }>;

  category?: string;

  idempotencyKey?: string;
}

interface UserInvitationEmailData {
  name: string;
  email: string;
  role: string;
}

class EmailService {
  private escapeHtml(input: string): string {
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const attachments: ResendAttachment[] | undefined = options.attachments
      ? Object.entries(options.attachments).map(([filename, meta]) => ({
          filename,
          content: meta.content,
          contentType: meta.mime,
        }))
      : undefined;

    try {
      const { id } = await sendResendEmail({
        to: options.to,
        subject: options.subject,
        html: options.body,
        category: options.category ?? "application",
        cc: options.cc,
        bcc: options.bcc,
        replyTo: options.replyTo,
        attachments,
        idempotencyKey: options.idempotencyKey,
      });
      logInfo("email_dispatched", {
        category: options.category ?? "application",
        messageId: id,
      });
      return true;
    } catch (error) {
      logError("email_delivery_failed", error, {
        category: options.category ?? "application",
      });
      return false;
    }
  }

  async sendUserInvitationEmail(
    data: UserInvitationEmailData
  ): Promise<boolean> {
    const rows: EmailRow[] = [
      { label: "Account ID", value: data.email },
      { label: "Role", value: data.role },
    ];

    const body = renderEmail({
      preview: "Your Ralli Wolf Operations account is ready.",
      eyebrow: "Account created",
      heading: "Your account is ready",
      paragraphs: [
        `Hi ${data.name}, an administrator has created your Ralli Wolf Operations account.`,
        'Open the sign-in page, choose "Forgot password", and use the one-time code sent to this address to set your private password.',
      ],
      rowsLabel: "Account details",
      rows,
      footer:
        "If you were not expecting this account, contact your system administrator.",
    });

    return await this.sendEmail({
      to: data.email,
      subject: "Set up your Ralli Wolf Operations account",
      body,
      name: data.name,
    });
  }

  async sendPasswordResetOtpEmail(
    email: string,
    name: string,
    otp: string
  ): Promise<boolean> {
    const body = renderEmail({
      preview: `${otp} is your password reset code.`,
      eyebrow: "Password reset",
      heading: "Your password reset code",
      paragraphs: [
        `Hi ${name}, we received a request to reset your password. Use the code below to continue.`,
      ],
      code: otp,
      note: "This code expires in 10 minutes and works once. Never share it with anyone.",
      footer:
        "If you did not request a reset, ignore this email — your password is unchanged.",
    });

    return await this.sendEmail({
      to: email,
      subject: `${otp} is your Ralli Wolf password reset code`,
      body,
      name,
    });
  }

  async sendLeadAssignmentNotificationEmail(
    email: string,
    name: string,
    leadCount: number
  ): Promise<boolean> {
    const plural = leadCount === 1 ? "lead" : "leads";

    const body = renderEmail({
      preview: `${leadCount} new ${plural} assigned to you.`,
      eyebrow: "Lead assignment",
      heading: `${leadCount} new ${plural} assigned to you`,
      paragraphs: [
        `Hi ${name}, ${leadCount} new ${plural} ${leadCount === 1 ? "has" : "have"} been assigned to you. They are waiting in your queue.`,
      ],
      rowsLabel: "Assignment",
      rows: [{ label: "New leads", value: String(leadCount) }],
      footer:
        "You receive this message when leads are assigned to you. Contact your administrator with any questions.",
    });

    return await this.sendEmail({
      to: email,
      subject: `${leadCount} new ${plural} assigned to you`,
      body,
      name,
    });
  }

  async sendAakramanOtpEmail(
    email: string,
    name: string,
    otp: string
  ): Promise<boolean> {
    const body = renderEmail({
      preview: `${otp} is your Aakraman login code.`,
      eyebrow: "Aakraman order booking",
      heading: "Your login code",
      paragraphs: [
        `Hi ${name}, use the code below to sign in to Aakraman order booking.`,
      ],
      code: otp,
      note: "This code expires in 10 minutes. Never share it with anyone.",
      footer: "If you did not request this code, no action is required.",
    });

    return await this.sendEmail({
      to: email,
      subject: `${otp} is your Aakraman login code`,
      body,
      name,
    });
  }

  async sendApprovalRequestEmail(data: {
    approverName: string;
    approverEmail: string;
    requesterName: string;
    objectType: "Opportunity" | "Quote" | "Purchase Order";
    objectName: string;
    objectNumber: string;
    approvalId: number;
  }): Promise<boolean> {
    const rows: EmailRow[] = [
      { label: "Type", value: data.objectType },
      { label: "Reference", value: data.objectNumber },
      { label: "Name", value: data.objectName },
      { label: "Requested by", value: data.requesterName },
      { label: "Approval ID", value: `#${data.approvalId}` },
    ];

    const body = renderEmail({
      preview: `${data.requesterName} needs your approval on ${data.objectNumber}.`,
      eyebrow: "Action required",
      heading: "An approval is waiting on you",
      paragraphs: [
        `Hi ${data.approverName}, ${data.requesterName} has submitted a ${data.objectType.toLowerCase()} for your approval.`,
      ],
      rowsLabel: "Request details",
      rows,
      footer:
        "You receive this message when an approval is assigned to you. Nothing proceeds until you decide.",
    });

    return await this.sendEmail({
      to: data.approverEmail,
      subject: `Action required: ${data.objectType} approval — ${data.objectNumber}`,
      body,
      name: data.approverName,
    });
  }

  async sendApprovalActionEmail(data: {
    requesterName: string;
    requesterEmail: string;
    actorName: string;
    action: "APPROVED" | "REJECTED";
    objectType: "Opportunity" | "Quote" | "Purchase Order";
    objectName: string;
    objectNumber: string;
    comment?: string;
  }): Promise<boolean> {
    const isApproved = data.action === "APPROVED";
    const outcome = isApproved ? "approved" : "rejected";

    const rows: EmailRow[] = [
      { label: "Decision", value: isApproved ? "Approved" : "Rejected" },
      { label: "Reference", value: data.objectNumber },
      { label: "Name", value: data.objectName },
      { label: "Decided by", value: data.actorName },
    ];
    if (data.comment) {
      rows.push({ label: "Comment", value: data.comment });
    }

    const body = renderEmail({
      preview: `${data.objectNumber} was ${outcome}.`,
      eyebrow: "Approval outcome",
      heading: `Your ${data.objectType.toLowerCase()} was ${outcome}`,
      paragraphs: [
        `Hi ${data.requesterName}, your ${data.objectType.toLowerCase()} ${data.objectNumber} has been ${outcome} by ${data.actorName}.`,
      ],
      rowsLabel: "Decision details",
      rows,
      footer:
        "You receive this message when a request you raised has been decided.",
    });

    return await this.sendEmail({
      to: data.requesterEmail,
      subject: `${data.objectType} ${outcome} — ${data.objectNumber}`,
      body,
      name: data.requesterName,
    });
  }

  async sendPurchaseOrderEmail(data: {
    to: string;
    supplierName: string;
    poNumber: string;
    orderDate: Date;
    expectedDeliveryDate?: Date | null;
    currencyCode: string;
    subtotal: number;
    taxAmount: number;
    grandTotal: number;
    paymentTerms?: string | null;
    deliverTo?: string | null;
    notes?: string | null;
    idempotencyKey?: string;
    lines: Array<{
      description: string;
      quantity: string;
      uom?: string | null;
      unitPrice: string;
      lineTotal: string;
    }>;
  }): Promise<boolean> {
    const C = EMAIL_COLORS;
    const F = EMAIL_FONT_STACKS;
    const money = (value: number) => `${data.currencyCode} ${value.toFixed(2)}`;
    const date = (value: Date) =>
      new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeZone: "Asia/Kolkata",
      }).format(value);

    const cell = `padding:8px 10px;border-bottom:1px solid ${C.border};font-family:${F.mono};font-size:12px;color:${C.text};line-height:18px`;
    const head = `padding:0 10px 8px;border-bottom:1px solid ${C.border};font-family:${F.mono};font-size:11px;color:${C.dim};line-height:16px;text-align:left`;

    const rowsHtml = data.lines
      .map(
        line =>
          `<tr><td style="${cell}">${this.escapeHtml(line.description)}</td><td style="${cell};text-align:right">${this.escapeHtml(line.quantity)}${line.uom ? ` ${this.escapeHtml(line.uom)}` : ""}</td><td style="${cell};text-align:right">${this.escapeHtml(line.unitPrice)}</td><td style="${cell};text-align:right">${this.escapeHtml(line.lineTotal)}</td></tr>`
      )
      .join("");

    const bodyHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px">
<tr><th style="${head}">Item</th><th style="${head};text-align:right">Qty</th><th style="${head};text-align:right">Unit price</th><th style="${head};text-align:right">Total</th></tr>
${rowsHtml}
<tr><td colspan="3" style="${cell};text-align:right;color:${C.dim}">Subtotal</td><td style="${cell};text-align:right">${this.escapeHtml(money(data.subtotal))}</td></tr>
<tr><td colspan="3" style="${cell};text-align:right;color:${C.dim}">Tax</td><td style="${cell};text-align:right">${this.escapeHtml(money(data.taxAmount))}</td></tr>
<tr><td colspan="3" style="${cell};text-align:right;font-weight:600">Total</td><td style="${cell};text-align:right;font-weight:600">${this.escapeHtml(money(data.grandTotal))}</td></tr>
</table>`;

    const rows: EmailRow[] = [
      { label: "Order number", value: data.poNumber },
      { label: "Order date", value: date(data.orderDate) },
    ];
    if (data.expectedDeliveryDate) {
      rows.push({
        label: "Required by",
        value: date(data.expectedDeliveryDate),
      });
    }
    if (data.paymentTerms) {
      rows.push({ label: "Payment terms", value: data.paymentTerms });
    }
    if (data.deliverTo) {
      rows.push({ label: "Deliver to", value: data.deliverTo });
    }

    const body = renderEmail({
      preview: `Purchase order ${data.poNumber} from Ralli Wolf Operations.`,
      eyebrow: "Purchase order",
      heading: `Purchase order ${data.poNumber}`,
      paragraphs: [
        `Dear ${data.supplierName}, please find our purchase order below.`,
        ...(data.notes ? [data.notes] : []),
      ],
      bodyHtml,
      note: "Please confirm receipt of this order and the delivery date by replying to this email.",
      rowsLabel: "Order details",
      rows,
      footer:
        "This purchase order is issued by Ralli Wolf Operations. Quote the order number on your invoice and delivery documents.",
    });

    return await this.sendEmail({
      to: data.to,
      subject: `Purchase order ${data.poNumber} from Ralli Wolf Operations`,
      body,
      name: data.supplierName,
      category: "purchase_order",
      idempotencyKey: data.idempotencyKey,
    });
  }

  async sendQuoteEmail(data: {
    to: string;
    contactName: string;
    subject?: string;
    message?: string;
    cc?: string[];
    bcc?: string[];
    idempotencyKey?: string;
    pdfAttachment: {
      filename: string;
      content: string;
    };
    quote: {
      quoteNumber: string;
      name: string;
      validUntil?: Date | null;
      grandTotal: number;
      subtotal: number;
      discount: number;
      discountPercent: number;
      taxAmount: number;
      taxPercent: number;
      shippingAmount: number;
      paymentTerms?: string | null;
      deliveryTerms?: string | null;
      notes?: string | null;
      lineItems: Array<{
        productName: string;
        quantity: number;
        unitPrice: number;
        discount: number;
        totalPrice: number;
      }>;
    };
  }): Promise<boolean> {
    const { quote } = data;
    const C = EMAIL_COLORS;
    const F = EMAIL_FONT_STACKS;
    const money = (value: number) => Number(value).toFixed(2);

    const cell = `padding:8px 10px;border-bottom:1px solid ${C.border};font-family:${F.mono};font-size:12px;color:${C.text};line-height:18px`;
    const head = `padding:0 10px 8px;border-bottom:1px solid ${C.border};font-family:${F.mono};font-size:11px;color:${C.dim};line-height:16px;text-align:left`;

    const lineItems = quote.lineItems
      .map(
        item =>
          `<tr><td style="${cell}">${this.escapeHtml(item.productName)}</td><td style="${cell};text-align:center">${item.quantity}</td><td style="${cell};text-align:right">${money(item.unitPrice)}</td><td style="${cell};text-align:right">${money(item.discount)}%</td><td style="${cell};text-align:right">${money(item.totalPrice)}</td></tr>`
      )
      .join("");

    const totalRow = (label: string, value: string, strong = false) =>
      `<tr><td style="padding:4px 0;font-family:${F.mono};font-size:12px;color:${strong ? C.text : C.dim};line-height:18px">${this.escapeHtml(label)}</td><td style="padding:4px 0;text-align:right;font-family:${F.mono};font-size:${strong ? "14px" : "12px"};font-weight:${strong ? "600" : "400"};color:${C.text};line-height:18px">${this.escapeHtml(value)}</td></tr>`;

    const totals = [
      totalRow("Subtotal", money(quote.subtotal)),
      quote.discount > 0
        ? totalRow(
            `Discount (${money(quote.discountPercent)}%)`,
            `-${money(quote.discount)}`
          )
        : "",
      quote.taxAmount > 0
        ? totalRow(`Tax (${money(quote.taxPercent)}%)`, money(quote.taxAmount))
        : "",
      quote.shippingAmount > 0
        ? totalRow("Shipping", money(quote.shippingAmount))
        : "",
      totalRow("Grand total", money(quote.grandTotal), true),
    ].join("");

    const bodyHtml =
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 24px">` +
      `<tr><th style="${head}">Product</th><th style="${head};text-align:center">Qty</th><th style="${head};text-align:right">Unit</th><th style="${head};text-align:right">Disc</th><th style="${head};text-align:right">Total</th></tr>` +
      `${lineItems}</table>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 24px"><tr><td width="55%"></td><td width="45%">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${totals}</table>` +
      `</td></tr></table>`;

    const rows: EmailRow[] = [
      { label: "Quote reference", value: quote.quoteNumber },
      { label: "Quote name", value: quote.name },
    ];
    if (quote.validUntil) {
      rows.push({
        label: "Valid until",
        value: INDIAN_DATE_FORMATTER.format(new Date(quote.validUntil)),
      });
    }
    if (quote.paymentTerms) {
      rows.push({ label: "Payment terms", value: quote.paymentTerms });
    }
    if (quote.deliveryTerms) {
      rows.push({ label: "Delivery terms", value: quote.deliveryTerms });
    }
    if (quote.notes) {
      rows.push({ label: "Notes", value: quote.notes });
    }
    const body = renderEmail({
      preview: `Quote ${quote.quoteNumber} — ${money(quote.grandTotal)}`,
      eyebrow: "Quotation",
      heading: `Quote ${quote.quoteNumber}`,
      paragraphs: [
        `Dear ${data.contactName},`,
        data.message ||
          "Please find your quote below. The full PDF is attached to this message.",
      ],
      bodyHtml,
      rowsLabel: "Quote details",
      rows,
      footer:
        "Reply to this email if anything in the quote needs changing before you accept it.",
    });

    return await this.sendEmail({
      to: data.to,
      subject:
        data.subject || `Quote ${quote.quoteNumber} from Ralli Wolf Operations`,
      body,
      name: data.contactName,
      cc: data.cc,
      bcc: data.bcc,
      attachments: {
        [data.pdfAttachment.filename]: {
          content: data.pdfAttachment.content,
          mime: "application/pdf",
        },
      },
      category: "quote",
      idempotencyKey: data.idempotencyKey,
    });
  }
}

export const emailService = new EmailService();
