/**
 * Application email.
 *
 * Transport only: every message body is rendered by the shared shell in
 * `emailTemplate.ts`, so this file decides what an email says and never how
 * it looks.
 *
 * Delivery goes through Resend, the same path as the sign-in codes and
 * security alerts. One provider means one sending domain, one reputation to
 * maintain, and one dashboard to look in when someone says an email never
 * arrived.
 */
import {
  EMAIL_COLORS,
  EMAIL_FONT_STACKS,
  renderEmail,
  type EmailRow,
} from "./emailTemplate.js";
import { sendResendEmail, type ResendAttachment } from "./resendClient.js";

interface EmailOptions {
  to: string;
  subject: string;
  /** Rendered HTML. A plain-text part is derived from it automatically. */
  body: string;
  /** Retained for call-site compatibility; Resend takes the name from `from`. */
  name?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Record<string, { content: string; mime: string }>;
  /** Groups the send in Resend's dashboard. */
  category?: string;
}

interface UserCreationEmailData {
  name: string;
  email: string;
  password: string;
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

  /**
   * Sends one message, reporting success as a boolean.
   *
   * Callers decide how much a failure matters — a lead-assignment notice can
   * be dropped, a password-reset code cannot — so this never throws. It does
   * always log, with Resend's message id on success and the reason on
   * failure, because a send that vanishes without either is untraceable.
   */
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
      });
      console.log("Email sent", {
        to: options.to,
        subject: options.subject,
        messageId: id,
      });
      return true;
    } catch (error) {
      console.error("Email delivery failed", {
        to: options.to,
        subject: options.subject,
        error: error instanceof Error ? error.message : "Unknown Resend error",
      });
      return false;
    }
  }
  /**
   * Sends a newly created user their credentials.
   *
   * The password is deliberately in the metadata rows rather than the prose:
   * it is a value to be copied, and the mono rows are where this shell puts
   * values.
   */
  async sendUserCreationEmail(data: UserCreationEmailData): Promise<boolean> {
    const rows: EmailRow[] = [
      { label: "Account ID", value: data.email },
      { label: "Temporary password", value: data.password },
      { label: "Role", value: data.role },
    ];

    const body = renderEmail({
      preview: "Your Ralli Wolf Operations account is ready.",
      eyebrow: "Account created",
      heading: "Your account is ready",
      paragraphs: [
        `Hi ${data.name}, an administrator has created your Ralli Wolf Operations account. Sign in with the credentials below.`,
        "Change your password as soon as you are in. It is temporary, and it should not be shared with anyone.",
      ],
      rowsLabel: "Your credentials",
      rows,
      footer:
        "If you were not expecting this account, contact your system administrator.",
    });

    return await this.sendEmail({
      to: data.email,
      subject: "Your Ralli Wolf Operations account details",
      body,
      name: data.name,
    });
  }

  /** Sends the one-time code that authorises a password reset. */
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

  /**
   * Tells a sales user that leads have landed in their queue.
   *
   * Says what landed and leaves it there. These emails carry no link back
   * into the app by design.
   */
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

  /** Login code for the Aakraman order-booking flow. */
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

  /** Notifies an approver that something is waiting on their decision. */
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

  /**
   * Reports an approval decision back to whoever raised it.
   *
   * The shell carries one accent, so the outcome is stated in the copy and in
   * a Decision row rather than being encoded in a colour the reader has to
   * interpret.
   */
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

  /**
   * Sends an approved quote to the client.
   *
   * The line items and totals are the one body in this file that is genuinely
   * structured rather than prose, so they go through the shell's `bodyHtml`
   * slot. Everything interpolated into them is escaped here, which is the
   * condition that slot comes with.
   */
  /**
   * Sends a purchase order to the supplier.
   *
   * The only email in this file addressed to someone outside the business, so
   * it states the order plainly and asks for one thing back: confirmation.
   * Amounts are the ordered ones — this is the document the supplier will
   * invoice against, so it must match what was approved.
   */
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
    });
  }

  async sendQuoteEmail(data: {
    to: string;
    contactName: string;
    subject?: string;
    message?: string;
    cc?: string[];
    bcc?: string[];
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
      pdfUrl: string;
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
        value: new Date(quote.validUntil).toLocaleDateString("en-IN"),
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
    // The PDF address is given as a value rather than a link. It is the one
    // thing in here the reader may need to fetch, so it is stated plainly and
    // can be copied; nothing in these emails is clickable by design.
    if (quote.pdfUrl) {
      rows.push({ label: "Quote PDF", value: quote.pdfUrl });
    }

    const body = renderEmail({
      preview: `Quote ${quote.quoteNumber} — ${money(quote.grandTotal)}`,
      eyebrow: "Quotation",
      heading: `Quote ${quote.quoteNumber}`,
      paragraphs: [
        `Dear ${data.contactName},`,
        data.message ||
          "Please find your quote below. The address of the full PDF is in the quote details underneath the totals.",
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
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
