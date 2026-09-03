import type { QuoteStatus } from "./quote-enums";

export type Quote = {
  id: string;
  quoteNumber: string;
  isPrimary: boolean;
  netAmount: number;
  lineItemCount: number;
  status: QuoteStatus;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  startDate: string;
  endDate: string;

  opportunityId: string;
  opportunityName: string;
  accountId: number;
  accountName: string;
  primaryContactId?: number;
  primaryContactName?: string;
  description?: string;
  pricebookId?: number;
  pricebookName?: string;
};
