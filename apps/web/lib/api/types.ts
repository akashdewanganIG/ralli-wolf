export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedApiResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface QuoteListItem {
  id: number;
  quoteNumber: string;
  grandTotal: number | string;
  status: string;
  validUntil?: string | null;
  createdAt: string;
  updatedAt?: string;
  preparedBy?: {
    id: number;
    firstName: string | null;
    lastName: string | null;
  } | null;
  opportunity?: {
    id: number;
    opportunityNumber?: string;
    name: string;
    stage?: string;
  };
  account?: { id: number; name: string };
  contact?: { id: number; name: string; email?: string } | null;
  _count?: { lineItems: number };
}

export interface QuoteDetail {
  id: number;
  quoteNumber: string;
  name: string;
  description?: string | null;
  status: string;
  type?: string;
  version?: number;
  isPrimary: boolean;
  subtotal: number | string;
  discount: number | string;
  discountPercent?: number | string;
  taxAmount: number | string;
  taxPercent?: number | string;
  shippingAmount: number | string;
  grandTotal: number | string;
  validUntil?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  presentedAt?: string | null;
  acceptedAt?: string | null;
  billingName?: string | null;
  billingStreet?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingPostalCode?: string | null;
  billingCountry?: string | null;
  shippingName?: string | null;
  shippingStreet?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry?: string | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  approvalComment?: string | null;
  rejectionComment?: string | null;
  opportunityId: number;
  accountId: number;
  contactId?: number | null;
  preparedById: number;
  approvedById?: number | null;
  rejectedById?: number | null;
  createdAt: string;
  updatedAt: string;
  opportunity?: {
    id: number;
    opportunityNumber?: string;
    name: string;
    stage?: string;
  };
  account?: { id: number; name: string };
  contact?: { id: number; name: string; email?: string } | null;
  preparedBy?: {
    id: number;
    firstName: string | null;
    lastName: string | null;
  };
  approvedBy?: {
    id: number;
    firstName: string | null;
    lastName: string | null;
  } | null;
  rejectedBy?: {
    id: number;
    firstName: string | null;
    lastName: string | null;
  } | null;
  _count?: { lineItems: number; salesOrders: number };
}

export interface QuoteLineItemApi {
  id: number;
  quoteId: number;
  productId: number;
  quantity: number;
  listPrice: number | string;
  unitPrice: number | string;
  discount?: number | string;
  totalPrice: number | string;
  description?: string | null;
  sortOrder: number;
  product?: { id: number; name: string; code?: string };
  priceBookEntry?: { id: number; listPrice?: number | string };
}

export interface User {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone?: string;
  countryCode?: string;
  location?: string | null;
  createdAt?: string;
  updatedAt?: string;
  leads?: Lead[];
  campaigns?: Campaign[];
  role?: string;
  region?: string;

  permissions?: string[];

  mustChangePassword?: boolean;
}

export interface CreateUserResponse extends User {
  invitationEmailSent: boolean;
  message: string;
}

export type LeadStatus =
  | "OPEN"
  | "WORKING"
  | "QUALIFIED"
  | "UNQUALIFIED"
  | "NURTURING"
  | "CONVERTED";

export interface Lead {
  id: number;
  firstName: string;
  lastName?: string | null;
  email: string;
  phone?: string;
  countryCode?: string;
  companyName?: string;
  city?: string;
  state?: string;
  pincode?: string;
  source: string;
  status: LeadStatus;
  score: number;
  ownerId?: number | null;
  convertedToContactId?: number;
  createdAt: string;
  updatedAt: string;
  assignedAt?: string | null;
  owner?: User;
  convertedToContact?: Contact;
  campaignMembers?: CampaignMember[];
  analyticsEvents?: AnalyticsEvent[];
  formSubmissions?: FormSubmission[];
  enquiries?: Enquiry[];
  keywords?: Array<{
    id: number;
    leadId: number;
    keywordId: number;
    keyword: Keyword;
  }>;
  activities?: Array<{
    id: string;
    title: string;
    description: string;
    time: string;
  }>;
}

