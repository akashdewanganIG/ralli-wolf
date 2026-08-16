import type {
  DummyAccount,
  DummyContact,
  Opportunity,
} from "./opportunity-types";

export const DUMMY_ACCOUNTS: DummyAccount[] = [
  { id: 101, name: "Acme Corp" },
  { id: 102, name: "Globex Industries" },
  { id: 103, name: "Innotech Solutions" },
  { id: 104, name: "Stark Manufacturing" },
  { id: 105, name: "Wayne Enterprises" },
  { id: 106, name: "LexCorp" },
];

export const DUMMY_CONTACTS: DummyContact[] = [
  { id: 201, name: "John Doe", accountId: 101 },
  { id: 202, name: "Jane Smith", accountId: 101 },
  { id: 203, name: "Arjun Mehta", accountId: 102 },
  { id: 204, name: "Priya Nair", accountId: 103 },
  { id: 205, name: "Ravi Kumar", accountId: 104 },
];

function isoNow() {
  return new Date().toISOString();
}

export const DEFAULT_DUMMY_OPPORTUNITIES: Opportunity[] = [
  {
    id: "opp_1",
    name: "Enterprise Software Deal",
    stage: "QUALIFICATION",
    accountId: 101,
    accountName: "Acme Corp",
    contactId: 201,
    contactName: "John Doe",
    closeDate: "2026-03-31",
    type: "NEW_CUSTOMER",
    leadSource: "WEBSITE",
    description: "Initial discovery call complete. Working on solution fit.",
    ownerName: "Sales Rep",
    createdByName: "Admin User",
    createdAt: isoNow(),
    lastModifiedByName: "Admin User",
    lastModifiedAt: isoNow(),
  },
  {
    id: "opp_2",
    name: "Renewal - Annual Subscription",
    stage: "PROPOSAL",
    accountId: 102,
    accountName: "Globex Industries",
    contactId: 203,
    contactName: "Arjun Mehta",
    closeDate: "2026-02-28",
    type: "RENEWAL",
    leadSource: "PARTNER",
    description: "Proposal shared. Waiting on internal approval.",
    ownerName: "Sales Rep",
    createdByName: "Admin User",
    createdAt: isoNow(),
    lastModifiedByName: "Sales Rep",
    lastModifiedAt: isoNow(),
  },
];
