import type { Request, Response } from "express";
import { handleError, handleValidationError } from "../utils/error-handler.js";
import { prisma } from "@repo/db";
import { BrevoProviderError, BrevoService } from "../services/brevo.service.js";
import {
  parseBoundedInteger,
  parsePositiveInteger,
  parseUniquePositiveIntegerArray,
} from "../utils/validators.js";
import {
  BrevoContact,
  SyncLeadsResponse,
  SendCampaignResponse,
  BrevoAnalyticsResponse,
} from "../utils/brevo.types.js";
import { decryptSecret } from "@repo/db/crypto";
import {
  claimWebhookReceipt,
  releaseWebhookReceipt,
  verifyWebhookRequest,
} from "../utils/webhook-auth.js";
import {
  BrevoWebhookPayloadError,
  ingestBrevoWebhookEvents,
  parseBrevoWebhookPayload,
} from "../services/brevo-webhook.service.js";
import { logError } from "../utils/logger.js";
import { normalizeWhatsAppPhone } from "../services/whatsapp/phone.js";
import {
  brevoDeliveryIdempotencyKey,
  claimBrevoDelivery,
  completeBrevoDelivery,
  ensureLocalBrevoCampaign,
  failBrevoDelivery,
  prepareBrevoDeliveries,
} from "../services/brevo-campaign.service.js";
import {
  BrevoRequestError,
  parseBrevoCampaignFilterStatus,
  parseBrevoCampaignStatusAction,
  parseBrevoCampaignUpdate,
} from "../services/brevo-validation.js";

function safeBrevoOperationError(error: unknown): string {
  return error instanceof BrevoProviderError
    ? error.message
    : "The operation could not be completed";
}

function handleBrevoProviderResponse(error: unknown, res: Response): boolean {
  if (!(error instanceof BrevoProviderError)) return false;
  if (error.status === 404) {
    res
      .status(404)
      .json({ error: "Brevo campaign not found", code: "NOT_FOUND" });
    return true;
  }
  if (error.status === 400) {
    res.status(400).json({ error: error.message, code: "PROVIDER_REJECTED" });
    return true;
  }
  if (error.status === 429) {
    res.status(429).json({ error: error.message, code: "PROVIDER_RATE_LIMIT" });
    return true;
  }
  res.status(error.retryable ? 503 : 502).json({
    error: error.message,
    code: error.retryable ? "PROVIDER_UNAVAILABLE" : "PROVIDER_ERROR",
  });
  return true;
}

export class BrevoController {
  private brevoService: BrevoService;

  constructor() {
    this.brevoService = new BrevoService();
  }

