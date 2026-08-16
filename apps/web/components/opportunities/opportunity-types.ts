import type {
  OpportunityStage,
  OpportunityType,
  LeadSource,
} from "./opportunity-enums";

export type DummyAccount = {
  id: number;
  name: string;
};

export type DummyContact = {
  id: number;
  name: string;
  accountId?: number;
};

export type Opportunity = {
  id: string;
  name: string;
  stage: OpportunityStage;
  accountId: number;
  accountName: string;
  contactId?: number;
  contactName?: string;
  closeDate?: string; // YYYY-MM-DD
  type?: OpportunityType;
  leadSource?: LeadSource;
  description?: string;

  ownerName: string;
  createdByName: string;
  createdAt: string; // ISO
  lastModifiedByName: string;
  lastModifiedAt: string; // ISO
};
