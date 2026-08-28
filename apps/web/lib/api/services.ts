import apiClient from "./client";
import {
  User,
  CreateUserResponse,
  Lead,
  Contact,
  Account,
  Campaign,
  AnalyticsEvent,
  FormSubmission,
  UserPermissions,
  LoginRequest,
  LoginOtpVerifyRequest,
  LoginMfaChallenge,
  LoginResult,
  AuthMethodsSummary,
  TotpEnrolment,
  LoginOtpResendResponse,
  LoginResponse,
  SignupRequest,
  SignupResponse,
  LeadFilters,
  ContactFilters,
  CampaignFilters,
  UserFilters,
  WebhookPayload,
  WebhookResponse,
  ApiResponse,
  PaginatedApiResponse,
  SyncLeadsResponse,
  BrevoCampaign,
  BrevoAnalyticsResponse,
  UpdateCampaignRequest,
  MessagingAccount,
  DashboardChartData,
  DashboardMetric,
  MessageTemplate,
  CampaignDelivery,
  SalesMyLeadsResponse,
  SalesMyStatsResponse,
  FetchGstResponse,
  GenerateOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  CheckPhoneResponse,
  SubdealerLoginRequest,
  SubdealerAuthResponse,
  Product,
  ProductCategory,
  CreateProductInput,
  UpdateProductInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  PriceBook,
  PriceBookEntry,
  Keyword,
  LeadAssignmentStats,
  LandingPageCampaignStats,
  Segment,
  SegmentPayload,
  SegmentResolveResponse,
  CreateOpportunityInput,
  OpportunityListItem,
  OpportunityDetail,
  OpportunityLineItem,
  OpportunityQuoteListItem,
  QuoteListItem,
  QuoteDetail,
  QuoteLineItemApi,
  QuoteOrderItem,
  SalesOrderListItem,
  SalesOrderDetail,
  ApprovalProcessApi,
} from "./types";

// Auth Services
export const authService = {
  /**
   * Step one of sign-in. A correct password does not return a session — it
   * returns a challenge, and the emailed code must be verified next.
   */
  login: async (credentials: LoginRequest): Promise<LoginResult> => {
    const response = await apiClient.post("/api/auth/login", credentials);
    return response.data;
  },

  resendLoginOtp: async (mfaToken: string): Promise<LoginOtpResendResponse> => {
    const response = await apiClient.post("/api/auth/login/otp/resend", {
      mfaToken,
    });
    return response.data;
  },

  /** Step two of sign-in: trades a valid code for a session token. */
  verifyLoginOtp: async (
    credentials: LoginOtpVerifyRequest
  ): Promise<LoginResponse> => {
    const response = await apiClient.post(
      "/api/auth/login/otp/verify",
      credentials
    );
    return response.data;
  },

  // ---- Authentication method management ----------------------------------
  // All act on the signed-in account; the server never takes a user id here.

  getAuthMethods: async (): Promise<AuthMethodsSummary> => {
    const response = await apiClient.get("/api/auth/methods");
    return response.data;
  },

  /** Mints a secret and returns the QR + manual key. Does not enable it. */
  startTotpSetup: async (): Promise<TotpEnrolment> => {
    const response = await apiClient.post("/api/auth/methods/totp/setup");
    return response.data;
  },

  verifyTotpSetup: async (code: string): Promise<AuthMethodsSummary> => {
    const response = await apiClient.post("/api/auth/methods/totp/verify", {
      code,
    });
    return response.data;
  },

  sendAuthEmailCode: async (): Promise<{ success: boolean; email: string }> => {
    const response = await apiClient.post("/api/auth/methods/email/send");
    return response.data;
  },

  verifyAuthEmailCode: async (code: string): Promise<AuthMethodsSummary> => {
    const response = await apiClient.post("/api/auth/methods/email/verify", {
      code,
    });
    return response.data;
  },

  /** Sets a password and turns password sign-in back on. */
  setAuthPassword: async (newPassword: string): Promise<AuthMethodsSummary> => {
    const response = await apiClient.post("/api/auth/methods/password", {
      newPassword,
    });
    return response.data;
  },

  disableAuthMethod: async (
    method: "totp" | "email" | "password"
  ): Promise<AuthMethodsSummary> => {
    const response = await apiClient.delete(`/api/auth/methods/${method}`);
    return response.data;
  },

  developerLogin: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post(
      "/api/auth/developer-login",
      credentials
    );
    return response.data;
  },

  signup: async (userData: SignupRequest): Promise<SignupResponse> => {
    const response = await apiClient.post("/api/auth/signup", userData);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post("/api/auth/logout");
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get("/api/auth/me");
    return response.data;
  },

  // Forgot password (OTP)
  requestPasswordResetOtp: async (
    email: string
  ): Promise<{ success: boolean }> => {
    const response = await apiClient.post("/api/auth/forgot-password", {
      email,
    });
    return response.data;
  },

  verifyPasswordResetOtp: async (
    email: string,
    otp: string
  ): Promise<{ resetToken: string; expiresIn: number }> => {
    const response = await apiClient.post("/api/auth/forgot-password/verify", {
      email,
      otp,
    });
    return response.data;
  },

  resetPasswordWithToken: async (
    resetToken: string,
    newPassword: string
  ): Promise<{ success: boolean }> => {
    const response = await apiClient.post("/api/auth/forgot-password/reset", {
      resetToken,
      newPassword,
    });
    return response.data;
  },

  changePassword: async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean }> => {
    const response = await apiClient.post("/api/auth/change-password", {
      currentPassword,
      newPassword,
    });
    return response.data;
  },
};

