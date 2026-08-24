import { NotificationType } from "@prisma/client";

import { appUrl, escapeHtml, renderEmail } from "./emailTemplate.js";

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
  /** App-relative path from the notification, e.g. "/purchasing/orders/12". */
  link?: string | null;
};

export type NotificationEmail = { subject: string; html: string };

/** Turns a stored relative link into an absolute one for the inbox. */
function absolute(link?: string | null): string {
  const base = appUrl();
  if (!link) return base;
  return link.startsWith("http")
    ? link
    : `${base}${link.startsWith("/") ? "" : "/"}${link}`;
}

function greeting(name: string): string {
  const trimmed = name.trim();
  return trimmed ? `Hi ${trimmed},` : "Hi,";
}

type Shape = {
  /** Small mono line above the headline. */
  eyebrow: string;
  /** Subject line, given the notification title. */
  subject: (title: string) => string;
  /** Label on the call-to-action button. */
  action: string;
  /** Fine print under the action, explaining why this arrived. */
  footer: string;
  /** Fallback destination when the notification carries no link. */
  fallbackPath: string;
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
    action: "Review the request",
    footer:
      "You receive this because an approval was assigned to you. Nothing proceeds until you decide.",
    fallbackPath: "/sales/approvals",
  },
  PURCHASE_ORDER_APPROVED: {
    eyebrow: "Approved",
    subject: title => title,
    action: "Open the order",
    footer:
      "You receive this because you raised this purchase order. It can now be sent to the supplier.",
    fallbackPath: "/purchasing/orders",
  },
  PURCHASE_ORDER_REJECTED: {
    eyebrow: "Rejected",
    subject: title => title,
    action: "Open the order",
    footer:
      "You receive this because you raised this purchase order. It will not proceed until it is revised and resubmitted.",
    fallbackPath: "/purchasing/orders",
  },
  QC_FAILED: {
    eyebrow: "Quality check",
    subject: title => title,
    action: "Open the goods receipt",
    footer:
      "You receive this because you administer goods receipts. Rejected stock is held until it is dispositioned.",
    fallbackPath: "/purchasing/quality",
  },
  STOCK_ALERT: {
    eyebrow: "Inventory",
    subject: title => `Inventory alerts need attention`,
    action: "Review the alerts",
    footer:
      "You receive this because stock fell below its reorder point. Raising a requisition clears the alert.",
    fallbackPath: "/inventory/alerts",
  },

  // Defined in the schema but not emitted anywhere yet. They are given a
  // neutral shape so that the day one of them starts firing it still produces
  // a correct email rather than throwing — see NOTIFICATION_CATALOGUE, which
  // is what actually decides who can be notified.
  LEAD_ASSIGNED: {
    eyebrow: "Leads",
    subject: title => title,
    action: "Open the lead",
    footer: "You receive this because a lead was assigned to you.",
    fallbackPath: "/leads/assigned",
  },
  LEAD_UPDATED: {
    eyebrow: "Leads",
    subject: title => title,
    action: "Open the lead",
    footer: "You receive this because a lead you own changed.",
    fallbackPath: "/leads/lead-master",
  },
  APPROVAL_APPROVED: {
    eyebrow: "Approved",
    subject: title => title,
    action: "Open the record",
    footer: "You receive this because you raised this request.",
    fallbackPath: "/sales/approvals",
  },
  APPROVAL_REJECTED: {
    eyebrow: "Rejected",
    subject: title => title,
    action: "Open the record",
    footer: "You receive this because you raised this request.",
    fallbackPath: "/sales/approvals",
  },
  QUOTE_ACCEPTED: {
    eyebrow: "Quotes",
    subject: title => title,
    action: "Open the quote",
    footer: "You receive this because you own this quote.",
    fallbackPath: "/sales/quotes",
  },
  ORDER_CREATED: {
    eyebrow: "Orders",
    subject: title => title,
    action: "Open the order",
    footer: "You receive this because you own this order.",
    fallbackPath: "/sales/orders",
  },
  GOODS_RECEIVED: {
    eyebrow: "Purchasing",
    subject: title => title,
    action: "Open the goods receipt",
    footer: "You receive this because goods arrived against your order.",
    fallbackPath: "/purchasing/goods-receipts",
  },
  MATERIAL_SHORTAGE: {
    eyebrow: "Materials",
    subject: title => title,
    action: "Review the shortage",
    footer: "You receive this because a production order is short of material.",
    fallbackPath: "/materials/shortages",
  },
  GENERAL: {
    eyebrow: "Notification",
    subject: title => title,
    action: "Open Ralli Wolf Operations",
    footer: "You receive this because it concerns your account.",
    fallbackPath: "/",
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
  const href = input.link
    ? absolute(input.link)
    : `${appUrl()}${shape.fallbackPath}`;

  // Deliberately no metadata rows: the only structured value available is the
  // title, and the shell already sets that as the heading. A "Details" block
  // repeating it verbatim reads as filler.
  const html = renderEmail({
    preview: input.message,
    eyebrow: shape.eyebrow,
    heading: input.title,
    paragraphs: [greeting(input.recipientName), input.message],
    button: { label: shape.action, href },
    note: "If the button does not work, copy this link into your browser: " + escapeHtml(href),
    footer: `${shape.footer} You can change which notifications reach you in Settings → Notifications.`,
  });

  return { subject: shape.subject(input.title), html };
}
