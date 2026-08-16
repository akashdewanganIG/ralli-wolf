import type { QuoteStatus } from "./quote-enums";

export type DummyPricebook = {
  id: number;
  name: string;
};

export type DummyProduct = {
  id: number;
  name: string;
};

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

export type QuoteLineItem = {
  id: string;
  quoteId: string;
  lineName: string;
  number: number;
  productId: number;
  productName: string;
  listUnitPrice: number;
  quantity: number;
  netPrice: number;
  description?: string;
  pricebookId?: number;
  pricebookName?: string;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
};