// Lead Services
export const leadService = {
  getAllLeads: async (
    filters?: LeadFilters & { page?: number; limit?: number }
  ): Promise<PaginatedApiResponse<Lead>> => {
    const params: any = { ...filters };
    // Convert keywordIds array to comma-separated string for API
    if (
      params.keywordIds &&
      Array.isArray(params.keywordIds) &&
      params.keywordIds.length > 0
    ) {
      params.keywordIds = params.keywordIds.join(",");
    } else if (params.keywordIds) {
      delete params.keywordIds;
    }
    if (typeof params.assigned === "boolean") {
      params.assigned = params.assigned ? "true" : "false";
    }
    if (typeof params.unassigned === "boolean") {
      params.unassigned = params.unassigned ? "true" : "false";
    }
    const response = await apiClient.get("/api/leads", { params });
    return response.data;
  },

  getAllLeadsComplete: async (): Promise<Lead[]> => {
    const response = await apiClient.get("/api/leads/all");
    return response.data;
  },

  getLeadById: async (id: number): Promise<Lead> => {
    const response = await apiClient.get(`/api/leads/${id}`);
    return response.data;
  },

  createLead: async (
    leadData: Partial<Lead>
  ): Promise<{ lead: Lead; scoreBreakdown: any }> => {
    const response = await apiClient.post("/api/leads", leadData);
    return response.data;
  },

  updateLead: async (
    id: number,
    leadData: Partial<Lead>
  ): Promise<{ lead: Lead; scoreBreakdown: any }> => {
    const response = await apiClient.put(`/api/leads/${id}`, leadData);
    return response.data;
  },

  deleteLead: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/leads/${id}`);
  },

  // Filter and search methods
  filterLeads: async (filters: LeadFilters): Promise<Lead[]> => {
    const response = await apiClient.get("/api/leads/filter", {
      params: filters,
    });
    return response.data;
  },

  searchLeads: async (query: string): Promise<Lead[]> => {
    const response = await apiClient.get("/api/leads/search", {
      params: { q: query },
    });
    return response.data;
  },

  getLeadsByStatus: async (status: string): Promise<Lead[]> => {
    const response = await apiClient.get(`/api/leads/by-status/${status}`);
    return response.data;
  },

  getLeadsBySource: async (source: string): Promise<Lead[]> => {
    const response = await apiClient.get(`/api/leads/by-source/${source}`);
    return response.data;
  },

  getLeadsByOwner: async (ownerId: number): Promise<Lead[]> => {
    const response = await apiClient.get(`/api/leads/by-owner/${ownerId}`);
    // The API returns a paginated response with data and pagination properties
    // Extract the data array from the response
    return response.data?.data || response.data || [];
  },

  getAssignmentStats: async (): Promise<LeadAssignmentStats[]> => {
    const response = await apiClient.get("/api/leads/assignment/stats");
    return response.data;
  },

  getLeadsByScore: async (
    minScore?: number,
    maxScore?: number
  ): Promise<Lead[]> => {
    const response = await apiClient.get("/api/leads/by-score", {
      params: { minScore, maxScore },
    });
    return response.data;
  },

  // Assignment methods
  assignLead: async (id: number, userId: number): Promise<Lead> => {
    const response = await apiClient.put(`/api/leads/${id}/assign`, { userId });
    return response.data;
  },

  assignLeadsBulk: async (
    userId: number,
    leadIds: number[]
  ): Promise<Lead[]> => {
    const response = await apiClient.post("/api/leads/assign-bulk", {
      userId,
      leadIds,
    });
    return response.data;
  },

  // Claim methods
  claimLead: async (id: number): Promise<Lead> => {
    const response = await apiClient.put(`/api/leads/${id}/claim`);
    return response.data;
  },

  claimLeadsBulk: async (payload: {
    leadIds: number[];
    userId: number;
  }): Promise<Lead[]> => {
    const response = await apiClient.post("/api/leads/claim-bulk", payload);
    return response.data;
  },

  // Conversion methods
  convertLead: async (
    id: number,
    data: { keywordIds?: number[] }
  ): Promise<any> => {
    const response = await apiClient.post(`/api/leads/${id}/convert`, data);
    return response.data;
  },

  convertLeadsBulk: async (
    leads: Array<{ leadId: number; keywordIds?: number[] }>
  ): Promise<any> => {
    const response = await apiClient.post("/api/leads/convert-bulk", { leads });
    return response.data;
  },

  getConversionHistory: async (id: number): Promise<any[]> => {
    const response = await apiClient.get(`/api/leads/${id}/conversion-history`);
    return response.data;
  },

  getLeadFormSubmissions: async (id: number): Promise<FormSubmission[]> => {
    const response = await apiClient.get(`/api/leads/${id}/form-submissions`);
    return response.data;
  },

  // Scoring methods
  updateLeadScore: async (id: number, score: number): Promise<Lead> => {
    const response = await apiClient.put(`/api/leads/${id}/score`, { score });
    return response.data;
  },

  // Import/Export helpers
  downloadExport: async (
    entity: "leads" | "contacts" | "accounts",
    params: {
      startPage?: number;
      endPage?: number;
      limit?: number;
      format?: "xlsx" | "csv";
    }
  ) => {
    const response = await apiClient.get(`/api/export/${entity}` as const, {
      params: {
        ...params,
        format: params.format || "xlsx",
      },
      responseType: "blob",
    });
    return response.data as Blob;
  },

  downloadImportTemplate: async (): Promise<Blob> => {
    const response = await apiClient.get("/api/leads/import/template", {
      responseType: "blob",
    });
    return response.data as Blob;
  },

  downloadImportTemplateCsv: async (): Promise<Blob> => {
    const response = await apiClient.get("/api/leads/import/template-csv", {
      responseType: "blob",
    });
    return response.data as Blob;
  },

  importLeads: async (
    file: File
  ): Promise<{
    insertedCount: number;
    skippedDuplicates: number;
    skippedCount: number;
    errors: Array<{ row: number; reason: string }>;
    report?: { filename: string; mimeType: string; base64: string };
  }> => {
    const form = new FormData();
    form.append("file", file);
    const response = await apiClient.post("/api/leads/import", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  emailSelectedLeads: async (
    to: string,
    leadIds: number[]
  ): Promise<{ success: boolean }> => {
    const response = await apiClient.post("/api/export/leads/email", {
      to,
      leadIds,
    });
    return response.data;
  },
};

// User Services
export const userService = {
  getAllUsers: async (
    filters?: UserFilters & { page?: number; limit?: number }
  ): Promise<PaginatedApiResponse<User>> => {
    const params: any = { ...filters };
    const response = await apiClient.get("/api/users", { params });
    return response.data;
  },

  getUserById: async (id: number): Promise<User> => {
    const response = await apiClient.get(`/api/users/${id}`);
    return response.data;
  },

  createUser: async (
    userData: Omit<User, "id" | "createdAt" | "updatedAt">
  ): Promise<CreateUserResponse> => {
    const response = await apiClient.post("/api/users", userData);
    return response.data;
  },

  updateUser: async (id: number, userData: Partial<User>): Promise<User> => {
    const response = await apiClient.put(`/api/users/${id}`, userData);
    return response.data;
  },

  deleteUser: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/users/${id}`);
  },

  /**
   * Issue a fresh password for the account and email it. The previous password
   * stops working, so this doubles as a recovery path when the first email went
   * astray.
   */
  resendCredentials: async (
    id: number
  ): Promise<{ success: boolean; email: string; message: string }> => {
    const response = await apiClient.post(
      `/api/users/${id}/resend-credentials`
    );
    return response.data;
  },

  updateUserPermissions: async (
    id: number,
    permissions: Partial<UserPermissions>
  ): Promise<UserPermissions> => {
    const response = await apiClient.put(
      `/api/users/${id}/permissions`,
      permissions
    );
    return response.data;
  },

  importUsers: async (
    users: Array<{
      firstName: string;
      lastName: string;
      phone: string;
      email: string;
      role: string;
      region?: string;
    }>
  ): Promise<{
    message: string;
    success: Array<{
      row: number;
      email: string;
      firstName: string;
      lastName: string;
    }>;
    errors: Array<{ row: number; email: string; error: string }>;
  }> => {
    const response = await apiClient.post("/api/users/import", { users });
    return response.data;
  },

  getImportTemplate: async (): Promise<{
    columns: Array<{
      name: string;
      label: string;
      required: boolean;
      format?: string;
      options?: string[];
      default?: string;
    }>;
    validRoles: string[];
    validRegions: string[];
    defaultRegion: string;
  }> => {
    const response = await apiClient.get("/api/users/import/template");
    return response.data;
  },

  importUsersFile: async (
    file: File
  ): Promise<{
    message: string;
    success: Array<{
      row: number;
      email: string;
      firstName: string;
      lastName: string;
    }>;
    errors: Array<{
      row: number;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      role: string;
      region: string;
      error: string;
    }>;
    report?: { filename: string; mimeType: string; base64: string };
  }> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post("/api/users/import/file", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  downloadTemplate: (): string => {
    // Returns the URL for downloading the template
    return `${apiClient.defaults.baseURL}/api/users/import/template/download`;
  },
};

