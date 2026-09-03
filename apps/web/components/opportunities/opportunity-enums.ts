export const OPPORTUNITY_STAGES = [
  "PROSPECT",
  "QUALIFICATION",
  "DISCOVERY",
  "VALUE_PROPOSITION",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const OPPORTUNITY_TYPES = [
  "NEW_CUSTOMER",
  "EXISTING_CUSTOMER_UPGRADE",
  "EXISTING_CUSTOMER_REPLACEMENT",
  "EXISTING_CUSTOMER_DOWNGRADE",
  "RENEWAL",
] as const;

export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const LEAD_SOURCES = [
  "WEBSITE",
  "REFERRAL",
  "COLD_CALL",
  "EMAIL",
  "PARTNER",
  "OTHER",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];
