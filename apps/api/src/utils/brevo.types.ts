// Brevo API Type Definitions
// Based on Brevo API documentation: https://developers.brevo.com/docs/getting-started

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
    [key: string]: any;
  };
  listIds?: number[];
  updateEnabled?: boolean;
}

export interface BrevoContactResponse {
  id: number;
  email: string;
  attributes: Record<string, any>;
  emailBlacklisted: boolean;
  smsBlacklisted: boolean;
  createdAt: string;
  modifiedAt: string;
  listIds: number[];
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
  params?: Record<string, any>;
  tags?: string[];
}

export interface BrevoSendEmailResponse {
  messageId: string;
}

export interface BrevoWebhookEvent {
  event:
    | "sent"
    | "delivered"
    | "opened"
    | "clicked"
    | "bounced"
    | "unsubscribed"
    | "spam";
  email: string;
  id: number;
  date: string;
  "message-id": string;
  ts_event: number;
  ts_click: number;
  tag?: string;
  link?: string;
  from?: string;
  subject?: string;
  campaign_id?: number;
  template_id?: number;
  ts_unsub?: number;
  ts_spam?: number;
  ts_bounce?: number;
  reason?: string;
  bounce_type?: "hard" | "soft";
  url?: string;
  ip?: string;
  user_agent?: string;
  geo?: {
    country: string;
    region: string;
    city: string;
  };
}

export interface BrevoWebhookPayload {
  event: BrevoWebhookEvent;
}

export interface BrevoAccountStats {
  plan: {
    type: string;
    creditsType: string;
    credits: number;
  };
  emailCredits: number;
  smsCredits: number;
  statistics: {
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    totalUnsubscribed: number;
    totalSpam: number;
  };
}

export interface BrevoErrorResponse {
  code: string;
  message: string;
  details?: any;
}

// Engagement scoring configuration
export interface EngagementScoreConfig {
  email_delivered: number;
  email_opened: number;
  email_clicked: number;
  email_bounced: number;
  email_unsubscribed: number;
  email_spam: number;
}

export const DEFAULT_ENGAGEMENT_SCORES: EngagementScoreConfig = {
  email_delivered: 2,
  email_opened: 5,
  email_clicked: 10,
  email_bounced: -5,
  email_unsubscribed: -10,
  email_spam: -15,
};

// Request/Response types for our API endpoints
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

export interface SendCampaignRequest {
  campaignId: number;
  leadIds: number[];
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
  replyTo?: string; // Brevo API expects a string (email), not an object
  previewText?: string;
  htmlContent?: string;
  textContent?: string;
  scheduledAt?: string;
  type?: "classic" | "trigger";
  [key: string]: any;
}

export interface BrevoUpdateCampaignStatusRequest {
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