// Account Services
export const accountService = {
  getAllAccounts: async (filters?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedApiResponse<Account>> => {
    const response = await apiClient.get("/api/accounts/getAllAccounts", {
      params: filters,
    });
    return response.data;
  },

  getAccountDetails: async (id: number): Promise<Account> => {
    const response = await apiClient.get(`/api/accounts/getDetails/${id}`);
    return response.data;
  },

  searchAccountContacts: async (
    accountId: number,
    query: string
  ): Promise<Contact[]> => {
    const response = await apiClient.get(
      `/api/accounts/${accountId}/contacts/search`,
      {
        params: { q: query },
      }
    );
    return response.data;
  },

  searchAccounts: async (query: string): Promise<Account[]> => {
    const response = await apiClient.get("/api/accounts/search", {
      params: { q: query },
    });
    return response.data;
  },

  deleteAccount: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/accounts/${id}`);
  },
  updateAccount: async (
    id: number,
    accountData: Partial<Account>
  ): Promise<Account> => {
    const response = await apiClient.put(`/api/accounts/${id}`, accountData);
    return response.data;
  },
};

// Contact Services
export const contactService = {
  getAllContacts: async (
    filters?: ContactFilters & { page?: number; limit?: number }
  ): Promise<PaginatedApiResponse<Contact>> => {
    const response = await apiClient.get("/api/contacts", { params: filters });
    return response.data;
  },

  getContactById: async (id: number): Promise<Contact> => {
    const response = await apiClient.get(`/api/contacts/${id}`);
    return response.data;
  },

  createContact: async (
    contactData: Omit<Contact, "id" | "createdAt" | "updatedAt">
  ): Promise<Contact> => {
    const response = await apiClient.post("/api/contacts", contactData);
    return response.data;
  },

  updateContact: async (
    id: number,
    contactData: Partial<Contact>
  ): Promise<Contact> => {
    const response = await apiClient.put(`/api/contacts/${id}`, contactData);
    return response.data;
  },

  deleteContact: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/contacts/${id}`);
  },

  searchContacts: async (query: string): Promise<Contact[]> => {
    const response = await apiClient.get("/api/contacts/search", {
      params: { q: query },
    });
    return response.data;
  },
};