export interface LeadAssignmentStats {
  userId: number;
  totalLeads: number;
  totalConverted: number;
  totalRemaining: number;
  conversionRate: number;
}

export interface LeadScoreBreakdown {
  totalScore: number;
  completenessScore: number;
  qualityScore: number;
  missingFields: string[];
  invalidFields: string[];
}

export interface LeadMutationResponse {
  lead: Lead;
  scoreBreakdown: LeadScoreBreakdown;
}

export interface LeadConversionResult {
  lead: Lead;
  contact: Contact;
  message: string;
}

export interface BulkLeadConversionResult {
  successful: Array<
    LeadConversionResult & {
      leadId: number;
      contactId: number;
    }
  >;
  failed: Array<{ leadId: number | null; reason: string }>;
  summary: { total: number; successful: number; failed: number };
  message: string;
}

export type LeadSource = "IMPORT" | "LANDING_PAGE" | "MANUAL";

export interface DashboardChartDataset {
  label: string;
  data: number[];
  borderColor?: string | string[];
  backgroundColor?: string | string[];
  borderWidth?: number;
  fill?: boolean;
  tension?: number;
}

export interface DashboardChartData {
  labels: string[];
  datasets: DashboardChartDataset[];
}

export interface DashboardMetric {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative";
}

export interface SalesMyLeadsResponse {
  leads: Lead[];
  pagination: PaginationMeta;
}

export interface SalesMyStatsResponse {
  stats: {
    totalLeads: number;
    qualifiedLeads: number;
    unqualifiedLeads: number;
    workingLeads: number;
    openLeads: number;
    convertedLeads: number;
    unresolvedEnquiries: number;
    conversionRate: string;
    qualificationRate: string;
  };
}

export interface Contact {
  id: number;
  name: string;
  email: string;
  phone?: string;
  countryCode?: string;
  position?: string;
  city?: string;
  state?: string;
  pincode?: string;
  accountId?: number;
  emailOptOut?: boolean;
  smsOptOut?: boolean;
  whatsappOptOut?: boolean;
  createdAt: string;
  updatedAt: string;
  account?: Account;
  convertedLeads?: Lead[];
  campaignMembers?: CampaignMember[];
}

export interface Account {
  id: number;
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  contacts?: Contact[];
}

export interface Campaign {
  id: number;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  creator?: User;
  campaignMembers?: CampaignMember[];
  analyticsEvents?: AnalyticsEvent[];
  formSubmissions?: FormSubmission[];
}

export interface CampaignMember {
  id: number;
  campaignId: number;
  contactId?: number;
  leadId?: number;
  joinedAt: string;
  campaign?: Campaign;
  contact?: Contact;
  lead?: Lead;
}

export interface AnalyticsEvent {
  id: number;
  campaignId?: number;
  contactId?: number;
  leadId?: number;
  eventType: string;
  eventData: Record<string, unknown>;
  occurredAt: string;
  campaign?: Campaign;
  contact?: Contact;
  lead?: Lead;
}

export interface FormSubmission {
  id: number;
  campaignId: number;
  leadId?: number;
  contactId?: number;
  formData: Record<string, unknown>;
  submittedAt: string;
  campaign?: Campaign;
  lead?: Lead;
  contact?: Contact;
}

export interface LandingPageCampaign {
  id: number;
  name: string;
  description?: string | null;
  uniqueId: string;
  status: "ACTIVE" | "PAUSED" | "SCHEDULED" | "CLOSED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  createdBy?: number | null;
  creator?: {
    id: number;
    name: string | null;
    email: string;
  };
  _count?: {
    enquiries: number;
  };
  enquiries?: Enquiry[];
}

export interface Enquiry {
  id: number;
  leadId: number;
  landingPageCampaignId?: number | null;
  customFields?: Record<string, unknown> | null;
  status: "UNRESOLVED" | "RESOLVED" | "IN_PROGRESS";
  enquiryCreatedAt: string;
  resolvedAt?: string | null;
  resolvedBy?: number | null;
  lead?: {
    id: number;
    firstName: string;
    lastName?: string | null;
    email: string;
    phone?: string | null;
  };
  landingPageCampaign?: {
    id: number;
    name: string;
    uniqueId: string;
  };
  resolver?: {
    id: number;
    name: string | null;
    email: string;
  };
}

