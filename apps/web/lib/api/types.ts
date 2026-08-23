// Base types
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

// Pagination metadata from backend
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Paginated response structure from backend
export interface PaginatedApiResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// Quote list item (GET /api/quotes response item)
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

// Quote detail (GET /api/quotes/:id single quote response)
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
  pdfUrl?: string | null;
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

// Quote line item (GET /api/quotes/:id/line-items response item)
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

// User and Permissions
export interface User {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone?: string;
  countryCode?: string;
  passwordHash?: string;
  createdAt?: string;
  updatedAt?: string;
  leads?: Lead[];
  campaigns?: Campaign[];
  role?: string;
  region?: string;
  /** Only populated for the CUSTOM role; other roles resolve from the catalogue. */
  permissions?: string[];
  isDeveloper?: boolean;
  /** Account is still on the password an admin generated; it must be replaced. */
  mustChangePassword?: boolean;
}

export interface CreateUserResponse extends User {
  credentialEmailSent: boolean;
  message: string;
}

export interface UserPermissions {
  id: number;
  userId: number;
  leadManagement: boolean;
  campaignManagement: boolean;
  chatbotAccess: boolean;
  whatsappCampaign: boolean;
  emailMarketing: boolean;
  systemAdminAccess: boolean;
}

// Lead types
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
  ownerId?: number;
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

// Sales typed responses
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

// Contact types
export interface Contact {
  id: number;
  name: string;
  email: string;
  phone?: string;
  countryCode?: string;
  position?: string;
  accountId?: number;
  createdAt: string;
  updatedAt: string;
  account?: Account;
  convertedLeads?: Lead[];
  campaignMembers?: CampaignMember[];
}

// Account types
export interface Account {
  id: number;
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
  description?: string;
  annualRevenue?: string;
  companySize?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  accountOwner?: string;
  createdBy?: string;
  lastUpdatedBy?: string;
  accountStatus?: string;
  createdAt: string;
  updatedAt: string;
  contacts?: Contact[];
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  sameAsBilling?: boolean;
}

// Campaign types
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

// Analytics types
export interface AnalyticsEvent {
  id: number;
  campaignId?: number;
  contactId?: number;
  leadId?: number;
  eventType: string;
  eventData: Record<string, any>;
  occurredAt: string;
  campaign?: Campaign;
  contact?: Contact;
  lead?: Lead;
}

// Form Submission types
export interface FormSubmission {
  id: number;
  campaignId: number;
  leadId?: number;
  contactId?: number;
  formData: Record<string, any>;
  submittedAt: string;
  campaign?: Campaign;
  lead?: Lead;
  contact?: Contact;
}

// Landing Page Campaign types
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
  customFields?: Record<string, any> | null;
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

// Messaging (Generic)
export interface MessagingAccount {
  id: number;
  provider: string;
  displayName: string;
  credentialsJson: Record<string, any>;
  sourceHandle: string;
  phoneNumber?: string;
  senderId?: string | null;
  businessId?: string | null;
  status?: string;
  externalIdsJson?: Record<string, any>;
  isActive: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt?: string;
  maskedTail?: string;
  metadata?: Record<string, any>;
}