// Campaign Services
export const campaignService = {
  getAllCampaigns: async (filters?: CampaignFilters): Promise<Campaign[]> => {
    const response = await apiClient.get("/api/campaigns", { params: filters });
    return response.data;
  },

  getCampaignById: async (id: number): Promise<Campaign> => {
    const response = await apiClient.get(`/api/campaigns/${id}`);
    return response.data;
  },

  createCampaign: async (
    campaignData: Omit<Campaign, "id" | "createdAt" | "updatedAt">
  ): Promise<Campaign> => {
    const response = await apiClient.post("/api/campaigns", campaignData);
    return response.data;
  },

  updateCampaign: async (
    id: number,
    campaignData: Partial<Campaign>
  ): Promise<Campaign> => {
    const response = await apiClient.put(`/api/campaigns/${id}`, campaignData);
    return response.data;
  },

  deleteCampaign: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/campaigns/${id}`);
  },
};

// Analytics Services
export const analyticsService = {
  getAllEvents: async (params?: {
    campaignId?: number;
    contactId?: number;
    leadId?: number;
    eventType?: string;
  }): Promise<AnalyticsEvent[]> => {
    const response = await apiClient.get("/api/analytics/events", { params });
    return response.data;
  },

  createEvent: async (
    eventData: Omit<AnalyticsEvent, "id" | "occurredAt">
  ): Promise<AnalyticsEvent> => {
    const response = await apiClient.post("/api/analytics/events", eventData);
    return response.data;
  },

  getEventById: async (id: number): Promise<AnalyticsEvent> => {
    const response = await apiClient.get(`/api/analytics/events/${id}`);
    return response.data;
  },

  getEventsByCampaign: async (
    campaignId: number
  ): Promise<AnalyticsEvent[]> => {
    const response = await apiClient.get(
      `/api/analytics/events/campaign/${campaignId}`
    );
    return response.data;
  },

  getEventsByContact: async (contactId: number): Promise<AnalyticsEvent[]> => {
    const response = await apiClient.get(
      `/api/analytics/events/contact/${contactId}`
    );
    return response.data;
  },

  getEventsByLead: async (leadId: number): Promise<AnalyticsEvent[]> => {
    const response = await apiClient.get(
      `/api/analytics/events/lead/${leadId}`
    );
    return response.data;
  },
};

// WhatsApp / Messaging Services
export const whatsappService = {
  // Accounts
  listAccounts: async (): Promise<MessagingAccount[]> => {
    const response = await apiClient.get("/api/whatsapp/accounts");
    return response.data;
  },
  createAccount: async (
    data: Partial<MessagingAccount>
  ): Promise<MessagingAccount> => {
    const response = await apiClient.post("/api/whatsapp/accounts", data);
    return response.data;
  },
  // Templates
  listTemplates: async (accountId: number): Promise<MessageTemplate[]> => {
    const response = await apiClient.get("/api/whatsapp/templates", {
      params: { accountId },
    });
    return response.data;
  },
  syncTemplates: async (accountId: number): Promise<{ count: number }> => {
    const response = await apiClient.post("/api/whatsapp/templates/sync", {
      accountId,
    });
    return response.data;
  },
  createTemplate: async (data: {
    accountId: number;
    template_name: string;
    language: string;
    category: string;
    button_url?: boolean;
    message_ttl?: number;
    components: any[];
  }): Promise<MessageTemplate> => {
    const response = await apiClient.post("/api/whatsapp/templates", data);
    return response.data;
  },
  uploadTemplateMedia: async (data: {
    accountId: number;
    mediaBase64: string;
    mimeType: string;
  }): Promise<{ headerHandle: string }> => {
    const response = await apiClient.post(
      "/api/whatsapp/templates/upload-media",
      data
    );
    return response.data;
  },
  uploadCampaignMedia: async (data: {
    mediaBase64: string;
    mimeType: string;
    filename?: string;
  }): Promise<{ url: string; key: string }> => {
    const response = await apiClient.post(
      "/api/whatsapp/campaigns/upload-media",
      data
    );
    return response.data;
  },
  updateTemplate: async (
    templateName: string,
    data: {
      accountId: number;
      components: any[];
    }
  ): Promise<any> => {
    const response = await apiClient.put(
      `/api/whatsapp/templates/${encodeURIComponent(templateName)}`,
      data
    );
    return response.data;
  },
  deleteTemplate: async (
    templateName: string,
    accountId: number
  ): Promise<any> => {
    const response = await apiClient.delete(
      `/api/whatsapp/templates/${encodeURIComponent(templateName)}`,
      {
        params: { accountId },
      }
    );
    return response.data;
  },
  // Numbers
  syncNumbers: async (): Promise<{
    synced: number;
    errors: number;
    details: any;
  }> => {
    const response = await apiClient.post("/api/whatsapp/numbers/sync");
    return response.data;
  },
  updateNumber: async (
    numberId: number,
    data: { displayName: string; status: string }
  ): Promise<MessagingAccount> => {
    const response = await apiClient.patch(
      `/api/whatsapp/accounts/${numberId}`,
      data
    );
    return response.data;
  },
  // Campaigns
  listCampaigns: async (): Promise<any[]> => {
    const response = await apiClient.get("/api/whatsapp/campaigns");
    return response.data;
  },
  getCampaignById: async (id: number): Promise<any> => {
    const response = await apiClient.get(`/api/whatsapp/campaigns/${id}`);
    return response.data;
  },
  getCampaignConfig: async (
    id: number
  ): Promise<{
    id: number;
    name: string;
    description?: string;
    accountId: number;
    templateName: string;
    language?: string;
    messageParams?: Record<string, unknown>;
    audience: string;
    segmentId?: number;
    scheduledAt?: string;
  }> => {
    const response = await apiClient.get(
      `/api/whatsapp/campaigns/${id}/config`
    );
    return response.data;
  },
  createCampaign: async (payload: any): Promise<Campaign> => {
    const response = await apiClient.post("/api/whatsapp/campaigns", payload);
    return response.data;
  },
  updateCampaign: async (id: number, payload: any): Promise<any> => {
    const response = await apiClient.put(
      `/api/whatsapp/campaigns/${id}`,
      payload
    );
    return response.data;
  },
  sendCampaign: async (id: number): Promise<{ queued: number }> => {
    const response = await apiClient.post(`/api/whatsapp/campaigns/${id}/send`);
    return response.data;
  },
  scheduleCampaign: async (
    id: number,
    scheduledAt: string
  ): Promise<{ scheduled: boolean }> => {
    const response = await apiClient.post(
      `/api/whatsapp/campaigns/${id}/schedule`,
      { scheduledAt }
    );
    return response.data;
  },
  // Data
  listDeliveries: async (campaignId: number): Promise<CampaignDelivery[]> => {
    const response = await apiClient.get("/api/whatsapp/deliveries", {
      params: { campaignId },
    });
    return response.data;
  },
  listEvents: async (campaignId: number): Promise<AnalyticsEvent[]> => {
    const response = await apiClient.get("/api/whatsapp/events", {
      params: { campaignId },
    });
    return response.data;
  },
  // Opt-out
  optOut: async (
    address: string,
    reason?: string,
    source?: string
  ): Promise<any> => {
    const response = await apiClient.post("/api/whatsapp/optout", {
      channel: "whatsapp",
      address,
      reason,
      source,
    });
    return response.data;
  },
  removeOptOut: async (address: string): Promise<{ removed: boolean }> => {
    const response = await apiClient.delete("/api/whatsapp/optout", {
      params: { channel: "whatsapp", address },
    });
    return response.data;
  },
};

// Webhook Services
export const webhookService = {
  handleLandingiWebhook: async (
    payload: WebhookPayload
  ): Promise<WebhookResponse> => {
    const response = await apiClient.post("/api/webhook/landingi", payload);
    return response.data;
  },

  testLandingiWebhook: async (): Promise<WebhookResponse> => {
    const response = await apiClient.get("/api/webhook/landingi/test");
    return response.data;
  },
};

// Dashboard Services
export const dashboardService = {
  getLeadsGeneratedOverTime: async (params?: {
    period?: "week" | "month";
    startDate?: string;
    endDate?: string;
  }): Promise<DashboardChartData> => {
    const response = await apiClient.get("/api/dashboard/leads-generated", {
      params,
    });
    return response.data;
  },

  getConversionRate: async (): Promise<DashboardChartData> => {
    const response = await apiClient.get("/api/dashboard/conversion-rate");
    return response.data;
  },

  getLeadSources: async (): Promise<DashboardChartData> => {
    const response = await apiClient.get("/api/dashboard/lead-sources");
    return response.data;
  },

  getKeyMetrics: async (): Promise<DashboardMetric[]> => {
    const response = await apiClient.get("/api/dashboard/key-metrics");
    return response.data;
  },
};

// Brevo Services
export const brevoService = {
  syncLeads: async (leadIds: number[]): Promise<SyncLeadsResponse> => {
    const response = await apiClient.post("/api/brevo/sync-leads", { leadIds });
    return response.data;
  },

  getCampaigns: async (params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<{ campaigns: BrevoCampaign[]; count: number; total: number }> => {
    const response = await apiClient.get("/api/brevo/campaigns", { params });
    return response.data;
  },

  getActiveCampaigns: async (): Promise<{
    campaigns: BrevoCampaign[];
    count: number;
  }> => {
    const response = await apiClient.get("/api/brevo/campaigns/active");
    return response.data;
  },

  getCampaignDetails: async (
    id: number,
    statistics?: string
  ): Promise<BrevoCampaign> => {
    const params = statistics ? { statistics } : {};
    const response = await apiClient.get(`/api/brevo/campaigns/${id}`, {
      params,
    });
    return response.data;
  },

  deleteCampaign: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/brevo/campaigns/${id}`);
  },

  updateCampaign: async (
    id: number,
    data: UpdateCampaignRequest
  ): Promise<BrevoCampaign> => {
    const response = await apiClient.put(`/api/brevo/campaigns/${id}`, data);
    return response.data;
  },

  updateCampaignStatus: async (id: number, status: string): Promise<void> => {
    await apiClient.put(`/api/brevo/campaigns/${id}/status`, { status });
  },

  getAnalytics: async (): Promise<BrevoAnalyticsResponse> => {
    const response = await apiClient.get("/api/brevo/analytics");
    return response.data;
  },

  testConnection: async (): Promise<{ status: string; message: string }> => {
    const response = await apiClient.get("/api/brevo/test-connection");
    return response.data;
  },
};

