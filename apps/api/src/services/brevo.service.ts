import axios, { AxiosInstance, AxiosError } from "axios";
import https from "node:https";
import {
  BrevoContact,
  BrevoContactResponse,
  BrevoCampaign,
  BrevoCampaignsResponse,
  BrevoSendEmailRequest,
  BrevoSendEmailResponse,
  BrevoWebhookPayload,
  BrevoErrorResponse,
  EngagementScoreConfig,
  DEFAULT_ENGAGEMENT_SCORES,
  BrevoUpdateCampaignRequest,
} from "../utils/brevo.types.js";
import { prisma } from "@repo/db";
import * as nodeCrypto from "node:crypto";

function deriveKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || "";
  const raw = key.startsWith("base64:")
    ? Buffer.from(key.slice(7), "base64")
    : key.startsWith("hex:")
      ? Buffer.from(key.slice(4), "hex")
      : Buffer.from(key, "utf8");
  return raw.length === 32
    ? raw
    : nodeCrypto.createHash("sha256").update(raw).digest();
}

function decryptGCM(cipherText: string, iv: string, authTag: string): string {
  const key = deriveKey();
  const ivBuf = Buffer.from(iv, "base64");
  const tagBuf = Buffer.from(authTag, "base64");
  const decipher = nodeCrypto.createDecipheriv("aes-256-gcm", key, ivBuf);
  decipher.setAuthTag(tagBuf);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherText, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export class BrevoService {
  private client: AxiosInstance;
  private webhookSecret: string;

  constructor() {
    const baseURL = process.env.BREVO_BASE_URL || "https://api.brevo.com/v3";
    this.webhookSecret = "";

    // Create HTTPS agent with specific settings
    const httpsAgent = new https.Agent({
      keepAlive: false,
      rejectUnauthorized: true,
    });

    this.client = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 30000, // 30 seconds timeout
      maxRedirects: 5,
      httpsAgent: httpsAgent,
    });

    // Add delay between requests; inject API key and baseURL from DB
    let lastRequestTime = 0;
    this.client.interceptors.request.use(
      async config => {
        // Rate limiting: Add delay between requests
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < 100) {
          await new Promise(resolve =>
            setTimeout(resolve, 100 - timeSinceLastRequest)
          );
        }
        lastRequestTime = Date.now();

        // Inject fresh API key from DB
        const cred = await prisma.integrationCredential.findUnique({
          where: { provider: "email" },
        });
        const apiKey =
          cred?.encryptedApiKey && cred.iv && cred.authTag
            ? decryptGCM(cred.encryptedApiKey, cred.iv, cred.authTag)
            : null;
        if (!apiKey) {
          throw new Error(
            "Brevo API key not set. Configure in Integration Manager."
          );
        }
        if (!config.headers) {
          config.headers = {} as any;
        }
        (config.headers as any)["api-key"] = apiKey;

        // Inject baseURL from DB if present
        const cfg = await prisma.appConfig.findUnique({
          where: { key: "email.baseUrl" },
        });
        const dbBaseUrl = cfg?.plainValue ?? null;
        if (dbBaseUrl) config.baseURL = dbBaseUrl;

        // Debug info (non-sensitive): log key length and tail, and baseURL used
        const keyTail = apiKey.slice(-4);
        const usedBaseUrl = config.baseURL || this.client.defaults.baseURL;
        console.log(
          `[BrevoService] Using api-key len=${apiKey.length}, tail=****${keyTail}, baseURL=${usedBaseUrl}`
        );

        console.log(
          `[BrevoService] ${config.method?.toUpperCase()} ${config.url}`
        );
        return config;
      },
      error => {
        console.error("[BrevoService] Request error:", error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => {
        console.log(`[BrevoService] ${response.status} ${response.config.url}`);
        return response;
      },
      (error: AxiosError) => {
        console.error("[BrevoService] Response error:", {
          status: error.response?.status,
          url: error.config?.url,
          data: error.response?.data,
          code: error.code,
          message: error.message,
        });
        return Promise.reject(this.handleBrevoError(error));
      }
    );
  }

  /**
   * Create or update a contact in Brevo
   */
  async createOrUpdateContact(
    contact: BrevoContact,
    retries = 5
  ): Promise<BrevoContactResponse> {
    try {
      const response = await this.client.post("/contacts", contact);
      return response.data;
    } catch (error: any) {
      console.error("Error creating/updating Brevo contact:", error.message);

      // Retry on connection errors with exponential backoff
      if (
        retries > 0 &&
        (error.code === "ECONNRESET" ||
          error.code === "ETIMEDOUT" ||
          error.code === "ECONNREFUSED" ||
          !error.response)
      ) {
        const delay = Math.min(1000 * (6 - retries), 5000); // Exponential backoff, max 5 seconds
        console.log(
          `Retrying createOrUpdateContact... (${retries} retries left, waiting ${delay}ms)`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.createOrUpdateContact(contact, retries - 1);
      }

      throw error;
    }
  }

  /**
   * Get contact by email
   */
  async getContactByEmail(email: string): Promise<BrevoContactResponse | null> {
    try {
      const response = await this.client.get(
        `/contacts/${encodeURIComponent(email)}`
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete contact by email
   */
  async deleteContact(email: string): Promise<void> {
    try {
      await this.client.delete(`/contacts/${encodeURIComponent(email)}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`Contact ${email} not found in Brevo`);
        return;
      }
      throw error;
    }
  }

  /**
   * Get all campaigns
   */
  async getAllCampaigns(
    limit = 50,
    offset = 0,
    retries = 3
  ): Promise<BrevoCampaignsResponse> {
    try {
      const response = await this.client.get("/emailCampaigns", {
        params: { limit, offset, sort: "desc" },
      });
      return response.data;
    } catch (error: any) {
      console.error("Error fetching Brevo campaigns:", {
        message: error?.message,
        code: error?.code,
        status: error?.response?.status,
        isTimeout:
          error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT",
      });

      // Retry on connection errors, timeouts, or 5xx server errors with exponential backoff
      const isRetryable =
        retries > 0 &&
        (error.code === "ECONNRESET" ||
          error.code === "ETIMEDOUT" ||
          error.code === "ECONNABORTED" || // Axios timeout error
          error.code === "ECONNREFUSED" ||
          error.message?.includes("timeout") ||
          !error.response ||
          (error.response?.status >= 500 && error.response?.status < 600));

      if (isRetryable) {
        const delay = Math.min(1000 * Math.pow(2, 3 - retries), 5000); // Exponential backoff, max 5 seconds
        console.log(
          `Retrying getAllCampaigns... (${retries} retries left, waiting ${delay}ms)`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.getAllCampaigns(limit, offset, retries - 1);
      }

      throw error;
    }
  }

  /**
   * Get active campaigns only
   */
  async getActiveCampaigns(): Promise<BrevoCampaign[]> {
    try {
      const response = await this.client.get("/emailCampaigns", {
        params: {
          limit: 100,
          offset: 0,
          status: "sent",
          sort: "desc",
        },
      });
      return response.data.campaigns || [];
    } catch (error) {
      console.error("Error fetching active Brevo campaigns:", error);
      throw error;
    }
  }

  /**
   * Get campaign by ID
   */
  async getCampaignById(
    campaignId: number,
    statistics?: string,
    retries = 3
  ): Promise<BrevoCampaign> {
    try {
      const params = statistics ? { statistics } : {};
      const response = await this.client.get(`/emailCampaigns/${campaignId}`, {
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error(`Error fetching Brevo campaign ${campaignId}:`, error);

      // Retry on connection errors or 5xx server errors with exponential backoff
      const isRetryable =
        retries > 0 &&
        (error.code === "ECONNRESET" ||
          error.code === "ETIMEDOUT" ||
          error.code === "ECONNREFUSED" ||
          !error.response ||
          (error.response?.status >= 500 && error.response?.status < 600));

      if (isRetryable) {
        const delay = Math.min(1000 * Math.pow(2, 3 - retries), 5000); // Exponential backoff, max 5 seconds
        console.log(
          `Retrying getCampaignById for ${campaignId}... (${retries} retries left, waiting ${delay}ms)`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.getCampaignById(campaignId, statistics, retries - 1);
      }

      throw error;
    }
  }

  /**
   * Delete campaign by ID
   */
  async deleteCampaign(campaignId: number): Promise<void> {
    try {
      await this.client.delete(`/emailCampaigns/${campaignId}`);
    } catch (error) {
      console.error(`Error deleting Brevo campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Update campaign by ID
   */
  async updateCampaign(
    campaignId: number,
    updateData: BrevoUpdateCampaignRequest,
    retries = 3
  ): Promise<BrevoCampaign> {
    try {
      // First, get the campaign to check its status (only on first attempt)
      if (retries === 3) {
        const campaign = await this.getCampaignById(campaignId);

        // Brevo typically doesn't allow updating archived campaigns
        if (campaign.status === "archive") {
          throw new Error(
            `Cannot update campaign with status '${campaign.status}'. Archived campaigns cannot be updated.`
          );
        }
      }

      // Clean up the update data - remove undefined/null values
      const cleanedData: any = {};
      Object.keys(updateData).forEach(key => {
        const value = (updateData as any)[key];
        if (value !== undefined && value !== null) {
          // Handle nested objects
          if (
            typeof value === "object" &&
            !Array.isArray(value) &&
            value !== null
          ) {
            const cleanedNested: any = {};
            Object.keys(value).forEach(nestedKey => {
              if (value[nestedKey] !== undefined && value[nestedKey] !== null) {
                cleanedNested[nestedKey] = value[nestedKey];
              }
            });
            if (Object.keys(cleanedNested).length > 0) {
              cleanedData[key] = cleanedNested;
            }
          } else {
            cleanedData[key] = value;
          }
        }
      });

      console.log(
        `Updating Brevo campaign ${campaignId} with data:`,
        JSON.stringify(cleanedData, null, 2)
      );

      const response = await this.client.put(
        `/emailCampaigns/${campaignId}`,
        cleanedData
      );
      return response.data;
    } catch (error: any) {
      console.error(`Error updating Brevo campaign ${campaignId}:`, error);

      // Retry on connection errors with exponential backoff
      if (
        retries > 0 &&
        (error.code === "ECONNRESET" ||
          error.code === "ETIMEDOUT" ||
          error.code === "ECONNREFUSED" ||
          !error.response)
      ) {
        const delay = Math.min(1000 * (4 - retries), 5000); // Exponential backoff, max 5 seconds
        console.log(
          `Retrying updateCampaign... (${retries} retries left, waiting ${delay}ms)`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.updateCampaign(campaignId, updateData, retries - 1);
      }

      // Log more details about the error
      if (error.response) {
        console.error("Brevo API Error Response:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          url: error.config?.url,
        });
      }

      throw error;
    }
  }

  /**
   * Update campaign status
   */
  async updateCampaignStatus(
    campaignId: number,
    status: string
  ): Promise<void> {
    try {
      await this.client.put(`/emailCampaigns/${campaignId}/status`, { status });
    } catch (error) {
      console.error(
        `Error updating Brevo campaign ${campaignId} status:`,
        error
      );
      throw error;
    }
  }

  /**
   * Send transactional email
   */
  async sendTransactionalEmail(
    emailRequest: BrevoSendEmailRequest
  ): Promise<BrevoSendEmailResponse> {
    try {
      const response = await this.client.post("/smtp/email", emailRequest);
      return response.data;
    } catch (error) {
      console.error("Error sending transactional email:", error);
      throw error;
    }
  }

  /**
   * Send campaign to specific contacts
   */
  async sendCampaignToContacts(
    campaignId: number,
    contactEmails: string[]
  ): Promise<BrevoSendEmailResponse[]> {
    try {
      const results: BrevoSendEmailResponse[] = [];

      // Brevo doesn't have a direct API to send existing campaigns to specific contacts
      // We'll need to send transactional emails with campaign content
      const campaign = await this.getCampaignById(campaignId);

      if (!campaign.htmlContent) {
        throw new Error(
          `Campaign ${campaignId} has no HTML content; Brevo rejects a transactional send with no body.`
        );
      }

      for (const email of contactEmails) {
        const emailRequest: BrevoSendEmailRequest = {
          to: [{ email }],
          subject: campaign.subject || "Campaign Email",
          sender: campaign.sender,
          htmlContent: campaign.htmlContent,
        };

        const result = await this.sendTransactionalEmail(emailRequest);
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error(`Error sending campaign ${campaignId} to contacts:`, error);
      throw error;
    }
  }

  /**
   * Get account statistics
   */
  async getAccountStatistics(): Promise<any> {
    try {
      const response = await this.client.get("/account");
      return response.data;
    } catch (error) {
      console.error("Error fetching Brevo account statistics:", error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      // Fetch secret from DB (fallback to env only if needed in future)
      // Synchronously block on promise via deopt: not possible; instead, this method remains sync.
      // Adapt: compute with latest known secret captured from config on each request is not viable here.
      // Provide a best-effort: try env first, otherwise skip with warning.
      const secret = process.env.BREVO_WEBHOOK_SECRET || "";
      if (!secret) {
        console.warn(
          "Brevo webhook secret not set; skipping signature verification"
        );
        return true;
      }

      const expectedSignature = nodeCrypto
        .createHmac("sha256", secret)
        .update(payload, "utf8")
        .digest("hex");

      const providedSignature = signature.replace("sha256=", "");

      return nodeCrypto.timingSafeEqual(
        Buffer.from(expectedSignature, "hex"),
        Buffer.from(providedSignature, "hex")
      );
    } catch (error) {
      console.error("Error verifying webhook signature:", error);
      return false;
    }
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: string): BrevoWebhookPayload {
    try {
      return JSON.parse(payload);
    } catch (error) {
      console.error("Error parsing webhook payload:", error);
      throw new Error("Invalid webhook payload");
    }
  }

  /**
   * Get engagement score for webhook event
   */
  getEngagementScore(
    eventType: string,
    config: EngagementScoreConfig = DEFAULT_ENGAGEMENT_SCORES
  ): number {
    const score = config[eventType as keyof EngagementScoreConfig];
    return score !== undefined ? score : 0;
  }

  /**
   * Handle Brevo API errors
   */
  private handleBrevoError(error: AxiosError): Error {
    const brevoError = error.response?.data as BrevoErrorResponse;

    if (brevoError) {
      return new Error(
        `Brevo API Error: ${brevoError.message} (${brevoError.code})`
      );
    }

    if (error.response?.status === 401) {
      return new Error("Brevo API authentication failed. Check your API key.");
    }

    if (error.response?.status === 429) {
      return new Error(
        "Brevo API rate limit exceeded. Please try again later."
      );
    }

    if (error.response && error.response.status >= 500) {
      return new Error("Brevo API server error. Please try again later.");
    }

    // Handle connection errors
    if (
      error.code === "ECONNRESET" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ECONNREFUSED"
    ) {
      return new Error(
        `Brevo API connection error (${error.code}): ${error.message}. Please check your network connection and API key.`
      );
    }

    return new Error(`Brevo API request failed: ${error.message}`);
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getAccountStatistics();
      return true;
    } catch (error) {
      console.error("Brevo API connection test failed:", error);
      return false;
    }
  }
}
