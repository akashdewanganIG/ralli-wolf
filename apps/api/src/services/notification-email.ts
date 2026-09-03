import { NotificationType } from "@prisma/client";

import { renderEmail } from "./email-template.js";

export type NotificationEmailInput = {
  type: NotificationType;

  recipientName: string;
  title: string;
  message: string;
};

export type NotificationEmail = { subject: string; html: string };

function greeting(name: string): string {
  const trimmed = name.trim();
  return trimmed ? `Hi ${trimmed},` : "Hi,";
}

type Shape = {
  eyebrow: string;

  subject: (title: string) => string;

  footer: string;
};

const SHAPES: Record<NotificationType, Shape> = {
  APPROVAL_REQUESTED: {
    eyebrow: "Action required",
    subject: title => `Action required: ${title}`,
    footer:
      "You receive this because an approval was assigned to you. Nothing proceeds until you decide.",
  },
  PURCHASE_ORDER_APPROVED: {
    eyebrow: "Approved",
    subject: title => title,
    footer:
      "You receive this because you raised this purchase order. It can now be sent to the supplier.",
  },
  PURCHASE_ORDER_REJECTED: {
    eyebrow: "Rejected",
    subject: title => title,
    footer:
      "You receive this because you raised this purchase order. It will not proceed until it is revised and resubmitted.",
  },
  QC_FAILED: {
    eyebrow: "Quality check",
    subject: title => title,
    footer:
      "You receive this because you administer goods receipts. Rejected stock is held until it is dispositioned.",
  },
  STOCK_ALERT: {
    eyebrow: "Inventory",
    subject: () => "Inventory alerts need attention",
    footer:
      "You receive this because stock fell below its reorder point. Raising a requisition clears the alert.",
  },

  PURCHASE_ORDER_SENT: {
    eyebrow: "Sent",
    subject: title => title,
    footer:
      "You receive this because you raised this purchase order. The supplier now has it.",
  },
  INVOICE_OVERDUE: {
    eyebrow: "Finance",
    subject: title => title,
    footer:
      "You receive this because an invoice passed its due date while still unpaid.",
  },
  ROLE_CHANGED: {
    eyebrow: "Your account",
    subject: title => title,
    footer:
      "You receive this because an administrator changed what your account can reach. If you did not expect this, contact them.",
  },
  ACCOUNT_DEACTIVATED: {
    eyebrow: "Your account",
    subject: title => title,

    footer:
      "You receive this because your access was switched off. Contact your administrator if you believe this is a mistake.",
  },

  LEAD_ASSIGNED: {
    eyebrow: "Leads",
    subject: title => title,
    footer: "You receive this because a lead was assigned to you.",
  },
  LEAD_UPDATED: {
    eyebrow: "Leads",
    subject: title => title,
    footer: "You receive this because a lead you own changed.",
  },
  APPROVAL_APPROVED: {
    eyebrow: "Approved",
    subject: title => title,
    footer: "You receive this because you raised this request.",
  },
  APPROVAL_REJECTED: {
    eyebrow: "Rejected",
    subject: title => title,
    footer: "You receive this because you raised this request.",
  },
  QUOTE_ACCEPTED: {
    eyebrow: "Quotes",
    subject: title => title,
    footer: "You receive this because you own this quote.",
  },
  ORDER_CREATED: {
    eyebrow: "Orders",
    subject: title => title,
    footer: "You receive this because you own this order.",
  },
  GOODS_RECEIVED: {
    eyebrow: "Purchasing",
    subject: title => title,
    footer: "You receive this because goods arrived against your order.",
  },
  MATERIAL_SHORTAGE: {
    eyebrow: "Materials",
    subject: title => title,
    footer: "You receive this because a production order is short of material.",
  },
  GENERAL: {
    eyebrow: "Notification",
    subject: title => title,
    footer: "You receive this because it concerns your account.",
  },
};

export function buildNotificationEmail(
  input: NotificationEmailInput
): NotificationEmail {
  const shape = SHAPES[input.type] ?? SHAPES.GENERAL;

  const html = renderEmail({
    preview: input.message,
    eyebrow: shape.eyebrow,
    heading: input.title,
    paragraphs: [greeting(input.recipientName), input.message],
    footer: `${shape.footer} You can change which notifications reach you in Settings → Notifications.`,
  });

  return { subject: shape.subject(input.title), html };
}