// Sales Services
export const salesService = {
  // Get all leads assigned to the current sales user
  getMyLeads: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    source?: string;
  }): Promise<SalesMyLeadsResponse> => {
    const response = await apiClient.get("/api/sales/leads", { params });
    return response.data;
  },

  // Get a specific lead by ID (only if assigned to this sales user)
  getLeadById: async (id: number): Promise<Lead> => {
    const response = await apiClient.get(`/api/sales/leads/${id}`);
    return response.data;
  },

  // Qualify a lead
  qualifyLead: async (id: number): Promise<{ message: string; lead: Lead }> => {
    const response = await apiClient.put(`/api/sales/leads/${id}/qualify`);
    return response.data;
  },

  // Disqualify a lead
  disqualifyLead: async (
    id: number
  ): Promise<{ message: string; lead: Lead }> => {
    const response = await apiClient.put(`/api/sales/leads/${id}/disqualify`);
    return response.data;
  },

  // Add a remark to a lead
  addRemark: async (
    id: number,
    remark: string
  ): Promise<{ message: string; remark: any }> => {
    const response = await apiClient.post(`/api/sales/leads/${id}/remarks`, {
      remark,
    });
    return response.data;
  },

  // Get all remarks for a specific lead
  getLeadRemarks: async (id: number): Promise<{ remarks: any[] }> => {
    const response = await apiClient.get(`/api/sales/leads/${id}/remarks`);
    return response.data;
  },

  // Get statistics for the sales user's leads
  getMyStats: async (): Promise<SalesMyStatsResponse> => {
    const response = await apiClient.get("/api/sales/stats");
    return response.data;
  },

  // Resolve an enquiry
  resolveEnquiry: async (
    id: number
  ): Promise<{ message: string; enquiry: any }> => {
    const response = await apiClient.put(`/api/sales/enquiries/${id}/resolve`);
    return response.data;
  },
};

// Landing Page Campaign Services
export const landingPageCampaignService = {
  // Get all campaigns with pagination and filters
  getAllCampaigns: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  }) => {
    const response = await apiClient.get("/api/landing-page-campaigns", {
      params,
    });
    return response.data;
  },

  // Get campaign statistics
  getStats: async () => {
    const response = await apiClient.get<LandingPageCampaignStats>(
      "/api/landing-page-campaigns/stats"
    );
    return response.data;
  },

  // Get campaign by ID
  getCampaignById: async (id: number) => {
    const response = await apiClient.get(`/api/landing-page-campaigns/${id}`);
    return response.data;
  },

  // Get campaign by unique ID (public endpoint)
  getCampaignByUniqueId: async (uniqueId: string) => {
    const response = await apiClient.get(
      `/api/landing-page-campaigns/unique/${uniqueId}`
    );
    return response.data;
  },

  // Create campaign
  createCampaign: async (data: {
    name: string;
    description?: string;
    status?: string;
    createdBy?: number;
  }) => {
    const response = await apiClient.post("/api/landing-page-campaigns", data);
    return response.data;
  },

  // Update campaign
  updateCampaign: async (
    id: number,
    data: {
      name?: string;
      description?: string;
      status?: string;
    }
  ) => {
    const response = await apiClient.put(
      `/api/landing-page-campaigns/${id}`,
      data
    );
    return response.data;
  },

  // Delete campaign
  deleteCampaign: async (id: number) => {
    await apiClient.delete(`/api/landing-page-campaigns/${id}`);
  },
};

// Subdealer Services
export const subdealerService = {
  checkPhone: async (phone: string): Promise<CheckPhoneResponse> => {
    const response = await apiClient.post("/api/subdealer/check-phone", {
      phone,
    });
    return response.data;
  },

  fetchGstDetails: async (gstNumber: string): Promise<FetchGstResponse> => {
    const response = await apiClient.post("/api/subdealer/fetch-gst", {
      gstNumber,
    });
    return response.data;
  },

  generateOtp: async (phone: string): Promise<GenerateOtpResponse> => {
    const response = await apiClient.post("/api/subdealer/generate-otp", {
      phone,
    });
    return response.data;
  },

  verifyOtpAndRegister: async (
    data: VerifyOtpRequest
  ): Promise<VerifyOtpResponse> => {
    const response = await apiClient.post("/api/subdealer/verify-otp", data);
    return response.data;
  },

  login: async (
    data: SubdealerLoginRequest
  ): Promise<SubdealerAuthResponse> => {
    const response = await apiClient.post("/api/subdealer/login", data);
    return response.data;
  },
};

// Product Services
export const productService = {
  getAllProducts: async (filters?: {
    categoryId?: number;
    active?: boolean;
    search?: string;
  }): Promise<ApiResponse<Product[]>> => {
    const params = new URLSearchParams();
    if (filters?.categoryId)
      params.append("categoryId", filters.categoryId.toString());
    if (filters?.active !== undefined)
      params.append("active", filters.active.toString());
    if (filters?.search) params.append("search", filters.search);

    const queryString = params.toString();
    const url = queryString ? `/api/products?${queryString}` : "/api/products";
    const response = await apiClient.get(url);
    return response.data;
  },

  searchProducts: async (query: string): Promise<ApiResponse<Product[]>> => {
    const response = await apiClient.get(
      `/api/products/search?q=${encodeURIComponent(query)}`
    );
    return response.data;
  },

  getActiveProducts: async (): Promise<ApiResponse<Product[]>> => {
    const response = await apiClient.get("/api/products/active");
    return response.data;
  },

  getProductById: async (id: number): Promise<ApiResponse<Product>> => {
    const response = await apiClient.get(`/api/products/${id}`);
    return response.data;
  },

  createProduct: async (
    data: CreateProductInput
  ): Promise<ApiResponse<Product>> => {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("code", data.code);
    if (data.price !== undefined)
      formData.append("price", data.price.toString());
    formData.append("categoryId", data.categoryId.toString());
    if (data.description) formData.append("description", data.description);
    if (data.active !== undefined)
      formData.append("active", data.active.toString());
    if (data.component !== undefined)
      formData.append("component", data.component.toString());
    if (data.image) formData.append("image", data.image);

    const response = await apiClient.post("/api/products", formData);
    return response.data;
  },

  updateProduct: async (
    id: number,
    data: UpdateProductInput
  ): Promise<ApiResponse<Product>> => {
    const formData = new FormData();
    if (data.name) formData.append("name", data.name);
    if (data.code) formData.append("code", data.code);
    if (data.price !== undefined)
      formData.append("price", data.price.toString());
    if (data.categoryId !== undefined)
      formData.append("categoryId", data.categoryId.toString());
    if (data.description !== undefined)
      formData.append("description", data.description);
    if (data.active !== undefined)
      formData.append("active", data.active.toString());
    if (data.component !== undefined)
      formData.append("component", data.component.toString());
    if (data.image) formData.append("image", data.image);

    const response = await apiClient.put(`/api/products/${id}`, formData);
    return response.data;
  },

  deleteProduct: async (id: number): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/products/${id}`);
    return response.data;
  },
};

// PriceBook Services
export const pricebookService = {
  getAllPriceBooks: async (filters?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedApiResponse<PriceBook>> => {
    const response = await apiClient.get("/api/pricebooks", {
      params: filters,
    });
    return response.data;
  },

  getPriceBookById: async (id: number): Promise<PriceBook> => {
    const response = await apiClient.get(`/api/pricebooks/${id}`);
    return response.data;
  },

  createPriceBook: async (data: Partial<PriceBook>): Promise<PriceBook> => {
    const response = await apiClient.post("/api/pricebooks", data);
    return response.data;
  },

  updatePriceBook: async (
    id: number,
    data: Partial<PriceBook>
  ): Promise<PriceBook> => {
    const response = await apiClient.put(`/api/pricebooks/${id}`, data);
    return response.data;
  },

  deletePriceBook: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/pricebooks/${id}`);
  },
};

