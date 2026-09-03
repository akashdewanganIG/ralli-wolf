export const QUOTE_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "PRESENTING",
  "PRESENTED",
  "ACCEPTED",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
