import axios, { AxiosInstance, AxiosError } from "axios";
import https from "node:https";
import {
  BrevoContact,
  BrevoCreateContactResponse,
  BrevoContactResponse,
  BrevoCampaign,
  BrevoCampaignsResponse,
  BrevoAccountDetails,
  BrevoAggregatedEmailStats,
  BrevoSendEmailRequest,
  BrevoSendEmailResponse,
  BrevoErrorResponse,
  BrevoUpdateCampaignRequest,
} from "../utils/brevo.types.js";
import { prisma } from "@repo/db";
import { decryptSecret } from "@repo/db/crypto";
import {
  assertProviderUrl,
  normalizeProviderBaseUrl,
} from "../utils/provider-url.js";

const BREVO_API_BASE_URL = "https://api.brevo.com/v3";

export class BrevoProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly providerCode?: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = "BrevoProviderError";
  }
}

function isRetryable(error: unknown): boolean {
  return error instanceof BrevoProviderError && error.retryable;
}

async function retryDelay(attempt: number): Promise<void> {
  const delay = Math.min(500 * 2 ** Math.max(0, attempt - 1), 5_000);
  await new Promise(resolve => setTimeout(resolve, delay));
}

export class BrevoService {
  private client: AxiosInstance;

  constructor() {
    const baseURL = normalizeProviderBaseUrl(BREVO_API_BASE_URL, "brevo");

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
      timeout: 30000,

      maxRedirects: 0,
      httpsAgent: httpsAgent,
    });

    let lastRequestTime = 0;
    let throttle = Promise.resolve();
    this.client.interceptors.request.use(
      async config => {
        const turn = throttle.then(async () => {
          const waitFor = 100 - (Date.now() - lastRequestTime);
          if (waitFor > 0) {
            await new Promise(resolve => setTimeout(resolve, waitFor));
          }
          lastRequestTime = Date.now();
        });
        throttle = turn.catch(() => undefined);
        await turn;

        const [cred, cfg] = await Promise.all([
          prisma.integrationCredential.findUnique({
            where: { provider: "email" },
          }),
          prisma.appConfig.findUnique({
            where: { key: "email.baseUrl" },
          }),
        ]);
        const apiKey =
          cred?.encryptedApiKey && cred.iv && cred.authTag
            ? decryptSecret(cred.encryptedApiKey, cred.iv, cred.authTag)
            : null;
        if (!apiKey) {
          throw new Error(
            "Brevo API key not set. Configure in Integration Manager."
          );
        }
        config.headers.set("api-key", apiKey);

        const dbBaseUrl = cfg?.plainValue ?? null;
        if (dbBaseUrl) {
          config.baseURL = normalizeProviderBaseUrl(dbBaseUrl, "brevo");
        }

        const usedBaseUrl = config.baseURL || this.client.defaults.baseURL;
        assertProviderUrl(String(usedBaseUrl), "brevo");

        return config;
      },
      error => {
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      response => {
        return response;
      },
      (error: AxiosError) => {
        return Promise.reject(this.handleBrevoError(error));
      }
    );
  }

  async createOrUpdateContact(
    contact: BrevoContact,
    retries = 5
  ): Promise<BrevoCreateContactResponse> {
    try {
      const response = await this.client.post<BrevoCreateContactResponse>(
        "/contacts",
        contact
      );
      if (!Number.isSafeInteger(response.data?.id) || response.data.id <= 0) {
        throw new BrevoProviderError(
          "Brevo returned an invalid contact identifier"
        );
      }
      return response.data;
    } catch (error: unknown) {
      if (retries > 0 && isRetryable(error)) {
        await retryDelay(6 - retries);
        return this.createOrUpdateContact(contact, retries - 1);
      }

      throw error;
    }
  }

  async getContactByEmail(email: string): Promise<BrevoContactResponse | null> {
    try {
      const response = await this.client.get(
        `/contacts/${encodeURIComponent(email)}`
      );
      return response.data;
    } catch (error: unknown) {
      if (error instanceof BrevoProviderError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async deleteContact(email: string): Promise<void> {
    try {
      await this.client.delete(`/contacts/${encodeURIComponent(email)}`);
    } catch (error: unknown) {
      if (error instanceof BrevoProviderError && error.status === 404) {
        return;
      }
      throw error;
    }
  }

  async getAllCampaigns(
    limit = 50,
    offset = 0,
    status?: BrevoCampaign["status"],
    retries = 3
  ): Promise<BrevoCampaignsResponse> {
    try {
      const response = await this.client.get<BrevoCampaignsResponse>(
        "/emailCampaigns",
        {
          params: {
            limit,
            offset,
            sort: "desc",
            statistics: "globalStats",
            excludeHtmlContent: true,
            ...(status ? { status } : {}),
          },
        }
      );
      return response.data;
    } catch (error: unknown) {
      if (retries > 0 && isRetryable(error)) {
        await retryDelay(4 - retries);
        return this.getAllCampaigns(limit, offset, status, retries - 1);
      }

      throw error;
    }
  }

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
    } catch (error: unknown) {
      if (retries > 0 && isRetryable(error)) {
        await retryDelay(4 - retries);
        return this.getCampaignById(campaignId, statistics, retries - 1);
      }

      throw error;
    }
  }

  async deleteCampaign(campaignId: number): Promise<void> {
    await this.client.delete(`/emailCampaigns/${campaignId}`);
  }

  async updateCampaign(
    campaignId: number,
    updateData: BrevoUpdateCampaignRequest,
    retries = 3
  ): Promise<BrevoCampaign> {
    try {
      if (retries === 3) {
        const campaign = await this.getCampaignById(campaignId);

        if (campaign.status === "archive") {
          throw new Error(
            `Cannot update campaign with status '${campaign.status}'. Archived campaigns cannot be updated.`
          );
        }
      }

      const cleanedData = Object.fromEntries(
        Object.entries(updateData).filter(
          ([, value]) => value !== undefined && value !== null
        )
      ) as BrevoUpdateCampaignRequest;

      const response = await this.client.put(
        `/emailCampaigns/${campaignId}`,
        cleanedData
      );
      return response.data;
    } catch (error: unknown) {
      if (retries > 0 && isRetryable(error)) {
        await retryDelay(4 - retries);
        return this.updateCampaign(campaignId, updateData, retries - 1);
      }

      throw error;
    }
  }

  async updateCampaignStatus(
    campaignId: number,
    status: string
  ): Promise<void> {
    await this.client.put(`/emailCampaigns/${campaignId}/status`, { status });
  }

  async sendTransactionalEmail(
    emailRequest: BrevoSendEmailRequest
  ): Promise<BrevoSendEmailResponse> {
    const response = await this.client.post("/smtp/email", emailRequest);
    return response.data;
  }

  async getAccountDetails(): Promise<BrevoAccountDetails> {
    const response = await this.client.get<BrevoAccountDetails>("/account");
    return response.data;
  }

  async getAggregatedEmailStatistics(): Promise<BrevoAggregatedEmailStats> {
    const response = await this.client.get<BrevoAggregatedEmailStats>(
      "/smtp/statistics/aggregatedReport"
    );
    return response.data;
  }

  async getCampaignCount(status?: BrevoCampaign["status"]): Promise<number> {
    const response = await this.client.get<BrevoCampaignsResponse>(
      "/emailCampaigns",
      { params: { limit: 1, offset: 0, ...(status ? { status } : {}) } }
    );
    return response.data.count;
  }

  private handleBrevoError(error: AxiosError): Error {
    const status = error.response?.status;
    const responseData = error.response?.data;
    const brevoError =
      typeof responseData === "object" && responseData !== null
        ? (responseData as Partial<BrevoErrorResponse>)
        : null;
    const providerCode =
      typeof brevoError?.code === "string" ? brevoError.code : undefined;
    const retryable =
      !error.response ||
      status === 429 ||
      (status !== undefined && status >= 500) ||
      ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "ECONNREFUSED"].includes(
        error.code || ""
      );

    if (status === 401 || status === 403) {
      return new BrevoProviderError(
        "Brevo API authentication failed",
        status,
        providerCode,
        false
      );
    }
    if (status === 404) {
      return new BrevoProviderError(
        "Brevo resource not found",
        status,
        providerCode,
        false
      );
    }
    if (status === 400) {
      return new BrevoProviderError(
        "Brevo rejected the request",
        status,
        providerCode,
        false
      );
    }
    if (status === 429) {
      return new BrevoProviderError(
        "Brevo rate limit exceeded",
        status,
        providerCode,
        true
      );
    }
    if (status !== undefined && status >= 500) {
      return new BrevoProviderError(
        "Brevo service is temporarily unavailable",
        status,
        providerCode,
        true
      );
    }
    return new BrevoProviderError(
      "Brevo API request failed",
      status,
      providerCode,
      retryable
    );
  }
}
