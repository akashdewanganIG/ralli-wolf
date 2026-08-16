import type { Request, Response } from "express";
import { handleError, handleValidationError } from "../utils/errorHandler.js";
import { prisma } from "@repo/db";
import { BrevoService } from "../services/brevo.service.js";
import {
  SyncLeadsRequest,
  SyncLeadsResponse,
  SendCampaignRequest,
  SendCampaignResponse,
  BrevoAnalyticsResponse,
  BrevoWebhookPayload,
  BrevoUpdateCampaignRequest,
  BrevoUpdateCampaignStatusRequest,
} from "../utils/brevo.types.js";
import crypto from "crypto";
function deriveKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || "";
  const raw = key.startsWith("base64:")
    ? Buffer.from(key.slice(7), "base64")
    : key.startsWith("hex:")
      ? Buffer.from(key.slice(4), "hex")
      : Buffer.from(key, "utf8");
  return raw.length === 32
    ? raw
    : crypto.createHash("sha256").update(raw).digest();
}
function decryptGCM(cipherText: string, iv: string, authTag: string): string {
  const key = deriveKey();
  const ivBuf = Buffer.from(iv, "base64");
  const tagBuf = Buffer.from(authTag, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, ivBuf);
  decipher.setAuthTag(tagBuf);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherText, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export class BrevoController {
  private brevoService: BrevoService;

  constructor() {
    this.brevoService = new BrevoService();
  }

  /**
   * Sync selected leads to Brevo
   * POST /api/brevo/sync-leads
   */
  syncLeadsToBrevo = async (req: Request, res: Response) => {
    try {
      console.log("=== BREVO LEAD SYNC STARTED ===");

      const { leadIds }: SyncLeadsRequest = req.body;

      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        return handleValidationError(
          res,
          'Request body must contain a "leadIds" array with at least one lead ID',
          "leadIds",
          "Brevo sync leads"
        );
      }

      console.log(`Syncing ${leadIds.length} leads to Brevo...`);

      const successful: SyncLeadsResponse["successful"] = [];
      const failed: SyncLeadsResponse["failed"] = [];

      // Process each lead
      for (const leadId of leadIds) {
        let leadEmail = "unknown";
        try {
          console.log(`Processing lead ID: ${leadId}`);

          // Get lead from database
          const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            include: { owner: true },
          });

          if (!lead) {
            failed.push({
              leadId,
              email: "unknown",
              error: "Lead not found",
            });
            continue;
          }

          leadEmail = lead.email;

          // Helper function to validate phone number for Brevo
          const formatPhoneNumber = (
            phone: string | null | undefined
          ): string => {
            if (!phone) return "";

            // Remove common separators
            let cleaned = phone.replace(/[-\s()]+/g, "");

            // Remove non-digit characters except + at the start
            cleaned = cleaned.replace(/[^\d+]/g, "");

            // Check if it looks like a valid phone number
            // Brevo expects phone numbers to be E.164 format (e.g., +1234567890)
            if (cleaned.length < 10 || cleaned.length > 15) {
              console.log(`Skipping invalid phone number: ${phone}`);
              return "";
            }

            return cleaned;
          };

          // Prepare Brevo contact data
          const phoneNumber = formatPhoneNumber(lead.phone);
          const brevoContact: any = {
            email: lead.email,
            attributes: {
              FIRSTNAME: (lead as any).firstName || "",
              LASTNAME: (lead as any).lastName || "",
              COMPANY: (lead as any).companyName || "",
              SOURCE: (lead as any).source || "CRM",
            },
            updateEnabled: true,
          };

          // Only add SMS if phone number is valid
          if (phoneNumber && phoneNumber.length >= 10) {
            brevoContact.attributes.SMS = phoneNumber;
          }

          // Optionally add LEAD_SCORE if it's a number
          if (typeof lead.score === "number") {
            brevoContact.attributes.LEAD_SCORE = lead.score;
          }

          // Create or update contact in Brevo
          const brevoResponse =
            await this.brevoService.createOrUpdateContact(brevoContact);

          // Update lead with Brevo contact ID
          await prisma.lead.update({
            where: { id: leadId },
            data: { brevoContactId: brevoResponse.id.toString() },
          });

          successful.push({
            leadId,
            brevoContactId: brevoResponse.id,
            email: lead.email,
          });

          console.log(
            `✓ Lead ${leadId} synced successfully to Brevo contact ${brevoResponse.id}`
          );
        } catch (error: any) {
          console.error(`✗ Failed to sync lead ${leadId}:`, error.message);

          failed.push({
            leadId,
            email: leadEmail,
            error: error.message,
          });
        }
      }

      const summary = {
        total: leadIds.length,
        successful: successful.length,
        failed: failed.length,
      };

      console.log("=== BREVO LEAD SYNC SUMMARY ===");
      console.log(
        `Total: ${summary.total}, Successful: ${summary.successful}, Failed: ${summary.failed}`
      );

      const response: SyncLeadsResponse = {
        successful,
        failed,
        summary,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("=== BREVO LEAD SYNC ERROR ===", error);
      handleError(error, res, "Brevo sync leads");
    }
  };

  /**
   * Get all campaigns from Brevo
   * GET /api/brevo/campaigns
   */
  getCampaigns = async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;

      console.log(
        `Fetching Brevo campaigns: limit=${limit}, offset=${offset}, status=${status}`
      );

      const campaigns = await this.brevoService.getAllCampaigns(limit, offset);

      // Filter by status if provided
      let filteredCampaigns = campaigns.campaigns;
      if (status) {
        filteredCampaigns = campaigns.campaigns.filter(
          campaign => campaign.status.toLowerCase() === status.toLowerCase()
        );
      }

      res.json({
        campaigns: filteredCampaigns,
        count: filteredCampaigns.length,
        total: campaigns.count,
      });
    } catch (error) {
      console.error("Error fetching Brevo campaigns:", error);
      handleError(error, res, "Brevo get campaigns");
    }
  };

  /**
   * Get active campaigns only
   * GET /api/brevo/campaigns/active
   */
  getActiveCampaigns = async (req: Request, res: Response) => {
    try {
      console.log("Fetching active Brevo campaigns...");

      const campaigns = await this.brevoService.getActiveCampaigns();

      res.json({
        campaigns,
        count: campaigns.length,
      });
    } catch (error) {
      console.error("Error fetching active Brevo campaigns:", error);
      handleError(error, res, "Brevo get active campaigns");
    }
  };

  /**
   * Get specific campaign details
   * GET /api/brevo/campaigns/:id
   */
  getCampaignDetails = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const statistics = req.query.statistics as string | undefined;

      if (!id) {
        return handleValidationError(
          res,
          "Campaign ID is required",
          "id",
          "Brevo get campaign details"
        );
      }

      const campaignId = parseInt(id);

      if (isNaN(campaignId)) {
        return handleValidationError(
          res,
          "Invalid campaign ID",
          "id",
          "Brevo get campaign details"
        );
      }

      // Validate statistics parameter if provided
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

      console.log(
        `Fetching Brevo campaign details: ${campaignId}${statistics ? ` with statistics=${statistics}` : ""}`
      );

      const campaign = await this.brevoService.getCampaignById(
        campaignId,
        statistics
      );

      res.json(campaign);
    } catch (error: any) {
      console.error(`Error fetching Brevo campaign ${req.params.id}:`, {
        message: error?.message,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        code: error?.code,
      });

      // Handle Brevo API specific errors
      if (error?.response) {
        const status = error.response.status;
        const message =
          error.response.data?.message ||
          error.message ||
          "Failed to fetch campaign details";

        // If it's a 404, campaign doesn't exist
        if (status === 404) {
          return res.status(404).json({
            error: "Campaign not found",
            details: message,
            code: "NOT_FOUND",
          });
        }

        // If it's a 400, it might be an invalid request (e.g., statistics not available)
        if (status === 400) {
          return res.status(400).json({
            error: "Invalid request to Brevo API",
            details: message,
            code: "BAD_REQUEST",
          });
        }

        // For other Brevo API errors, return the status code
        return res.status(status).json({
          error: "Failed to fetch campaign details from Brevo",
          details: message,
          code: "BREVO_API_ERROR",
        });
      }

      // Handle network/connection errors
      if (
        error?.code === "ECONNRESET" ||
        error?.code === "ETIMEDOUT" ||
        error?.code === "ECONNREFUSED"
      ) {
        return res.status(503).json({
          error: "Failed to connect to Brevo API",
          details:
            "The service is temporarily unavailable. Please try again later.",
          code: "SERVICE_UNAVAILABLE",
        });
      }

      // Default error handling
      handleError(error, res, "Brevo get campaign details");
    }
  };

  /**
   * Send campaign to selected leads
   * POST /api/brevo/send-campaign
   */
  sendCampaign = async (req: Request, res: Response) => {
    try {
      console.log("=== BREVO CAMPAIGN SEND STARTED ===");

      const { campaignId, leadIds }: SendCampaignRequest = req.body;

      if (
        !campaignId ||
        !leadIds ||
        !Array.isArray(leadIds) ||
        leadIds.length === 0
      ) {
        return handleValidationError(
          res,
          'Request body must contain "campaignId" and "leadIds" array',
          "campaignId",
          "Brevo send campaign"
        );
      }

      console.log(
        `Sending campaign ${campaignId} to ${leadIds.length} leads...`
      );

      const successful: SendCampaignResponse["successful"] = [];
      const failed: SendCampaignResponse["failed"] = [];

      // Get leads with Brevo contact IDs
      const leads = await prisma.lead.findMany({
        where: {
          id: { in: leadIds },
          brevoContactId: { not: null },
        },
      });

      const leadsWithBrevoIds = leads.map(lead => ({
        leadId: lead.id,
        email: lead.email,
        brevoContactId: lead.brevoContactId!,
      }));

      // Find leads without Brevo contact IDs
      const leadsWithoutBrevoIds = leadIds.filter(
        id => !leadsWithBrevoIds.some(lead => lead.leadId === id)
      );

      // Add failed entries for leads without Brevo contact IDs
      for (const leadId of leadsWithoutBrevoIds) {
        failed.push({
          leadId,
          email: "unknown",
          error: "Lead not synced to Brevo. Please sync the lead first.",
        });
      }

      // Send campaign to leads with Brevo contact IDs
      for (const lead of leadsWithBrevoIds) {
        try {
          console.log(
            `Sending campaign to lead ${lead.leadId} (${lead.email})`
          );

          // Get campaign details
          const campaign = await this.brevoService.getCampaignById(campaignId);

          // Send transactional email (Brevo limitation)
          const emailRequest = {
            to: [{ email: lead.email }],
            subject: campaign.subject || "Campaign Email",
            sender: campaign.sender,
            // Note: This is a simplified implementation
            // In a real scenario, you'd need to handle campaign content properly
          };

          const result =
            await this.brevoService.sendTransactionalEmail(emailRequest);

          // Record campaign member activity
          await prisma.campaignMember.create({
            data: {
              campaignId: campaignId, // This should be your CRM campaign ID
              leadId: lead.leadId,
              status: "sent",
            },
          });

          successful.push({
            leadId: lead.leadId,
            email: lead.email,
            messageId: result.messageId,
          });

          console.log(`✓ Campaign sent to lead ${lead.leadId}`);
        } catch (error: any) {
          console.error(
            `✗ Failed to send campaign to lead ${lead.leadId}:`,
            error.message
          );

          failed.push({
            leadId: lead.leadId,
            email: lead.email,
            error: error.message,
          });
        }
      }

      const summary = {
        total: leadIds.length,
        successful: successful.length,
        failed: failed.length,
      };

      console.log("=== BREVO CAMPAIGN SEND SUMMARY ===");
      console.log(
        `Total: ${summary.total}, Successful: ${summary.successful}, Failed: ${summary.failed}`
      );

      const response: SendCampaignResponse = {
        successful,
        failed,
        summary,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("=== BREVO CAMPAIGN SEND ERROR ===", error);
      handleError(error, res, "Brevo send campaign");
    }
  };

  /**
   * Delete campaign
   * DELETE /api/brevo/campaigns/:id
   */
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

      const campaignId = parseInt(id);

      if (isNaN(campaignId)) {
        return handleValidationError(
          res,
          "Invalid campaign ID",
          "id",
          "Brevo delete campaign"
        );
      }

      console.log(`Deleting Brevo campaign: ${campaignId}`);

      await this.brevoService.deleteCampaign(campaignId);

      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting Brevo campaign ${req.params.id}:`, error);
      handleError(error, res, "Brevo delete campaign");
    }
  };

  /**
   * Update campaign
   * PUT /api/brevo/campaigns/:id
   */
  updateCampaign = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData: BrevoUpdateCampaignRequest = req.body;

      if (!id) {
        return handleValidationError(
          res,
          "Campaign ID is required",
          "id",
          "Brevo update campaign"
        );
      }

      const campaignId = parseInt(id);

      if (isNaN(campaignId)) {
        return handleValidationError(
          res,
          "Invalid campaign ID",
          "id",
          "Brevo update campaign"
        );
      }

      if (!updateData || Object.keys(updateData).length === 0) {
        return handleValidationError(
          res,
          "Update data is required",
          "body",
          "Brevo update campaign"
        );
      }

      console.log(
        `Updating Brevo campaign: ${campaignId}`,
        JSON.stringify(updateData, null, 2)
      );

      const updatedCampaign = await this.brevoService.updateCampaign(
        campaignId,
        updateData
      );

      res.json(updatedCampaign);
    } catch (error: any) {
      console.error(`Error updating Brevo campaign ${req.params.id}:`, error);

      // Provide more detailed error information
      if (error.response?.data) {
        const brevoError = error.response.data;
        return res.status(error.response.status || 500).json({
          error: brevoError.message || "Failed to update campaign",
          code: brevoError.code,
          details: brevoError,
        });
      }

      handleError(error, res, "Brevo update campaign");
    }
  };

  /**
   * Update campaign status
   * PUT /api/brevo/campaigns/:id/status
   */
  updateCampaignStatus = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status }: BrevoUpdateCampaignStatusRequest = req.body;

      if (!id) {
        return handleValidationError(
          res,
          "Campaign ID is required",
          "id",
          "Brevo update campaign status"
        );
      }

      const campaignId = parseInt(id);

      if (isNaN(campaignId)) {
        return handleValidationError(
          res,
          "Invalid campaign ID",
          "id",
          "Brevo update campaign status"
        );
      }

      if (!status) {
        return handleValidationError(
          res,
          "Status is required",
          "status",
          "Brevo update campaign status"
        );
      }

      const validStatuses = [
        "suspended",
        "archive",
        "darchive",
        "sent",
        "queued",
        "replicate",
        "replicateTemplate",
        "draft",
      ];
      if (!validStatuses.includes(status)) {
        return handleValidationError(
          res,
          `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          "status",
          "Brevo update campaign status"
        );
      }

      console.log(`Updating Brevo campaign ${campaignId} status to: ${status}`);

      await this.brevoService.updateCampaignStatus(campaignId, status);

      res.status(204).send();
    } catch (error) {
      console.error(
        `Error updating Brevo campaign ${req.params.id} status:`,
        error
      );
      handleError(error, res, "Brevo update campaign status");
    }
  };

  /**
   * Handle Brevo webhook events
   * POST /api/brevo/webhooks
   */
  handleWebhook = async (req: Request, res: Response) => {
    try {
      console.log("=== BREVO WEBHOOK RECEIVED ===");

      const signature = req.headers["x-brevo-signature"] as string;
      const payload = JSON.stringify(req.body);

      // Verify webhook signature using DB-managed secret
      const row = await prisma.appConfig.findUnique({
        where: { key: "email.webhookSecret" },
      });
      const secret =
        row?.encryptedValue && row.iv && row.authTag
          ? decryptGCM(row.encryptedValue, row.iv, row.authTag)
          : process.env.BREVO_WEBHOOK_SECRET || "";
      if (secret) {
        const expectedSignature = crypto
          .createHmac("sha256", secret)
          .update(payload, "utf8")
          .digest("hex");
        const providedSignature = (signature || "").replace("sha256=", "");
        const valid =
          providedSignature &&
          crypto.timingSafeEqual(
            Buffer.from(expectedSignature, "hex"),
            Buffer.from(providedSignature, "hex")
          );
        if (!valid) {
          console.error("Invalid webhook signature");
          return res.status(401).json({ error: "Invalid signature" });
        }
      } else {
        console.warn(
          "Brevo webhook secret not configured; skipping signature verification"
        );
      }

      // Parse webhook payload
      const webhookData: BrevoWebhookPayload =
        this.brevoService.parseWebhookPayload(payload);
      const event = webhookData.event;

      console.log(
        `Processing webhook event: ${event.event} for ${event.email}`
      );

      // Find lead by email
      const lead = await prisma.lead.findFirst({
        where: { email: event.email },
      });

      if (!lead) {
        console.log(`Lead not found for email: ${event.email}`);
        return res.status(200).json({ message: "Lead not found" });
      }

      // Calculate engagement score
      const scoreChange = this.brevoService.getEngagementScore(event.event);

      if (scoreChange !== 0) {
        // Update lead score
        const newScore = Math.max(0, Math.min(100, lead.score + scoreChange));

        await prisma.lead.update({
          where: { id: lead.id },
          data: { score: newScore },
        });

        console.log(
          `Updated lead ${lead.id} score: ${lead.score} -> ${newScore} (${scoreChange > 0 ? "+" : ""}${scoreChange})`
        );
      }

      // Store analytics event
      let campaignId: number | null = null;

      // Try to find campaign by Brevo campaign ID
      if (event.campaign_id) {
        const campaignChannel = await prisma.campaignChannel.findFirst({
          where: {
            channelType: "brevo",
            externalId: event.campaign_id.toString(),
          },
        });

        if (campaignChannel) {
          campaignId = campaignChannel.campaignId;
        }
      }

      await prisma.analyticsEvent.create({
        data: {
          campaignId: campaignId || 1, // Default campaign ID if not found
          leadId: lead.id,
          eventType: `brevo_${event.event}`,
          eventData: event as any,
        },
      });

      console.log(`✓ Webhook event processed for lead ${lead.id}`);

      res.status(200).json({ message: "Webhook processed successfully" });
    } catch (error) {
      console.error("=== BREVO WEBHOOK ERROR ===", error);
      handleError(error, res, "Brevo webhook");
    }
  };

  /**
   * Get Brevo analytics
   * GET /api/brevo/analytics
   */
  getBrevoAnalytics = async (req: Request, res: Response) => {
    try {
      console.log("Fetching Brevo analytics...");

      // Get account statistics
      const accountStats = await this.brevoService.getAccountStatistics();

      // Get campaigns count
      const campaigns = await this.brevoService.getAllCampaigns(100, 0);
      const activeCampaigns = campaigns.campaigns.filter(
        c => c.status === "sent"
      );

      // Calculate rates
      const stats = accountStats.statistics;
      const deliveryRate =
        stats.totalSent > 0
          ? (stats.totalDelivered / stats.totalSent) * 100
          : 0;
      const openRate =
        stats.totalDelivered > 0
          ? (stats.totalOpened / stats.totalDelivered) * 100
          : 0;
      const clickRate =
        stats.totalDelivered > 0
          ? (stats.totalClicked / stats.totalDelivered) * 100
          : 0;
      const bounceRate =
        stats.totalSent > 0 ? (stats.totalBounced / stats.totalSent) * 100 : 0;
      const unsubscribeRate =
        stats.totalDelivered > 0
          ? (stats.totalUnsubscribed / stats.totalDelivered) * 100
          : 0;
      const spamRate =
        stats.totalDelivered > 0
          ? (stats.totalSpam / stats.totalDelivered) * 100
          : 0;

      const analytics: BrevoAnalyticsResponse = {
        totalCampaigns: campaigns.count,
        activeCampaigns: activeCampaigns.length,
        totalSent: stats.totalSent,
        totalDelivered: stats.totalDelivered,
        totalOpened: stats.totalOpened,
        totalClicked: stats.totalClicked,
        totalBounced: stats.totalBounced,
        totalUnsubscribed: stats.totalUnsubscribed,
        totalSpam: stats.totalSpam,
        deliveryRate: Math.round(deliveryRate * 100) / 100,
        openRate: Math.round(openRate * 100) / 100,
        clickRate: Math.round(clickRate * 100) / 100,
        bounceRate: Math.round(bounceRate * 100) / 100,
        unsubscribeRate: Math.round(unsubscribeRate * 100) / 100,
        spamRate: Math.round(spamRate * 100) / 100,
      };

      res.json(analytics);
    } catch (error) {
      console.error("Error fetching Brevo analytics:", error);
      handleError(error, res, "Brevo analytics");
    }
  };

  /**
   * Test Brevo connection
   * GET /api/brevo/test-connection
   */
  testConnection = async (req: Request, res: Response) => {
    try {
      console.log("Testing Brevo API connection...");

      // Hit /account and return details
      const account = await this.brevoService.getAccountStatistics();
      console.log("Brevo account:", JSON.stringify(account, null, 2));
      if (account) {
        res.json({
          status: "success",
          message: "Brevo API connection successful",
          account: account,
        });
      } else {
        res.status(500).json({
          status: "error",
          message: "Brevo API connection failed",
          account: null,
        });
      }
    } catch (error) {
      console.error("Brevo connection test error:", error);
      handleError(error, res, "Brevo test connection");
    }
  };
}