export interface LeadRemark {
  id: number;
  leadId: number;
  userId: number;
  remark: string;
  createdAt: string;
  updatedAt: string;
  user: Pick<User, "id" | "firstName" | "lastName" | "email">;
  lead?: Pick<Lead, "id" | "firstName" | "lastName" | "email" | "status"> & {
    name: string;
  };
}

export interface GlobalSetting {
  key: string;
  value: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  country?: string | null;
}

export interface LandingPageCampaignFilters {
  status?: "ACTIVE" | "PAUSED" | "SCHEDULED" | "CLOSED" | "ARCHIVED";
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface LandingPageCampaignStats {
  activeCampaigns: number;
  totalCampaigns: number;
  totalEnquiries: number;
  unresolvedEnquiries: number;
}

export interface MessagingAccount {
  id: number;
  provider: string;
  displayName: string;
  sourceHandle: string;
  phoneNumber: string;
  senderId?: string | null;
  businessId?: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt?: string;
  maskedTail?: string;
  metadata?: unknown;
}

export interface MessageTemplate {
  id: number;
  whatsappNumberId: number;
  providerTemplateId: string;
  name: string;
  language: string;
  languages?: Array<{
    code: string;
    status: string;
    id: string | number;
    rejection_reason?: string;
  }>;
  category?: string | null;
  status: string;
  components?: unknown;
  lastSyncedAt?: string | null;
  isArchived?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type WhatsAppAudience = "all" | "segment" | "upload" | "leads";

export interface WhatsAppDeliveryStats {
  total: number;
  pending: number;
  processing: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  opted_out: number;
}

export interface WhatsAppCampaignSummary {
  id: number;
  name: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  createdBy: number;
  createdAt: string;
  creator: Pick<User, "id" | "firstName" | "lastName" | "email">;
  deliveryStats: WhatsAppDeliveryStats;
  templateName?: string;
  scheduledAt?: string | null;
}

export interface WhatsAppCampaignDetail extends WhatsAppCampaignSummary {
  template?: MessageTemplate;
  messageParams?: Record<string, unknown> | null;
  language?: string | null;
}

export interface WhatsAppCampaignConfig {
  id: number;
  name: string;
  description?: string | null;
  accountId: number;
  templateName: string;
  language?: string | null;
  messageParams?: Record<string, unknown> | null;
  audience: WhatsAppAudience;
  segmentId?: number | null;
  scheduledAt?: string | null;
  batchSize: number;
}

export interface WhatsAppCreateCampaignPayload {
  name: string;
  description?: string;
  accountId: number;
  templateName: string;
  language?: string;
  toAudience?: WhatsAppAudience;
  params?: Record<string, unknown>;
  segmentId?: number;
  csvContacts?: Array<Record<string, string>>;
  phoneColumnName?: string;
  isDraft?: boolean;
  batchSize?: number;
}

export interface WhatsAppCreateTemplatePayload {
  accountId: number;
  template_name: string;
  language: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  button_url?: boolean;
  message_ttl?: number;
  ttl_in_seconds?: number | null;
  components: Array<Record<string, unknown>>;
}

export interface WhatsAppUpdateCampaignPayload {
  name?: string;
  description?: string | null;
  templateName?: string;
  language?: string;
  toAudience?: Exclude<WhatsAppAudience, "upload">;
  params?: Record<string, unknown>;
  segmentId?: number | null;
  batchSize?: number;
}

export interface WhatsAppOptOut {
  id: number;
  phone: string;
  channel: "whatsapp";
  optedOutAt: string;
  source?: string | null;
  campaignId?: number | null;
  reason?: string | null;
  metadata?: unknown;
  createdAt: string;
}

export interface CampaignDelivery {
  id: number;
  campaignId: number;
  campaignMemberId?: number | null;
  contactId?: number | null;
  leadId?: number | null;
  channel: string;
  whatsappNumberId?: number | null;
  segmentId?: number | null;
  address: string;
  csvData?: Record<string, string> | null;
  status:
    | "PENDING"
    | "PROCESSING"
    | "QUEUED"
    | "SENT"
    | "DELIVERED"
    | "READ"
    | "FAILED"
    | "OPTED_OUT";
  errorCode?: string | null;
  errorMessage?: string | null;
  providerMessageId?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginOtpVerifyRequest {
  mfaToken: string;
  otp: string;
}

export interface LoginMfaChallenge {
  mfaRequired: true;
  mfaToken: string;