// PriceBookEntry Services
export const pricebookEntryService = {
  getAllPriceBookEntries: async (filters: {
    productId: number;
  }): Promise<PaginatedApiResponse<PriceBookEntry>> => {
    const response = await apiClient.get("/api/pricebook-entries", {
      params: filters,
    });
    return response.data;
  },

  // Backend returns { data: PriceBookEntry[] } (not paginated) for this endpoint.
  getPriceBookEntriesByPriceBookId: async (filters: {
    priceBookId: number;
  }): Promise<{ data: PriceBookEntry[] }> => {
    const response = await apiClient.get(
      `/api/pricebook-entries/pricebook/${filters.priceBookId}`,
      {
        params: filters,
      }
    );
    return response.data;
  },

  getPriceBookEntryById: async (id: number): Promise<PriceBookEntry> => {
    const response = await apiClient.get(`/api/pricebook-entries/${id}`);
    return response.data;
  },

  createPriceBookEntry: async (
    data: Partial<PriceBookEntry>
  ): Promise<PriceBookEntry> => {
    const response = await apiClient.post("/api/pricebook-entries", data);
    return response.data;
  },

  updatePriceBookEntry: async (
    id: number,
    data: Partial<PriceBookEntry>
  ): Promise<PriceBookEntry> => {
    const response = await apiClient.put(`/api/pricebook-entries/${id}`, data);
    return response.data;
  },

  deletePriceBookEntry: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/pricebook-entries/${id}`);
  },
};

// Product Category Services
export const productCategoryService = {
  getAllCategories: async (): Promise<ApiResponse<ProductCategory[]>> => {
    const response = await apiClient.get("/api/product-categories");
    return response.data;
  },

  getCategoryById: async (
    id: number
  ): Promise<ApiResponse<ProductCategory>> => {
    const response = await apiClient.get(`/api/product-categories/${id}`);
    return response.data;
  },

  createCategory: async (
    data: CreateCategoryInput
  ): Promise<ApiResponse<ProductCategory>> => {
    const response = await apiClient.post("/api/product-categories", data);
    return response.data;
  },

  updateCategory: async (
    id: number,
    data: UpdateCategoryInput
  ): Promise<ApiResponse<ProductCategory>> => {
    const response = await apiClient.put(`/api/product-categories/${id}`, data);
    return response.data;
  },

  deleteCategory: async (id: number): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/product-categories/${id}`);
    return response.data;
  },
};

// Segment Services
export const segmentService = {
  list: async (): Promise<Segment[]> => {
    const response = await apiClient.get("/api/segments");
    return response.data;
  },

  getById: async (id: number): Promise<Segment> => {
    const response = await apiClient.get(`/api/segments/${id}`);
    return response.data;
  },

  create: async (data: SegmentPayload): Promise<Segment> => {
    const response = await apiClient.post("/api/segments", data);
    return response.data;
  },

  update: async (id: number, data: SegmentPayload): Promise<Segment> => {
    const response = await apiClient.put(`/api/segments/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<{ success: boolean }> => {
    const response = await apiClient.delete(`/api/segments/${id}`);
    return response.data;
  },

  resolve: async (
    id: number,
    limit?: number
  ): Promise<SegmentResolveResponse> => {
    const response = await apiClient.post(`/api/segments/${id}/resolve`, {
      limit,
    });
    return response.data;
  },
};

// Keyword Services
export const keywordService = {
  getAllKeywords: async (search?: string): Promise<ApiResponse<Keyword[]>> => {
    const params = search ? { search } : {};
    const response = await apiClient.get("/api/keywords", { params });
    return response.data;
  },

  getKeywordById: async (id: number): Promise<ApiResponse<Keyword>> => {
    const response = await apiClient.get(`/api/keywords/${id}`);
    return response.data;
  },

  createKeyword: async (name: string): Promise<ApiResponse<Keyword>> => {
    const response = await apiClient.post("/api/keywords", { name });
    return response.data;
  },

  deleteKeyword: async (id: number): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/keywords/${id}`);
    return response.data;
  },

  searchKeywords: async (query: string): Promise<ApiResponse<Keyword[]>> => {
    const response = await apiClient.get("/api/keywords", {
      params: { search: query },
    });
    return response.data;
  },
};

