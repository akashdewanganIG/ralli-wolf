export interface BrevoContact {
  email: string;
  attributes?: {
    FIRSTNAME?: string;
    LASTNAME?: string;
    SMS?: string;
    COMPANY?: string;
    LOCATION?: string;
    SOURCE?: string;
    LEAD_SCORE?: number;
    [key: string]: unknown;
  };
  listIds?: number[];
  updateEnabled?: boolean;
  getId?: boolean;
}

export interface BrevoContactResponse {
  id: number;
  email: string;
  attributes: Record<string, unknown>;
  emailBlacklisted: boolean;
  smsBlacklisted: boolean;
  createdAt: string;
  modifiedAt: string;
  listIds: number[];
}

export interface BrevoCreateContactResponse {
  id: number;
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
  sender: {
    id?: number;
    name: string;
    email: string;
  };
  recipients?: {
    lists?: number[];
    exclusionLists?: number[];
    listIds?: number[];
  };
  statistics?: BrevoCampaignStatistics;
  replyTo?: string;
  previewText?: string;
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

export interface BrevoCampaignsResponse {
  campaigns: BrevoCampaign[];
  count: number;
}

export interface BrevoSendEmailRequest {
  to: Array<{
    email: string;
    name?: string;
  }>;
  templateId?: number;
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  sender: {
    name: string;
    email: string;
  };
  replyTo?: {
    email: string;
    name?: string;
  };
  attachment?: Array<{
    url: string;
    name: string;
  }>;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  tags?: string[];
}

export interface BrevoSendEmailResponse {
  messageId: string;
}

export interface BrevoAccountDetails {
  organization_id: string;
  user_id: number;
  enterprise: boolean;
  companyName: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: Array<{
    type: string;
    creditsType: string;
    credits: number;
  }>;
}

export interface BrevoAggregatedEmailStats {
  requests: number;
  delivered: number;
  opens: number;
  clicks: number;
  hardBounces: number;
  softBounces: number;
  blocked: number;
  invalid: number;
  spamReports: number;
  uniqueClicks: number;
  uniqueOpens: number;
  unsubscribed: number;
  range?: string;
}

export interface BrevoErrorResponse {
  code: string;
  message: string;
  details?: unknown;
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

export interface SendCampaignResponse {
  successful: Array<{
    leadId: number;
    email: string;
    messageId: string;
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

export interface BrevoAnalyticsResponse {
  totalCampaigns: number;
  sentCampaigns: number;
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

export interface BrevoUpdateCampaignRequest {
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
