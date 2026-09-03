import type { LeadSource, LeadStatus } from "./api/types";
import type { SemanticTone } from "@repo/ui/components/ui/status-badge";

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

export const leadStatusTone: Record<string, SemanticTone> = {
  [LeadStatusValue.OPEN]: "progress",
  [LeadStatusValue.WORKING]: "pending",
  [LeadStatusValue.QUALIFIED]: "active",
  [LeadStatusValue.NURTURING]: "neutral",
  [LeadStatusValue.CONVERTED]: "active",
  [LeadStatusValue.UNQUALIFIED]: "danger",
};

export const leadSourceLabels: Record<LeadSource, string> = {
  [LeadSourceValue.MANUAL]: "Manual",
  [LeadSourceValue.IMPORT]: "Import",
  [LeadSourceValue.LANDING_PAGE]: "Landing Page",
};

export function getLeadStatusConfig(
  status: LeadStatus | string | null | undefined
): { tone: SemanticTone; label: string } {
  const raw = status ? String(status).toUpperCase() : LeadStatusValue.OPEN;

  const normalised = raw === "NEW" ? LeadStatusValue.OPEN : raw;
  return {
    tone: leadStatusTone[normalised] ?? "neutral",

    label: normalised,
  };
}

export function getLeadSourceLabel(
  source: LeadSource | string | null | undefined
): string {
  if (!source) return "Unknown source";
  return leadSourceLabels[source as LeadSource] || source;
}