export interface MessageTemplate {
  id: number;
  provider?: string;
  channel?: string;
  providerTemplateId?: string;
  name: string;
  language: string;
  languages?: Array<{
    code: string;
    status: string;
    id: number;
    rejection_reason?: string;
  }>;
  category?: string | null;
  status: string;
  components?: any;
  componentsJson?: Record<string, any>;
  lastSyncedAt?: string;
  messagingAccountId?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CampaignDelivery {
  id: number;
  campaignId: number;
  campaignMemberId: number;
  channel: string;
  messagingAccountId: number;
  address: string;
  variablesJson?: Record<string, any>;
  status:
    | "pending"
    | "queued"
    | "sent"
    | "delivered"
    | "read"
    | "failed"
    | "paused"
    | "opted_out";
  errorCode?: string;
  errorMessage?: string;
  providerMessageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginOtpVerifyRequest {
  /** The short-lived token handed back by the password step. */
  mfaToken: string;
  otp: string;
}

/**
 * What `POST /auth/login` returns once the password is accepted. No session
 * token is issued until the emailed code is verified.
 */
export interface LoginMfaChallenge {
  mfaRequired: true;
  mfaToken: string;
  /** e.g. `ak****an@example.com`, safe to show on screen. */
  maskedEmail: string;
  expiresIn: number;
  /** Which challenge to show: an authenticator code, or an emailed one. */
  factor: "totp" | "email";
  /** Everything this account could use, so the form can offer a switch. */
  availableFactors: Array<"totp" | "email">;
}

export interface LoginOtpResendResponse {
  success: boolean;
  maskedEmail: string;
  expiresIn: number;
}

/** The three ways an account can authenticate. */
export type AuthMethodName = "password" | "email" | "totp";

export interface AuthMethodStatus {
  method: AuthMethodName;
  enabled: boolean;
  verified: boolean;
  /** A secret exists but no code has proved it yet; does not count. */
  pendingVerification: boolean;
}

export interface AuthMethodsSummary {
  minimumRequired: number;
  activeCount: number;
  methods: AuthMethodStatus[];
}

export interface TotpEnrolment {
  qrCodeDataUrl: string;
  otpauthUrl: string;
  /** Shown once, for users who cannot scan a QR code. */
  manualKey: string;
  issuer: string;
  accountName: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  isDeveloper?: boolean;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface SignupResponse {
  user: User;
  token: string;
}

// API Error types
export interface ApiError {
  message: string;
  status: number;
  code?: string;
  /** Set by the OTP verify endpoint when a code is entered incorrectly. */
  attemptsRemaining?: number;
}

// Filter and Query types
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
  permissions?: Partial<UserPermissions>;
  createdFrom?: string;
  createdTo?: string;
}

// Webhook types
export interface WebhookPayload {
  form_submission?: Record<string, any>;
  lead?: Record<string, any>;
  campaign?: Record<string, any>;
  landing_page?: Record<string, any>;
  custom_fields?: Record<string, any>;
  [key: string]: any;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  timestamp: string;
  receivedData: {
    hasBody: boolean;
    bodyKeys: string[];
    headers: string[];
    queryKeys: string[];
  };
  leadCreated: boolean;
  leadId?: number;
  formSubmissionCreated: boolean;
  formSubmissionId?: number;
}

// Brevo types
export interface SyncLeadsRequest {
  leadIds: number[];
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
  // Legacy fields for backward compatibility
  delivered?: number;
  sent?: number;
  processing?: number;
  bounces?: number;
  hardBounces?: number;
  softBounces?: number;
  clicks?: number;
  uniqueClicks?: number;
  opens?: number;
  uniqueOpens?: number;
  spamReports?: number;
  unsubscriptions?: number;
  deliveredPercentage?: number;
  sentPercentage?: number;
  processingPercentage?: number;
  bouncePercentage?: number;
  openPercentage?: number;
  clickPercentage?: number;
  spamPercentage?: number;
  unsubscriptionPercentage?: number;
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

export interface BrevoAnalyticsResponse {
  totalCampaigns: number;
  activeCampaigns: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalUnsubscribed: number;
  totalSpam: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  spamRate: number;
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
  replyTo?: string; // Brevo API expects a string (email), not an object
  previewText?: string;
  htmlContent?: string;
  textContent?: string;
  scheduledAt?: string;
  type?: "classic" | "trigger";
  [key: string]: any;
}

export interface UpdateCampaignStatusRequest {
  status:
    | "suspended"
    | "archive"
    | "darchive"
    | "sent"
    | "queued"
    | "replicate"
    | "replicateTemplate"
    | "draft";
}

// Subdealer types
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
  tradeName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  panNumber: string;
  registrationDate: string;
  businessType: string;
  status: string;
  jurisdiction: string;
  email?: string; // Optional email field for subdealer
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
  gstDetails: GstDetails;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    phone: string;
    gstNumber: string;
    legalName: string;
  };
}

// Product types
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

// PriceBook types
export interface PriceBook {
  id: number;
  name: string;
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

// PriceBookEntry types

export interface PriceBookEntry {
  id: number;
  priceBookId: number;
  productId: number;
  listPrice: number;
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

// Keyword types
export interface Keyword {
  id: number;
  name: string;
  createdAt: string;
}

// Segment types
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

// Order types
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export interface Order {
  id: number;
  subdealerId: number;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: string | number;
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

// Invoice category types
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
  pdfUrl: string;
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

// Audit category types
export type AuditCategory = "CAMPAIGN_MANAGEMENT" | "SALES_MANAGEMENT";

export interface AuditLog {
  id: number;
  entityType: string;
  entityId: number;
  changedBy: number;
  action: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  category?: AuditCategory;
  changedAt: string;
  changedByUser?: {
    id: number;
    name?: string;
    email: string;
  };
}

// Subdealer authentication types
export interface CheckPhoneResponse {
  success: boolean;
  exists: boolean;
  data: {
    id: number;
    phone: string;
    gstNumber: string;
    legalName: string;
    tradeName: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    panNumber: string;
    registrationDate: string;
    businessType: string;
    status: string;
    jurisdiction: string;
    email?: string;
  } | null;
}

export interface SubdealerLoginRequest {
  phone: string;
  otp: string;
}

export interface SubdealerAuthResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    phone: string;
    gstNumber: string;
    legalName: string;
    tradeName: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    panNumber: string;
    registrationDate: string;
    businessType: string;
    status: string;
    jurisdiction: string;
    email?: string;
  };
  token: string;
}

// Sales dashboard KPI types
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
  activities: any[];
  quotes: any[];
  createdAt: string;
  updatedAt: string;
}

/** GET /api/opportunities/:opportunityId/quotes response item */
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

/** GET /api/approvals and GET /api/approvals/my response item */
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

/** Shape returned by GET /api/quotes/:id/orders (single linked order) */
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
