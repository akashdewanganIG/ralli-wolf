import { NotificationType } from "@prisma/client";

import { renderEmail } from "./emailTemplate.js";

/**
 * The email body for each notification we send.
 *
 * These are the *notification* emails — the ones a user can switch off in
 * settings. They deliberately reuse `renderEmail`, so they carry the same
 * masthead, type scale, and footer as the transactional mail (password reset,
 * account creation) rather than looking like a second system.
 *
 * Every template is built from one notification row, so the copy can only say
 * what the in-app notification already said, plus a link back. That keeps the
 * two channels consistent: nobody gets a richer story by email than they see
 * in the bell menu.
 */
export type NotificationEmailInput = {
  type: NotificationType;
  /** Who it is going to — used for the greeting. */
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
  /** Small mono line above the headline. */
  eyebrow: string;
  /** Subject line, given the notification title. */
  subject: (title: string) => string;
  /** Fine print under the action, explaining why this arrived. */
  footer: string;
};

/**
 * Per-type copy. The body structure is shared; only the framing differs,
 * because the difference that matters to a reader is what happened and where
 * to go — not a different layout each time.
 */
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
    subject: title => `Inventory alerts need attention`,
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
    // Nothing behind the door for a deactivated account, so the button points
    // at the sign-in page rather than somewhere that will bounce them.
    footer:
      "You receive this because your access was switched off. Contact your administrator if you believe this is a mistake.",
  },

  // Defined in the schema but not emitted anywhere yet. They are given a
  // neutral shape so that the day one of them starts firing it still produces
  // a correct email rather than throwing — see NOTIFICATION_CATALOGUE, which
  // is what actually decides who can be notified.
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

/**
 * Builds the email for one notification.
 *
 * Returns the subject and rendered HTML rather than sending, so the caller
 * decides whether the user's preferences allow it — and so this stays testable
 * without a mail provider.
 */
export function buildNotificationEmail(
  input: NotificationEmailInput
): NotificationEmail {
  const shape = SHAPES[input.type] ?? SHAPES.GENERAL;

  // Deliberately no metadata rows: the only structured value available is the
  // title, and the shell already sets that as the heading. A "Details" block
  // repeating it verbatim reads as filler.
  //
  // Deliberately no link either. These emails say what happened; the reader
  // opens the app themselves. A notification that carries a clickable link
  // into the system is also a template for a convincing phishing mail.
  const html = renderEmail({
    preview: input.message,
    eyebrow: shape.eyebrow,
    heading: input.title,
    paragraphs: [greeting(input.recipientName), input.message],
    footer: `${shape.footer} You can change which notifications reach you in Settings → Notifications.`,
  });

  return { subject: shape.subject(input.title), html };
}
