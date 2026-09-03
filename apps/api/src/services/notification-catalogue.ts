import { NotificationType } from "@prisma/client";

export type NotificationDefinition = {
  type: NotificationType;

  label: string;

  description: string;

  group: "Approvals" | "Purchasing" | "Inventory" | "Finance" | "Your account";

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
    type: NotificationType.PURCHASE_ORDER_SENT,
    label: "Purchase order sent",
    description:
      "A purchase order you raised has been emailed to the supplier.",
    group: "Purchasing",
    supportsEmail: true,
  },
  {
    type: NotificationType.QC_FAILED,
    label: "Quality check failed",
    description: "Inspected goods are rejected or passed only with conditions.",
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
  {
    type: NotificationType.INVOICE_OVERDUE,
    label: "Overdue invoices",
    description:
      "A supplier or customer invoice passes its due date while still unpaid.",
    group: "Finance",
    supportsEmail: true,
  },
  {
    type: NotificationType.ROLE_CHANGED,
    label: "Your role changed",
    description: "An administrator changes what your account can reach.",
    group: "Your account",
    supportsEmail: true,
  },
  {
    type: NotificationType.ACCOUNT_DEACTIVATED,
    label: "Your account was deactivated",
    description:
      "Your access is switched off, so a failed sign-in has an explanation.",
    group: "Your account",
    supportsEmail: true,
  },
] as const;

export const CONFIGURABLE_TYPES: ReadonlySet<NotificationType> = new Set(
  NOTIFICATION_CATALOGUE.map(entry => entry.type)
);

export const NOTIFICATION_DEFAULT = { inApp: true, email: true } as const;

export function definitionFor(
  type: NotificationType
): NotificationDefinition | undefined {
  return NOTIFICATION_CATALOGUE.find(entry => entry.type === type);
}