  maskedEmail: string;
  expiresIn: number;

  factor: "totp" | "email";

  availableFactors: Array<"totp" | "email">;
}

export interface LoginSuccess extends LoginResponse {
  mfaRequired: false;
}

export type LoginResult = LoginMfaChallenge | LoginSuccess;

export interface LoginOtpResendResponse {
  success: boolean;
  maskedEmail: string;
  expiresIn: number;
}

export type AuthMethodName = "password" | "email" | "totp";

export interface AuthMethodStatus {
  method: AuthMethodName;
  enabled: boolean;
  verified: boolean;

  pendingVerification: boolean;
}

export interface AuthMethodsSummary {
  minimumRequired: number;
  activeCount: number;
  methods: AuthMethodStatus[];

  sessionToken?: string;
}

export interface TotpEnrolment {
  qrCodeDataUrl: string;
  otpauthUrl: string;

  manualKey: string;
  issuer: string;
  accountName: string;
}

export interface LoginResponse {
  user: User;

  token?: string;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;

  attemptsRemaining?: number;
}

export interface LeadFilters {
  status?: string;
  source?: string;
  createdFrom?: string;
  createdTo?: string;
  keywordIds?: number[];
  ownerId?: number;
  ownerRegion?: string;
  unassigned?: boolean;
  assigned?: boolean;
}

export interface ContactFilters {
  accountId?: number;
  position?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface CampaignFilters {
  createdBy?: number;
  status?: "active" | "inactive" | "completed";
  createdFrom?: string;
  createdTo?: string;
}

export interface UserFilters {
  role?: string;
  region?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface SyncLeadsResponse {
  successful: Array<{
    leadId: number;
    brevoContactId: number;
    email: string;
  }>;
  failed: Array<{
    leadId: number;
    email: string;
    error: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface BrevoCampaignStats {
  clickers: number;
  complaints: number;
  deferred?: number;
  delivered: number;
  hardBounces: number;
  sent: number;
  softBounces: number;
  trackableViews: number;
  uniqueClicks: number;
  uniqueViews: number;
  unsubscriptions: number;
  viewed: number;
  listId?: number;
  appleMppOpens?: number;
  estimatedViews?: number;
  opensRate?: number;
  trackableViewsRate?: number;
  returnBounce?: number;
}

export interface BrevoCampaignStatistics {
  globalStats?: BrevoCampaignStats;
  campaignStats?: BrevoCampaignStats[];
  linksStats?: Record<string, { nbClick: number }>;
  statsByBrowser?: Record<
    string,
    {
      clickers: number;
      uniqueClicks: number;
      uniqueViews: number;
      viewed: number;
    }
  >;
  statsByDevice?: {
    desktop?: Record<
      string,
      {
        clickers: number;
        uniqueClicks: number;
        uniqueViews: number;
        viewed: number;
      }
    >;
    mobile?: Record<
      string,
      {
        clickers: number;
        uniqueClicks: number;
        uniqueViews: number;
        viewed: number;
      }
    >;
    tablet?: Record<
      string,
      {
        clickers: number;
        uniqueClicks: number;
        uniqueViews: number;
        viewed: number;
      }
    >;
    unknown?: Record<
      string,
      {
        clickers: number;
        uniqueClicks: number;
        uniqueViews: number;
        viewed: number;
      }
    >;
  };
  statsByDomain?: Record<string, BrevoCampaignStats>;
  mirrorClick?: number;
  remaining?: number;
}

export interface BrevoCampaign {
  id: number;
  name: string;
  subject?: string;
  type: "classic" | "trigger";
  status: "draft" | "sent" | "archive" | "queued" | "suspended" | "in_process";
  scheduledAt?: string;
  createdAt: string;
  modifiedAt: string;
  sender?: {
    id?: number;
    name: string;
    email: string;
  };
  replyTo?:
    | {
        email: string;
        name?: string;
      }
    | string;
  previewText?: string;
  recipients?: {
    lists?: number[];
    exclusionLists?: number[];
    listIds?: number[];
  };
  statistics?: BrevoCampaignStatistics;
  htmlContent?: string;
  footer?: string;
  header?: string;
  inlineImageActivation?: boolean;
  mirrorActive?: boolean;
  recurring?: boolean;
  shareLink?: string;
  tag?: string;
  testSent?: boolean;
  toField?: string;
  sentDate?: string;
}

export interface UpdateCampaignRequest {
  name?: string;
  subject?: string;
  sender?: {
    name: string;
    email: string;
  };
  recipients?: {
    listIds: number[];
  };
  replyTo?: string;
  previewText?: string;
  htmlContent?: string;
  textContent?: string;
  scheduledAt?: string;
  type?: "classic" | "trigger";
}

export interface Subdealer {
  id: number;
  phone: string;
  gstNumber: string;
  email?: string;
  legalName: string;
  tradeName?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  panNumber?: string;
  registrationDate?: string;
  businessType?: string;
  status?: string;
  jurisdiction?: string;
  phoneVerified: boolean;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GstDetails {
  legalName: string;
  tradeName?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  panNumber?: string;
  registrationDate?: string;
  businessType?: string;
  status?: string;
  jurisdiction?: string;
  gstNumber: string;
}

export interface FetchGstResponse {
  success: boolean;
  data: GstDetails;
}

export interface GenerateOtpResponse {
  success: boolean;
  message: string;
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
  gstNumber: string;
  email?: string;
}

export interface SubdealerSessionProfile {
  id: number;
  phone: string;
  gstNumber: string;
  legalName: string;
  tradeName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  panNumber: string | null;
  registrationDate: string | null;
  businessType: string | null;
  status: string | null;
  jurisdiction: string | null;
  email: string | null;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  data: SubdealerSessionProfile;
  token: string;
}

export interface ProductCategory {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  name: string;
  code: string;
  imageUrl?: string;
  price: string | number;
  description?: string;
  categoryId: number;
  active: boolean;
  component: boolean;
  createdAt: string;
  updatedAt: string;
  category?: ProductCategory;
}

export interface CreateProductInput {
  name: string;
  code: string;
  price?: number;
  description?: string;
  categoryId: number;
  active?: boolean;
  component?: boolean;
  image?: File;
}

export interface UpdateProductInput {
  name?: string;
  code?: string;
  price?: number;
  description?: string;
  categoryId?: number;
  active?: boolean;
  component?: boolean;
  image?: File;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
}

export interface PriceBook {
  id: number;
  name: string;
  currencyCode: string;

  currencyISOCode: string;
  isActive?: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedPriceBooksResponse {
  data: PriceBook[];

  pagination: {
    total: number;

    page: number;

    limit: number;

    totalPages: number;
  };
}

export interface PriceBookEntry {
  id: number;
  priceBookId: number;
  productId: number;
  listPrice: number | string;
  isActive: boolean;
  useStandardPrice: boolean;
  createdAt: string;
  updatedAt: string;
  priceBook?: PriceBook;
  product?: Product;
}

export interface PaginatedPriceBookEntriesResponse {
  data: PriceBookEntry[];

  pagination: {
    total: number;

    page: number;

    limit: number;

    totalPages: number;
  };
}

export interface Keyword {
  id: number;
  name: string;
  createdAt: string;
}

export type SegmentEntityType = "CONTACT" | "LEAD";
export type SegmentRuleType = "KEYWORD" | "CITY" | "STATE" | "PINCODE";
export type SegmentRuleOperator = "IN" | "NOT_IN";

export interface SegmentRule {
  id: number;
  segmentId: number;
  ruleType: SegmentRuleType;
  operator: SegmentRuleOperator;
  value: string | number | Array<string | number> | null;
  createdAt: string;
}

export interface Segment {
  id: number;
  name: string;
  description?: string | null;
  entityType: SegmentEntityType;
  logicOperator: "AND" | "OR";
  filtersJson?: Record<string, unknown> | null;
  createdBy: number;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
  rules: SegmentRule[];
  creator?: {
    id: number;
    name?: string | null;
    email: string;
  };
  updater?: {
    id: number;
    name?: string | null;
    email: string;
  } | null;
}

export interface SegmentResolveResponse {
  segment: Segment;
  contacts: Array<{
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    createdAt: string;
  }>;
  total: number;
}

export interface SegmentRuleInput {
  ruleType: SegmentRuleType;
  operator?: SegmentRuleOperator;
  value: string | number | Array<string | number> | null;
}

export interface SegmentPayload {
  name: string;
  description?: string;
  logicOperator?: "AND" | "OR";
  rules: SegmentRuleInput[];
}

export interface Order {
  id: number;
  orderNumber: string;
  totalAmount?: string | number | null;
  city?: string | null;
  contactNumber?: string | null;
  email?: string | null;
  firmName?: string | null;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  pincode?: string | null;
  state?: string | null;
  gst?: string | null;
  salesUserId?: number | null;
  subdealerId?: number | null;
  archived?: boolean;
  archivedAt?: string | null;
  archivedBy?: number | null;
  createdAt: string;
  updatedAt: string;
  subdealer?: Subdealer;
  lineItems?: ProductLineItem[];
}

export interface ProductLineItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  createdAt: string;
  order?: Order;
  product?: Product;
}

export interface CreateOrderInput {
  lineItems: {
    productId: number;
    quantity: number;
  }[];
}

export type InvoiceCategory =
  | "PENDING"
  | "DUPLICATE"
  | "NOT_CLEAR"
  | "OLD"
  | "DIFFERENT_CONTRACTOR"
  | "WITHOUT_GST"
  | "NON_PROGRAM"
  | "IRRELEVANT"
  | "NON_DEALER";

export interface Invoice {
  id: number;
  fileAvailable: boolean;
  downloadUrl: string;
  uploadedBy: number;
  category?: InvoiceCategory;
  status?: string;
  createdAt: string;
  updatedAt: string;
  subdealer?: Subdealer;
}

export interface UpdateInvoiceCategoryInput {
  category: InvoiceCategory;
}

export type AuditCategory = "CAMPAIGN_MANAGEMENT" | "SALES_MANAGEMENT";

export interface AuditLog {
  id: number;
  entityType: string;
  entityId: number;
  changedBy: number;
  action: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  category?: AuditCategory;
  changedAt: string;
  changedByUser?: {
    id: number;
    name?: string;
    email: string;
  };
}

export interface SubdealerLoginRequest {
  phone: string;
  otp: string;
}

export interface SubdealerAuthResponse {
  success: boolean;
  message: string;
  data: SubdealerSessionProfile;
  token: string;
}

export interface SalesKPIResponse {
  registrations: {
    total: number;
    verified: number;
    pending: number;
  };
  invoices: {
    total: number;
    pending: number;
    duplicate: number;
    notClear: number;
    old: number;
    differentContractor: number;
    withoutGst: number;
    nonProgram: number;
    irrelevant: number;
    nonDealer: number;
  };
  orders: {
    total: number;
    pending: number;
    confirmed: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
  };
}

export interface InvoiceCategoryCount {
  category: InvoiceCategory;
  count: number;
}

export interface SalesRegistrationsResponse {
  data: Subdealer[];
  pagination: PaginationMeta;
}

export interface SalesInvoicesResponse {
  data: Invoice[];
  pagination: PaginationMeta;
}

export interface SalesOrdersResponse {
  data: Order[];
  pagination: PaginationMeta;
}

export interface SalesAuditLogsResponse {
  data: AuditLog[];
  pagination: PaginationMeta;
}

export interface CreateOpportunityInput {
  name: string;
  accountId: number;
  contactId?: number;
  priceBookId?: number;
  type?: string;
  stage?: string;
  status?: string;
  amount?: number;
  expectedCloseDate?: string;
  leadSource?: string;
  nextStep?: string;
  description?: string;
}

export interface OpportunityListItem {
  id: number;
  name: string;
  accountName: string;
  opportunityOwner: string;
  closeDate: string | null;
  stage: string;
  createdAt: string;
}

export interface OpportunityDetail {
  id: number;
  opportunityNumber: string;
  name: string;
  description?: string | null;
  stage: string;
  type?: string | null;
  amount?: number | null;
  expectedCloseDate?: string | null;
  leadSource?: string | null;
  nextStep?: string | null;
  account: { id: number; name: string };
  contact?: { id: number; name: string; email?: string; phone?: string } | null;
  priceBook?: { id: number; name: string } | null;
  owner: { id: number; firstName: string; lastName: string; email?: string };
  creator: { id: number; firstName: string; lastName: string };
  lineItems: OpportunityLineItem[];
  activities: OpportunityActivity[];
  quotes: OpportunityQuoteSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityActivity {
  id: number;
  opportunityId: number;
  userId: number;
  activityType: string;
  description: string;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: unknown;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string };
}

export interface OpportunityQuoteSummary {
  id: number;
  quoteNumber: string;
  name: string;
  status: string;
  grandTotal: number | string;
  createdAt: string;
}

export interface OpportunityQuoteListItem {
  id: number;
  quoteNumber: string;
  name: string;
  status: string;
  type: string;
  version: number;
  isPrimary: boolean;
  grandTotal: number | string;
  createdAt: string;
}

export interface OpportunityLineItem {
  id: number;
  opportunityId: number;
  productId: number;
  product: { id: number; name: string; code?: string | null };
  priceBookEntryId?: number | null;
  quantity: number;
  listPrice: string;
  unitPrice: string;
  discount: string;
  totalPrice: string;
  description?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalProcessApi {
  id: number;
  targetObjectName: string;
  targetRecordId: number;
  status: string;
  comment?: string | null;
  requestedToId: number;
  lastActorId?: number | null;
  createdById: number;
  completedDate?: string | null;
  createdAt: string;
  updatedAt: string;
  requestedTo?: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  createdBy?: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  lastActor?: {
    id: number;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export interface SalesOrderListItem {
  id: number;
  orderNumber: string;
  name: string;
  status: string;
  grandTotal: number | string;
  orderDate: string;
  createdAt: string;
  account: { id: number; name: string };
  owner: { firstName: string | null; lastName: string | null };
  _count: { lineItems: number };
}

export interface SalesOrderLineItem {
  id: number;
  salesOrderId: number;
  productId: number;
  quantity: number;
  listPrice: number | string;
  unitPrice: number | string;
  discount: number | string;
  totalPrice: number | string;
  sortOrder: number;
  product: { id: number; name: string; code: string };
}

export interface SalesOrderDetail {
  id: number;
  orderNumber: string;
  name: string;
  status: string;
  orderDate: string;
  subtotal: number | string;
  discount: number | string;
  discountPercent: number | string;
  taxAmount: number | string;
  taxPercent: number | string;
  shippingAmount: number | string;
  grandTotal: number | string;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  notes?: string | null;
  billingName?: string | null;
  billingStreet?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingPostalCode?: string | null;
  billingCountry?: string | null;
  shippingName?: string | null;
  shippingStreet?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry?: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: SalesOrderLineItem[];
  quote?: {
    id: number;
    quoteNumber: string;
    status: string;
    opportunity?: { id: number; name: string } | null;
  } | null;
  account: { id: number; name: string };
  contact?: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  owner: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email?: string | null;
  };
  approvedBy?: {
    id: number;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export interface QuoteOrderItem {
  id: number;
  orderNumber: string;
  name: string;
  status: string;
  grandTotal: number | string;
  orderDate: string;
  expectedShipDate: string | null;
  owner: { id: number; firstName: string | null; lastName: string | null };
  createdAt: string;
}