  syncLeadsToBrevo = async (req: Request, res: Response) => {
    try {
      const leadIds = parseUniquePositiveIntegerArray(req.body?.leadIds, 500);
      if (!leadIds) {
        return handleValidationError(
          res,
          '"leadIds" must contain 1 to 500 unique positive integer IDs',
          "leadIds",
          "Brevo sync leads"
        );
      }

      const successful: SyncLeadsResponse["successful"] = [];
      const failed: SyncLeadsResponse["failed"] = [];
      const leads = await prisma.lead.findMany({
        where: {
          id: { in: leadIds },
          deletedAt: null,
          emailOptOut: false,
        },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          companyName: true,
          source: true,
          score: true,
        },
      });
      const leadById = new Map(leads.map(lead => [lead.id, lead]));

      for (const leadId of leadIds) {
        const lead = leadById.get(leadId);
        if (!lead) {
          failed.push({
            leadId,
            email: "unknown",
            error: "Lead is missing, deleted, or opted out of email",
          });
          continue;
        }
        try {
          const phoneNumber = lead.phone
            ? normalizeWhatsAppPhone(lead.phone)
            : null;
          const brevoContact: BrevoContact = {
            email: lead.email,
            attributes: {
              FIRSTNAME: lead.firstName,
              LASTNAME: lead.lastName || "",
              COMPANY: lead.companyName || "",
              SOURCE: lead.source,
              LEAD_SCORE: lead.score,
            },
            updateEnabled: true,
            getId: true,
          };

          if (phoneNumber) {
            brevoContact.attributes!.SMS = `+${phoneNumber}`;
          }

          const brevoResponse =
            await this.brevoService.createOrUpdateContact(brevoContact);

          const updated = await prisma.lead.updateMany({
            where: { id: leadId, deletedAt: null, emailOptOut: false },
            data: { brevoContactId: brevoResponse.id.toString() },
          });
          if (updated.count !== 1) {
            throw new Error("Lead eligibility changed while syncing");
          }

          successful.push({
            leadId,
            brevoContactId: brevoResponse.id,
            email: lead.email,
          });
        } catch (error: unknown) {
          failed.push({
            leadId,
            email: lead.email,
            error: safeBrevoOperationError(error),
          });
        }
      }

      const summary = {
        total: leadIds.length,
        successful: successful.length,
        failed: failed.length,
      };

      const response: SyncLeadsResponse = {
        successful,
        failed,
        summary,
      };

      res.status(200).json(response);
    } catch (error) {
      handleError(error, res, "Brevo sync leads");
    }
  };

  getCampaigns = async (req: Request, res: Response) => {
    try {
      const limit =
        req.query.limit === undefined
          ? 50
          : parseBoundedInteger(req.query.limit, 1, 100);
      const offset =
        req.query.offset === undefined
          ? 0
          : parseBoundedInteger(req.query.offset, 0, 1_000_000);
      const status = parseBrevoCampaignFilterStatus(req.query.status);
      if (limit === null || offset === null) {
        return handleValidationError(
          res,
          "limit must be between 1 and 100 and offset must be non-negative",
          undefined,
          "Brevo get campaigns"
        );
      }
      const campaigns = await this.brevoService.getAllCampaigns(
        limit,
        offset,
        status
      );

      res.json({
        campaigns: campaigns.campaigns,
        count: campaigns.campaigns.length,
        total: campaigns.count,
      });
    } catch (error: unknown) {
      if (error instanceof BrevoRequestError) {
        return handleValidationError(
          res,
          error.message,
          "status",
          "Brevo get campaigns"
        );
      }
      if (handleBrevoProviderResponse(error, res)) return;
      handleError(error, res, "Brevo get campaigns");
    }
  };

  getCampaignDetails = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const statistics =
        req.query.statistics === undefined
          ? undefined
          : typeof req.query.statistics === "string"
            ? req.query.statistics
            : null;

      if (!id) {
        return handleValidationError(
          res,
          "Campaign ID is required",
          "id",
          "Brevo get campaign details"
        );
      }

      const campaignId = parsePositiveInteger(id);

      if (campaignId === null) {
        return handleValidationError(
          res,
          "Invalid campaign ID",
          "id",
          "Brevo get campaign details"
        );
      }

      if (statistics === null) {
        return handleValidationError(
          res,
          "statistics must be a single string value",
          "statistics",
          "Brevo get campaign details"
        );
      }
      if (statistics) {
        const validStatistics = [
          "globalStats",
          "linksStats",
          "statsByDomain",
          "statsByDevice",
          "statsByBrowser",
        ];
        if (!validStatistics.includes(statistics)) {
          return handleValidationError(
            res,
            `Invalid statistics parameter. Must be one of: ${validStatistics.join(", ")}`,
            "statistics",
            "Brevo get campaign details"
          );
        }
      }

      const campaign = await this.brevoService.getCampaignById(
        campaignId,
        statistics
      );

      res.json(campaign);
    } catch (error: unknown) {
      if (handleBrevoProviderResponse(error, res)) return;
      handleError(error, res, "Brevo get campaign details");
    }
  };

  sendCampaign = async (req: Request, res: Response) => {
    try {
      const campaignId = parsePositiveInteger(req.body?.campaignId);
      const leadIds = parseUniquePositiveIntegerArray(req.body?.leadIds, 500);
      if (campaignId === null || !leadIds) {
        return handleValidationError(
          res,
          '"campaignId" must be a positive integer and "leadIds" must contain 1 to 500 unique positive integer IDs',
          "campaignId",
          "Brevo send campaign"
        );
      }

      const successful: SendCampaignResponse["successful"] = [];
      const failed: SendCampaignResponse["failed"] = [];

      const leads = await prisma.lead.findMany({
        where: {
          id: { in: leadIds },
          brevoContactId: { not: null },
          emailOptOut: false,
          deletedAt: null,
        },
        select: { id: true, email: true },
        orderBy: { id: "asc" },
      });
      const eligibleIds = new Set(leads.map(lead => lead.id));
      for (const leadId of leadIds.filter(id => !eligibleIds.has(id))) {
        failed.push({
          leadId,
          email: "unknown",
          error:
            "Lead is not eligible: it is not synced to Brevo, has opted out of email, or has been deleted.",
        });
      }

      const campaign = await this.brevoService.getCampaignById(campaignId);
      if (!campaign.htmlContent) {
        return handleValidationError(
          res,
          `Campaign ${campaignId} has no HTML content to send. Campaigns built in Brevo's drag-and-drop editor must be saved with content before they can be sent from here.`,
          "campaignId",
          "Brevo send campaign"
        );
      }
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const localCampaignId = await ensureLocalBrevoCampaign(
        campaign,
        req.user.id
      );
      const deliveries = await prepareBrevoDeliveries(
        localCampaignId,
        leads.map(lead => ({ leadId: lead.id, email: lead.email }))
      );
      const representedLeadIds = new Set(
        deliveries
          .map(delivery => delivery.leadId)
          .filter((id): id is number => id !== null && eligibleIds.has(id))
      );
      for (const lead of leads) {
        if (!representedLeadIds.has(lead.id)) {
          failed.push({
            leadId: lead.id,
            email: lead.email,
            error: "Another requested lead has the same email address",
          });
        }
      }

      for (const delivery of deliveries) {
        if (delivery.leadId === null || !eligibleIds.has(delivery.leadId)) {
          continue;
        }
        if (
          delivery.status === "SENT" ||
          delivery.status === "DELIVERED" ||
          delivery.status === "READ"
        ) {
          successful.push({
            leadId: delivery.leadId,
            email: delivery.address,
            messageId: delivery.providerMessageId || "previously-sent",
          });
          continue;
        }
        const claimed = await claimBrevoDelivery(delivery.id);
        if (!claimed) {
          failed.push({
            leadId: delivery.leadId,
            email: delivery.address,
            error:
              delivery.errorCode === "OUTCOME_UNKNOWN"
                ? "A previous send has an uncertain outcome and requires manual review"
                : "Delivery is already processing or exhausted its retry limit",
          });
          continue;
        }

        try {
          const emailRequest = {
            to: [{ email: delivery.address }],
            subject: campaign.subject || "Campaign Email",
            sender: campaign.sender,
            htmlContent: campaign.htmlContent,
            headers: {
              "Idempotency-Key": brevoDeliveryIdempotencyKey(delivery.id),
            },
            ...(campaign.replyTo
              ? { replyTo: { email: campaign.replyTo } }
              : {}),
          };

          const result =
            await this.brevoService.sendTransactionalEmail(emailRequest);
          await completeBrevoDelivery(
            localCampaignId,
            delivery.id,
            delivery.leadId,
            result.messageId
          );

          successful.push({
            leadId: delivery.leadId,
            email: delivery.address,
            messageId: result.messageId,
          });
        } catch (error: unknown) {
          const outcomeUnknown =
            !(error instanceof BrevoProviderError) || error.retryable;
          await failBrevoDelivery(delivery.id, outcomeUnknown);
          failed.push({
            leadId: delivery.leadId,
            email: delivery.address,
            error: outcomeUnknown
              ? "Send outcome is uncertain and requires manual review"
              : safeBrevoOperationError(error),
          });
        }
      }

      const summary = {
        total: leadIds.length,
        successful: successful.length,
        failed: failed.length,
      };

      const response: SendCampaignResponse = {
        successful,
        failed,
        summary,
      };

      res.status(200).json(response);
    } catch (error) {
      handleError(error, res, "Brevo send campaign");
    }
  };

  deleteCampaign = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return handleValidationError(
          res,
          "Campaign ID is required",
          "id",
          "Brevo delete campaign"
        );
      }

      const campaignId = parsePositiveInteger(id);

      if (campaignId === null) {
        return handleValidationError(
          res,
          "Invalid campaign ID",
          "id",
          "Brevo delete campaign"
        );
      }

      await this.brevoService.deleteCampaign(campaignId);

      res.status(204).send();
    } catch (error) {
      handleError(error, res, "Brevo delete campaign");
    }
  };

  updateCampaign = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = parseBrevoCampaignUpdate(req.body);

      if (!id) {
        return handleValidationError(
          res,
          "Campaign ID is required",
          "id",
          "Brevo update campaign"
        );
      }

      const campaignId = parsePositiveInteger(id);

      if (campaignId === null) {
        return handleValidationError(
          res,
          "Invalid campaign ID",
          "id",
          "Brevo update campaign"
        );
      }

      const updatedCampaign = await this.brevoService.updateCampaign(
        campaignId,
        updateData
      );

      res.json(updatedCampaign);
    } catch (error: unknown) {
      if (error instanceof BrevoRequestError) {
        return handleValidationError(
          res,
          error.message,
          "body",
          "Brevo update campaign"
        );
      }
      if (handleBrevoProviderResponse(error, res)) return;
      handleError(error, res, "Brevo update campaign");
    }
  };

  updateCampaignStatus = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const status = parseBrevoCampaignStatusAction(req.body);

      if (!id) {
        return handleValidationError(
          res,
          "Campaign ID is required",
          "id",
          "Brevo update campaign status"
        );
      }

      const campaignId = parsePositiveInteger(id);

      if (campaignId === null) {
        return handleValidationError(
          res,
          "Invalid campaign ID",
          "id",
          "Brevo update campaign status"
        );
      }

      await this.brevoService.updateCampaignStatus(campaignId, status);

      res.status(204).send();
    } catch (error: unknown) {
      if (error instanceof BrevoRequestError) {
        return handleValidationError(
          res,
          error.message,
          "status",
          "Brevo update campaign status"
        );
      }
      if (handleBrevoProviderResponse(error, res)) return;
      handleError(error, res, "Brevo update campaign status");
    }
  };

  handleWebhook = async (req: Request, res: Response) => {
    let receiptDigest: string | null = null;
    try {
      const row = await prisma.appConfig.findUnique({
        where: { key: "email.webhookSecret" },
      });
      const secret =
        row?.encryptedValue && row.iv && row.authTag
          ? decryptSecret(row.encryptedValue, row.iv, row.authTag)
          : process.env.BREVO_WEBHOOK_SECRET || "";
      if (!secret) {
        return res.status(503).json({ error: "Webhook is not configured" });
      }
      if (!verifyWebhookRequest(req, secret, ["x-brevo-signature"])) {
        return res
          .status(401)
          .json({ error: "Invalid webhook authentication" });
      }
      if (!req.rawBody) {
        return res
          .status(400)
          .json({ error: "Raw webhook body is unavailable" });
      }
      const events = parseBrevoWebhookPayload(req.body);
      receiptDigest = await claimWebhookReceipt("brevo", req.rawBody);
      if (!receiptDigest) {
        return res.status(200).json({ message: "Webhook already received" });
      }

      const result = await ingestBrevoWebhookEvents(events);
      res.status(200).json({
        message: "Webhook processed successfully",
        ...result,
      });
    } catch (error) {
      if (error instanceof BrevoWebhookPayloadError) {
        return res.status(400).json({
          error: error.message,
          code: "INVALID_WEBHOOK_PAYLOAD",
        });
      }
      if (receiptDigest) {
        await releaseWebhookReceipt("brevo", receiptDigest).catch(
          releaseError => {
            logError("brevo_webhook_receipt_release_failed", releaseError);
          }
        );
      }
      handleError(error, res, "Brevo webhook");
    }
  };

  getBrevoAnalytics = async (req: Request, res: Response) => {
    try {
      const [stats, totalCampaigns, sentCampaigns] = await Promise.all([
        this.brevoService.getAggregatedEmailStatistics(),
        this.brevoService.getCampaignCount(),
        this.brevoService.getCampaignCount("sent"),
      ]);

      const totalBounced = stats.hardBounces + stats.softBounces;
      const deliveryRate =
        stats.requests > 0 ? (stats.delivered / stats.requests) * 100 : 0;
      const openRate =
        stats.delivered > 0 ? (stats.opens / stats.delivered) * 100 : 0;
      const clickRate =
        stats.delivered > 0 ? (stats.clicks / stats.delivered) * 100 : 0;
      const bounceRate =
        stats.requests > 0 ? (totalBounced / stats.requests) * 100 : 0;
      const unsubscribeRate =
        stats.delivered > 0 ? (stats.unsubscribed / stats.delivered) * 100 : 0;
      const spamRate =
        stats.delivered > 0 ? (stats.spamReports / stats.delivered) * 100 : 0;

      const analytics: BrevoAnalyticsResponse = {
        totalCampaigns,
        sentCampaigns,
        totalSent: stats.requests,
        totalDelivered: stats.delivered,
        totalOpened: stats.opens,
        totalClicked: stats.clicks,
        totalBounced,
        totalUnsubscribed: stats.unsubscribed,
        totalSpam: stats.spamReports,
        deliveryRate: Math.round(deliveryRate * 100) / 100,
        openRate: Math.round(openRate * 100) / 100,
        clickRate: Math.round(clickRate * 100) / 100,
        bounceRate: Math.round(bounceRate * 100) / 100,
        unsubscribeRate: Math.round(unsubscribeRate * 100) / 100,
        spamRate: Math.round(spamRate * 100) / 100,
      };

      res.json(analytics);
    } catch (error) {
      handleError(error, res, "Brevo analytics");
    }
  };

  testConnection = async (req: Request, res: Response) => {
    try {
      await this.brevoService.getAccountDetails();
      res.json({
        status: "success",
        message: "Brevo API connection successful",
      });
    } catch (error) {
      handleError(error, res, "Brevo test connection");
    }
  };
}
