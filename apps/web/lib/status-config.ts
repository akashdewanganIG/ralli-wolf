// Central location for lead status badge styles
import type { LeadSource, LeadStatus } from "./api/types";
import { BadgeProps } from "@repo/ui/components/ui/badge";

// Client-safe runtime values mirror the API's schema without pulling
// server-only generated code into browser or edge bundles.
const LeadStatusValue = {
  OPEN: "OPEN",
  WORKING: "WORKING",
  QUALIFIED: "QUALIFIED",
  NURTURING: "NURTURING",
  CONVERTED: "CONVERTED",
  UNQUALIFIED: "UNQUALIFIED",
} as const satisfies Record<string, LeadStatus>;

const LeadSourceValue = {
  MANUAL: "MANUAL",
  IMPORT: "IMPORT",
  LANDING_PAGE: "LANDING_PAGE",
} as const satisfies Record<string, LeadSource>;

export const leadStatusConfig = {
  [LeadStatusValue.OPEN]: {
    label: "OPEN",
    className: "border-info/20 bg-info-surface text-info-foreground",
    variant: "outline",
  },
  [LeadStatusValue.WORKING]: {
    label: "WORKING",
    className: "border-warning/20 bg-warning-surface text-warning-foreground",
    variant: "outline",
  },
  [LeadStatusValue.QUALIFIED]: {
    label: "QUALIFIED",
    className: "border-success/20 bg-success-surface text-success-foreground",
    variant: "outline",
  },
  [LeadStatusValue.NURTURING]: {
    label: "NURTURING",
    className: "border-border bg-secondary text-secondary-foreground",
    variant: "outline",
  },
  [LeadStatusValue.CONVERTED]: {
    label: "CONVERTED",
    className: "border-success/20 bg-success-surface text-success-foreground",
    variant: "outline",
  },
  [LeadStatusValue.UNQUALIFIED]: {
    label: "UNQUALIFIED",
    className: "border-error/20 bg-error-surface text-error-foreground",
    variant: "outline",
  },
};

// Lead source display labels
export const leadSourceLabels: Record<LeadSource, string> = {
  [LeadSourceValue.MANUAL]: "Manual",
  [LeadSourceValue.IMPORT]: "Import",
  [LeadSourceValue.LANDING_PAGE]: "Landing Page",
};

export function getLeadStatusConfig(
  status: LeadStatus | string | null | undefined
) {
  if (!status) {
    // Default to OPEN if status is null/undefined
    return leadStatusConfig[LeadStatusValue.OPEN] as {
      label: string;
      className: string;
      variant: BadgeProps["variant"];
    };
  }

  // Normalize status to uppercase string for comparison
  const statusStr = String(status).toUpperCase();

  // Map string values to enum values (including legacy values like 'New')
  const statusMap: Record<string, LeadStatus> = {
    OPEN: LeadStatusValue.OPEN,
    WORKING: LeadStatusValue.WORKING,
    QUALIFIED: LeadStatusValue.QUALIFIED,
    UNQUALIFIED: LeadStatusValue.UNQUALIFIED,
    NURTURING: LeadStatusValue.NURTURING,
    CONVERTED: LeadStatusValue.CONVERTED,
    NEW: LeadStatusValue.OPEN, // Map legacy 'NEW' to OPEN
    New: LeadStatusValue.OPEN, // Map legacy 'New' to OPEN
  };

  // Try to get the enum value from the map, or use the status directly if it's already an enum
  const enumStatus = statusMap[statusStr] || (status as LeadStatus);

  // Try to find the status in the config
  const config = leadStatusConfig[enumStatus as keyof typeof leadStatusConfig];

  if (config) {
    return config as {
      label: string;
      className: string;
      variant: BadgeProps["variant"];
    };
  }

  // Fallback for unknown status - default to OPEN
  return leadStatusConfig[LeadStatusValue.OPEN] as {
    label: string;
    className: string;
    variant: BadgeProps["variant"];
  };
}

export function getLeadSourceLabel(
  source: LeadSource | string | null | undefined
): string {
  if (!source) return "Unknown source";
  return leadSourceLabels[source as LeadSource] || source;
}
