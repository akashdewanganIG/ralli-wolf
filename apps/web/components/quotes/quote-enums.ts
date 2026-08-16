export const QUOTE_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "NEEDS_REVISION",
  "APPROVED",
  "DENIED",
  "PRESENTED",
  "ACCEPTED",
  "REJECTED",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
