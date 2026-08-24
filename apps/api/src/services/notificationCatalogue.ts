import { NotificationType } from "@prisma/client";

/**
 * The notifications a user can actually receive.
 *
 * `NotificationType` carries more values than this — several were defined
 * ahead of the code that would raise them and nothing emits them yet. Only the
 * ones that are genuinely produced are listed here, because a preference
 * toggle for an event that never fires is a promise the app does not keep.
 * When a dormant type starts being emitted, add it here and it appears in the
 * settings screen, the email router, and the API response together.
 */
export type NotificationDefinition = {
  type: NotificationType;
  /** Sentence-case label shown in the settings list. */
  label: string;
  /** One line explaining when it fires. */
  description: string;
  /** Grouping header in the settings list. */
  group: "Approvals" | "Purchasing" | "Inventory";
  /**
   * Whether an email exists for this type. Everything listed has one today;
   * the flag keeps the UI honest if a future type is in-app only.
   */
  supportsEmail: boolean;
};

export const NOTIFICATION_CATALOGUE: readonly NotificationDefinition[] = [
  {
    type: NotificationType.APPROVAL_REQUESTED,
    label: "Approval requested",
    description:
      "Someone submits a quote, opportunity, or purchase order for you to approve.",
    group: "Approvals",
    supportsEmail: true,
  },
  {
    type: NotificationType.PURCHASE_ORDER_APPROVED,
    label: "Purchase order approved",
    description: "A purchase order you raised is approved and can be sent.",
    group: "Purchasing",
    supportsEmail: true,
  },
  {
    type: NotificationType.PURCHASE_ORDER_REJECTED,
    label: "Purchase order rejected",
    description: "A purchase order you raised is rejected, with the reason.",
    group: "Purchasing",
    supportsEmail: true,
  },
  {
    type: NotificationType.QC_FAILED,
    label: "Quality check failed",
    description:
      "Inspected goods are rejected or passed only with conditions.",
    group: "Purchasing",
    supportsEmail: true,
  },
  {
    type: NotificationType.STOCK_ALERT,
    label: "Inventory alerts",
    description:
      "Stock falls below its reorder point or a critical alert is raised.",
    group: "Inventory",
    supportsEmail: true,
  },
] as const;

/** Types a user can hold a preference for. */
export const CONFIGURABLE_TYPES: ReadonlySet<NotificationType> = new Set(
  NOTIFICATION_CATALOGUE.map(entry => entry.type)
);

/**
 * What a user gets before they have chosen anything.
 *
 * Both channels on: an operations team that misses an approval request because
 * it was silently opted out is worse off than one that turns a channel off
 * deliberately. Absent rows therefore mean "on", and only deviations are
 * stored.
 */
export const NOTIFICATION_DEFAULT = { inApp: true, email: true } as const;

export function definitionFor(
  type: NotificationType
): NotificationDefinition | undefined {
  return NOTIFICATION_CATALOGUE.find(entry => entry.type === type);
}
