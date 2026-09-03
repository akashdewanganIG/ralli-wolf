type JsonRecord = Record<string, unknown>;

const sent: JsonRecord[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
  const [url, init] = args;
  if (String(url).includes("api.resend.com")) {
    const parsed = JSON.parse(String(init?.body ?? "{}")) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error("Resend payload was not an object");
    }
    sent.push(parsed as JsonRecord);
    return new Response(JSON.stringify({ id: "t" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return realFetch(...args);
};

const { emailService } = await import("../src/services/email.service.js");
const sec = await import("../src/services/security-email.service.js");
const otp = await import("../src/services/resend-otp.service.js");
const { buildNotificationEmail } = await import(
  "../src/services/notification-email.js"
);
const { NOTIFICATION_CATALOGUE } = await import(
  "../src/services/notification-catalogue.js"
);
const to = "t@example.test";
const ctx = { ip: "1.2.3.4", userAgent: "UA", at: new Date() };

const cases: Array<[string, () => Promise<unknown>]> = [
  [
    "userCreation",
    () =>
      emailService.sendUserCreationEmail({
        name: "A",
        email: to,
        password: "x",
        role: "ADMIN",
      }),
  ],
  [
    "passwordResetOtp",
    () => emailService.sendPasswordResetOtpEmail(to, "A", "123456"),
  ],
  [
    "leadAssignment",
    () => emailService.sendLeadAssignmentNotificationEmail(to, "A", 2),
  ],
  ["aakramanOtp", () => emailService.sendAakramanOtpEmail(to, "A", "654321")],
  [
    "approvalRequest",
    () =>
      emailService.sendApprovalRequestEmail({
        approverName: "A",
        approverEmail: to,
        requesterName: "B",
        objectType: "Quote",
        objectName: "Q",
        objectNumber: "Q-1",
        approvalId: 1,
      }),
  ],
  [
    "approvalAction",
    () =>
      emailService.sendApprovalActionEmail({
        requesterName: "A",
        requesterEmail: to,
        actorName: "B",
        action: "APPROVED",
        objectType: "Quote",
        objectName: "Q",
        objectNumber: "Q-1",
      }),
  ],
  [
    "quote",
    () =>
      emailService.sendQuoteEmail({
        to,
        contactName: "C",
        quote: {
          quoteNumber: "Q-1",
          name: "Q",
          validUntil: new Date(),
          grandTotal: 1,
          subtotal: 1,
          discount: 0,
          discountPercent: 0,
          taxAmount: 0,
          taxPercent: 0,
          shippingAmount: 0,
          paymentTerms: null,
          deliveryTerms: null,
          notes: null,
          lineItems: [
            {
              productName: "P",
              quantity: 1,
              unitPrice: 1,
              discount: 0,
              totalPrice: 1,
            },
          ],
        },
        pdfAttachment: {
          filename: "Q-1.pdf",
          content: Buffer.from("test pdf").toString("base64"),
        },
      }),
  ],
  [
    "loginAlert",
    () => sec.sendLoginAlertEmail({ to, firstName: "A", context: ctx }),
  ],
  [
    "failedLogin",
    () =>
      sec.sendFailedLoginWarningEmail({
        to,
        firstName: "A",
        attempts: 3,
        stage: "password",
        context: ctx,
      }),
  ],
  [
    "loginOtp",
    () =>
      otp.sendLoginOtpEmail({
        to,
        firstName: "A",
        otp: "111111",
        expiresInMinutes: 10,
        requestId: 1,
      }),
  ],
  [
    "NEW passwordChanged(reset)",
    () =>
      sec.sendPasswordChangedEmail({
        to,
        firstName: "A",
        reason: "reset",
        context: ctx,
      }),
  ],
  [
    "NEW passwordChanged(changed)",
    () =>
      sec.sendPasswordChangedEmail({
        to,
        firstName: "A",
        reason: "changed",
        context: ctx,
      }),
  ],
  [
    "NEW passwordChanged(enabled)",
    () =>
      sec.sendPasswordChangedEmail({
        to,
        firstName: "A",
        reason: "enabled",
        context: ctx,
      }),
  ],
  [
    "NEW authMethodChanged(off)",
    () =>
      sec.sendAuthMethodChangedEmail({
        to,
        firstName: "A",
        method: "Email code",
        action: "disabled",
        remaining: ["Password"],
        context: ctx,
      }),
  ],
  [
    "NEW purchaseOrderToSupplier",
    () =>
      emailService.sendPurchaseOrderEmail({
        to,
        supplierName: "Acme & Co <Ltd>",
        poNumber: "PO-2608-0001",
        orderDate: new Date(),
        expectedDeliveryDate: new Date(),
        currencyCode: "INR",
        subtotal: 1000,
        taxAmount: 180,
        grandTotal: 1180,
        paymentTerms: "Net 30",
        deliverTo: "Main warehouse",
        notes: null,
        lines: [
          {
            description: "Widget <A>",
            quantity: "2.00",
            uom: "NOS",
            unitPrice: "500.00",
            lineTotal: "1000.00",
          },
        ],
      }),
  ],
  [
    "NEW authMethodChanged(on)",
    () =>
      sec.sendAuthMethodChangedEmail({
        to,
        firstName: "A",
        method: "Authenticator app",
        action: "enabled",
        remaining: ["Password", "Authenticator app"],
        context: ctx,
      }),
  ],
];

let bad = 0;
for (const [name, run] of cases) {
  sent.length = 0;
  try {
    await run();
    const o = sent[0];
    const html = String(o?.html ?? ""),
      text = String(o?.text ?? "");
    const p: string[] = [];
    if (!o) p.push("nothing sent");
    else {
      if (/<a[\s>]/i.test(html)) p.push("*** LINK IN EMAIL ***");
      if (/https?:\/\/[^\s"'<]*onrender/i.test(html))
        p.push("*** DEPLOYMENT URL IN EMAIL ***");
      if (!html.includes("<!DOCTYPE html>")) p.push("no doctype");
      if (/undefined|NaN|\[object Object\]/.test(html))
        p.push("undefined/NaN in body");
      if (!o.subject) p.push("no subject");
      if (!text || text.length < 40) p.push("missing text part");
    }
    console.log(p.length ? `✗ ${name}: ${p.join("; ")}` : `✓ ${name}`);
    if (p.length) bad++;
  } catch (error: unknown) {
    console.log(
      `✗ ${name}: THREW ${error instanceof Error ? error.message : "unknown"}`
    );
    bad++;
  }
}
console.log(
  bad
    ? `\n${bad} problem(s)`
    : `
ALL ${cases.length} TEMPLATES CLEAN — no links anywhere`
);

console.log("\n--- notification templates (one per configurable type) ---");
let notifBad = 0;
for (const entry of NOTIFICATION_CATALOGUE) {
  try {
    const built = buildNotificationEmail({
      type: entry.type,
      recipientName: "A",
      title: entry.label,
      message: entry.description,
    });
    const problems: string[] = [];
    if (!built.subject || /undefined/.test(built.subject))
      problems.push("bad subject");
    if (!built.html.includes("<!DOCTYPE html>")) problems.push("no doctype");
    if (/undefined|\[object Object\]/.test(built.html))
      problems.push("undefined in body");
    console.log(
      problems.length
        ? `✗ ${entry.type}: ${problems.join("; ")}`
        : `✓ ${entry.type}`
    );
    if (problems.length) notifBad++;
  } catch (error) {
    console.log(
      `✗ ${entry.type}: THREW ${error instanceof Error ? error.message : "unknown"}`
    );
    notifBad++;
  }
}
console.log(
  notifBad
    ? `\n${notifBad} notification template(s) with problems`
    : `\nALL ${NOTIFICATION_CATALOGUE.length} NOTIFICATION TYPES RENDER`
);
