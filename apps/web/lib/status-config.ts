// Central location for lead status badge styles
import type { LeadSource, LeadStatus } from "./api/types";
import type { SemanticTone } from "@repo/ui/components/ui/status-badge";

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

/**
 * Lead status → shared semantic tone.
 *
 * This used to be a fourth status palette: it stored its own Tailwind classes
 * and UPPERCASE labels, and passed them to `Badge` as a `className` override —
 * which is why Lead Management's tags looked and read differently from every
 * other module's. It now maps to a tone and nothing else; `Tag` owns the
 * appearance and the casing.
 */
export const leadStatusTone: Record<string, SemanticTone> = {
  [LeadStatusValue.OPEN]: "progress",
  [LeadStatusValue.WORKING]: "pending",
  [LeadStatusValue.QUALIFIED]: "active",
  [LeadStatusValue.NURTURING]: "neutral",
  [LeadStatusValue.CONVERTED]: "active",
  [LeadStatusValue.UNQUALIFIED]: "danger",
};

// Lead source display labels
export const leadSourceLabels: Record<LeadSource, string> = {
  [LeadSourceValue.MANUAL]: "Manual",
  [LeadSourceValue.IMPORT]: "Import",
  [LeadSourceValue.LANDING_PAGE]: "Landing Page",
};

export function getLeadStatusConfig(
  status: LeadStatus | string | null | undefined
): { tone: SemanticTone; label: string } {
  const raw = status ? String(status).toUpperCase() : LeadStatusValue.OPEN;
  // 'NEW' is a legacy value that predates the OPEN/WORKING split.
  const normalised = raw === "NEW" ? LeadStatusValue.OPEN : raw;
  return {
    tone: leadStatusTone[normalised] ?? "neutral",
    // Passed through verbatim — `Tag` sentence-cases it, so this stays the
    // single source of the value rather than a second source of the label.
    label: normalised,
  };
}

export function getLeadSourceLabel(
  source: LeadSource | string | null | undefined
): string {
  if (!source) return "Unknown source";
  return leadSourceLabels[source as LeadSource] || source;
}