// Quote Services
export type GetQuotesParams = {
  page?: number;
  limit?: number;
  status?: string;
  opportunityId?: number;
  accountId?: number;
  isPrimary?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export const quoteService = {
  getQuotes: async (
    params?: GetQuotesParams
  ): Promise<PaginatedApiResponse<QuoteListItem>> => {
    const response = await apiClient.get("/api/quotes", { params });
    return response.data;
  },
  getQuoteById: async (id: number): Promise<QuoteDetail> => {
    const response = await apiClient.get(`/api/quotes/${id}`);
    return response.data;
  },
  getQuoteLineItems: async (
    quoteId: number,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedApiResponse<QuoteLineItemApi>> => {
    const response = await apiClient.get(`/api/quotes/${quoteId}/line-items`, {
      params,
    });
    return response.data;
  },
  getQuoteOrders: async (
    quoteId: number
  ): Promise<PaginatedApiResponse<QuoteOrderItem>> => {
    const response = await apiClient.get(`/api/quotes/${quoteId}/orders`, {
      params: { page: 1, limit: 1 },
    });
    return response.data;
  },
  generateOrder: async (
    quoteId: number
  ): Promise<{ data: SalesOrderDetail }> => {
    const response = await apiClient.post(
      `/api/quotes/${quoteId}/generate-order`
    );
    return response.data;
  },
  downloadPdf: async (quoteId: number, quoteNumber: string): Promise<void> => {
    const response = await apiClient.get(`/api/quotes/${quoteId}/pdf`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${quoteNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
  setPrimary: async (quoteId: number): Promise<QuoteDetail> => {
    const response = await apiClient.patch(
      `/api/quotes/${quoteId}/set-primary`
    );
    return response.data;
  },
  updateQuoteStatus: async (
    quoteId: number,
    body: { status: string }
  ): Promise<QuoteDetail> => {
    const response = await apiClient.patch(`/api/quotes/${quoteId}`, body);
    return response.data;
  },
  submitForApproval: async (
    quoteId: number,
    body: { requestedToId: number; comment?: string }
  ): Promise<{ data: QuoteDetail; approval: unknown }> => {
    const response = await apiClient.post(
      `/api/quotes/${quoteId}/submit-for-approval`,
      body
    );
    return response.data;
  },
};

// Order Services
export const orderService = {
  createOrder: async (data: {
    subdealerId: number;
    lineItems: { productId: number; quantity: number }[];
  }): Promise<ApiResponse<any>> => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("subdealer_token")
        : null;
    const config = token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : {};
    const response = await apiClient.post("/api/orders", data, config);
    return response.data;
  },
};

// Invoice Services
export const invoiceService = {
  uploadInvoice: async (
    file: File,
    phone: string
  ): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("phone", phone);

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("subdealer_token")
        : null;
    const config = {
      headers: {
        "Content-Type": "multipart/form-data",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const response = await apiClient.post("/api/invoices", formData, config);
    return response.data;
  },
};

// Settings Service
export const settingsService = {
  getGlobalSettings: async (): Promise<Record<string, string>> => {
    const response = await apiClient.get("/api/settings/global-settings");
    return response.data;
  },

  updateGlobalSetting: async (key: string, value: string): Promise<any> => {
    const response = await apiClient.put("/api/settings/global-settings", {
      key,
      value,
    });
    return response.data;
  },

  getCurrencies: async (): Promise<any[]> => {
    const response = await apiClient.get("/api/settings/currencies");
    return response.data;
  },
};

// Health Check
export const healthService = {
  checkHealth: async (): Promise<{ status: string; database: string }> => {
    const response = await apiClient.get("/health");
    return response.data;
  },
};

// Aakraman Service - Sales User OTP Login & Order Booking
export interface AakramanUser {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  role: string;
  region: string | null;
  location: string | null;
}

export interface AakramanProduct {
  id: number;
  name: string;
  code: string;
  imageUrl: string | null;
  price: number | null;
  description: string | null;
  categoryId: number;
  active: boolean;
  category: {
    id: number;
    name: string;
  };
}

export interface AakramanCategory {
  id: number;
  name: string;
  description: string | null;
}

export interface AakramanOrderFirmDetails {
  firmName: string;
  ownerFirstName: string;
  ownerLastName: string;
  contactNumber: string;
  email?: string;
  city: string;
  state: string;
  pincode?: string;
  gst?: string;
}

export interface AakramanLineItem {
  productId: number;
  quantity: number;
}

export interface AakramanOrder {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount: number | null;
  firmName: string | null;
  ownerFirstName: string | null;
  ownerLastName: string | null;
  contactNumber: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  archived: boolean;
  archivedAt: string | null;
  archivedBy: number | null;
  createdAt: string;
  lineItems: Array<{
    id: number;
    productId: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    product: AakramanProduct;
  }>;
  salesUser?: AakramanUser;
}

// Create a separate axios instance for aakraman that uses the aakraman token
const getAakramanConfig = () => {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("aakraman_token")
      : null;
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

export const aakramanService = {
  // OTP Methods
  sendSmsOtp: async (
    phone: string
  ): Promise<{ success: boolean; message: string; expiresIn: number }> => {
    const response = await apiClient.post("/api/aakraman/send-otp/sms", {
      phone,
    });
    return response.data;
  },

  sendEmailOtp: async (
    email: string
  ): Promise<{ success: boolean; message: string; expiresIn: number }> => {
    const response = await apiClient.post("/api/aakraman/send-otp/email", {
      email,
    });
    return response.data;
  },

  verifyOtp: async (data: {
    phone?: string;
    email?: string;
    otp: string;
  }): Promise<{
    success: boolean;
    message: string;
    token: string;
    user: AakramanUser;
  }> => {
    const response = await apiClient.post("/api/aakraman/verify-otp", data);
    return response.data;
  },

  // User Methods
  getCurrentUser: async (): Promise<{ user: AakramanUser }> => {
    const response = await apiClient.get(
      "/api/aakraman/me",
      getAakramanConfig()
    );
    return response.data;
  },

  // Product Methods
  getProducts: async (params?: {
    search?: string;
    categoryId?: number;
  }): Promise<{
    products: AakramanProduct[];
    categories: AakramanCategory[];
  }> => {
    const response = await apiClient.get("/api/aakraman/products", {
      ...getAakramanConfig(),
      params,
    });
    return response.data;
  },

  // Order Methods
  createOrder: async (data: {
    firmDetails: AakramanOrderFirmDetails;
    lineItems: AakramanLineItem[];
  }): Promise<{ success: boolean; message: string; data: AakramanOrder }> => {
    const response = await apiClient.post(
      "/api/aakraman/orders",
      data,
      getAakramanConfig()
    );
    return response.data;
  },

  getMyOrders: async (): Promise<{ orders: AakramanOrder[] }> => {
    const response = await apiClient.get(
      "/api/aakraman/orders",
      getAakramanConfig()
    );
    return response.data;
  },

  // Auth helpers
  setToken: (token: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aakraman_token", token);
    }
  },

  getToken: (): string | null => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("aakraman_token");
    }
    return null;
  },

  removeToken: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("aakraman_token");
    }
  },

  isAuthenticated: (): boolean => {
    return !!aakramanService.getToken();
  },

  // Admin methods (uses regular auth token, not aakraman token)
  admin: {
    getAllOrders: async (params?: {
      region?: string;
      state?: string;
      city?: string;
      salesUserId?: number;
      productId?: number;
      search?: string;
      page?: number;
      limit?: number;
    }): Promise<PaginatedApiResponse<AakramanOrder>> => {
      const response = await apiClient.get("/api/aakraman/admin/orders", {
        params,
      });
      return response.data;
    },

    getOrderById: async (id: number): Promise<{ order: AakramanOrder }> => {
      const response = await apiClient.get(`/api/aakraman/admin/orders/${id}`);
      return response.data;
    },

    updateOrder: async (
      id: number,
      data: Partial<{
        status: string;
        firmName: string | null;
        ownerFirstName: string | null;
        ownerLastName: string | null;
        contactNumber: string | null;
        email: string | null;
        city: string | null;
        state: string | null;
        pincode: string | null;
      }>
    ): Promise<{ order: AakramanOrder }> => {
      const response = await apiClient.put(
        `/api/aakraman/admin/orders/${id}`,
        data
      );
      return response.data;
    },

    getSalesUsers: async (): Promise<{
      users: Array<{
        id: number;
        firstName: string | null;
        lastName: string | null;
        email: string;
        region: string | null;
        location: string | null;
      }>;
    }> => {
      const response = await apiClient.get("/api/aakraman/admin/sales-users");
      return response.data;
    },

    archiveOrder: async (
      id: number
    ): Promise<{ success: boolean; message: string; order: AakramanOrder }> => {
      const response = await apiClient.post(
        `/api/aakraman/admin/orders/${id}/archive`
      );
      return response.data;
    },

    unarchiveOrder: async (
      id: number
    ): Promise<{ success: boolean; message: string; order: AakramanOrder }> => {
      const response = await apiClient.post(
        `/api/aakraman/admin/orders/${id}/unarchive`
      );
      return response.data;
    },
  },
};

// Opportunity Services
export const opportunityService = {
  getAllOpportunities: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedApiResponse<OpportunityListItem>> => {
    const response = await apiClient.get("/api/opportunities", { params });
    return response.data;
  },

  getOpportunityById: async (
    id: number
  ): Promise<{ data: OpportunityDetail }> => {
    const response = await apiClient.get(`/api/opportunities/${id}`);
    return response.data;
  },

  create: async (
    data: CreateOpportunityInput
  ): Promise<{ data: OpportunityDetail }> => {
    const response = await apiClient.post("/api/opportunities", data);
    return response.data;
  },

  getOpportunityLineItems: async (
    opportunityId: number
  ): Promise<{ data: OpportunityLineItem[] }> => {
    const response = await apiClient.get(
      `/api/opportunities/${opportunityId}/line-items`
    );
    return response.data;
  },

  getOpportunityQuotes: async (
    opportunityId: number,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedApiResponse<OpportunityQuoteListItem>> => {
    const response = await apiClient.get(
      `/api/opportunities/${opportunityId}/quotes`,
      { params }
    );
    return response.data;
  },

  generateQuote: async (
    opportunityId: number,
    body?: {
      validUntil?: string;
      paymentTerms?: string | null;
      deliveryTerms?: string | null;
      notes?: string | null;
      internalNotes?: string | null;
    }
  ): Promise<{ data: QuoteDetail }> => {
    const response = await apiClient.post(
      `/api/opportunities/${opportunityId}/generate-quote`,
      body ?? {}
    );
    return response.data;
  },

  deleteOpportunity: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/opportunities/${id}`);
  },

  deleteOpportunityLineItem: async (
    opportunityId: number,
    lineItemId: number
  ): Promise<void> => {
    await apiClient.delete(
      `/api/opportunities/${opportunityId}/line-items/${lineItemId}`
    );
  },

  updateOpportunity: async (
    id: number,
    data: {
      stage?: string;
      name?: string;
      expectedCloseDate?: string | null;
      nextStep?: string | null;
      type?: string | null;
      leadSource?: string | null;
      priceBookId?: number | null;
    }
  ): Promise<{ data: OpportunityDetail }> => {
    const response = await apiClient.patch(`/api/opportunities/${id}`, data);
    return response.data;
  },

  addOpportunityLineItem: async (
    opportunityId: number,
    data: {
      productId: number;
      quantity?: number;
      listPrice?: number;
      discount?: number;
      description?: string | null;
    }
  ): Promise<{ data: OpportunityLineItem }> => {
    const response = await apiClient.post(
      `/api/opportunities/${opportunityId}/line-items`,
      data
    );
    return response.data;
  },

  updateOpportunityLineItem: async (
    opportunityId: number,
    lineItemId: number,
    data: {
      quantity?: number;
      listPrice?: number;
      discount?: number;
      description?: string | null;
      sortOrder?: number;
    }
  ): Promise<{ data: any }> => {
    const response = await apiClient.patch(
      `/api/opportunities/${opportunityId}/line-items/${lineItemId}`,
      data
    );
    return response.data;
  },
};

// Notification Services
export const notificationService = {
  getAll: async (
    page = 1
  ): Promise<{
    data: {
      id: number;
      type: string;
      title: string;
      message: string;
      isRead: boolean;
      link: string | null;
      createdAt: string;
      readAt: string | null;
    }[];
    pagination: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
    };
    unreadCount: number;
  }> => {
    const response = await apiClient.get("/api/notifications", {
      params: { page },
    });
    return response.data;
  },

  markRead: async (id: number): Promise<void> => {
    await apiClient.patch(`/api/notifications/${id}/read`);
  },

  markAllRead: async (): Promise<void> => {
    await apiClient.patch("/api/notifications/read-all");
  },

  getPreferences: async (): Promise<{ data: NotificationPreference[] }> => {
    const response = await apiClient.get("/api/notifications/preferences");
    return response.data;
  },

  updatePreferences: async (
    preferences: { type: string; inApp: boolean; email: boolean }[]
  ): Promise<void> => {
    await apiClient.put("/api/notifications/preferences", { preferences });
  },
};

/** One configurable notification, as the API describes it. */
export type NotificationPreference = {
  type: string;
  label: string;
  description: string;
  group: string;
  supportsEmail: boolean;
  inApp: boolean;
  email: boolean;
};

// Sales Order Services
export const salesOrderService = {
  getAllOrders: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<{ data: SalesOrderListItem[]; pagination: any }> =>
    apiClient.get("/api/sales-orders", { params }).then(r => r.data),

  getOrderById: async (id: number): Promise<{ data: SalesOrderDetail }> =>
    apiClient
      .get(`/api/sales-orders/${id}/get-order-details`)
      .then(r => r.data),

  getLineItems: async (id: number): Promise<{ data: any[] }> =>
    apiClient.get(`/api/sales-orders/${id}/line-items`).then(r => r.data),

  downloadPdf: async (id: number, orderNumber: string): Promise<void> => {
    const response = await apiClient.get(`/api/sales-orders/${id}/pdf`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${orderNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// Approval Services
export const approvalService = {
  getAllApprovals: async (params?: {
    status?: string;
    targetObjectName?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedApiResponse<ApprovalProcessApi>> => {
    const response = await apiClient.get("/api/approvals", { params });
    return response.data;
  },

  getMyApprovals: async (params?: {
    type?: string;
    status?: string;
    targetObjectName?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedApiResponse<ApprovalProcessApi>> => {
    const response = await apiClient.get("/api/approvals/my", { params });
    return response.data;
  },

  getApprovalById: async (
    id: number
  ): Promise<{ data: ApprovalProcessApi }> => {
    const response = await apiClient.get(`/api/approvals/${id}`);
    return response.data;
  },

  actionApproval: async (
    id: number,
    data: { action: "APPROVE" | "REJECT"; comment?: string }
  ): Promise<{ data: ApprovalProcessApi }> => {
    const response = await apiClient.patch(`/api/approvals/${id}/action`, data);
    return response.data;
  },
};
