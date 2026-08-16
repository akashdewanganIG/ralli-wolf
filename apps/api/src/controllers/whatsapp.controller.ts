import { Request, Response } from "express";
import { WhatsappAccountService } from "../services/whatsapp/AccountService.js";
import { WhatsappTemplateService } from "../services/whatsapp/TemplateService.js";
import {
  WhatsappSendService,
  CreateCampaignInput,
  UpdateCampaignInput,
} from "../services/whatsapp/SendService.js";
import { WhatsappWebhookService } from "../services/whatsapp/WebhookService.js";
import { OptOutService } from "../services/whatsapp/OptOutService.js";
import {
  handleError,
  handleValidationError,
  validateRequiredFields,
} from "../utils/errorHandler.js";
import { recordAuditLog } from "../utils/audit.utils.js";
import { AuditCategory } from "@prisma/client";

const WHATSAPP_SUBCATEGORY = "WHATSAPP";

export class WhatsappController {
  private accountService: WhatsappAccountService;

  private templateService: WhatsappTemplateService;

  private sendService: WhatsappSendService;

  private webhookService: WhatsappWebhookService;

  private optOutService: OptOutService;

  constructor() {
    this.accountService = new WhatsappAccountService();
    this.templateService = new WhatsappTemplateService();
    this.sendService = new WhatsappSendService();
    this.webhookService = new WhatsappWebhookService();
    this.optOutService = new OptOutService();
  }

  listAccounts = async (_req: Request, res: Response) => {
    try {
      const accounts = await this.accountService.listAccounts();
      console.log("Controller listAccounts - raw accounts:", accounts);
      const response = accounts.map(account => ({
        ...account,
        sourceHandle: account.phoneNumber,
      }));
      console.log("Controller listAccounts - mapped response:", response);
      res.json(response);
    } catch (error) {
      handleError(error, res, "List WhatsApp accounts");
    }
  };

  createAccount = async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return handleValidationError(
          res,
          "Authenticated user required",
          "user",
          "Create account"
        );
      }

      if (
        !validateRequiredFields(
          req.body,
          ["displayName", "sourceHandle", "apiKey"],
          res,
          "Create account"
        )
      ) {
        return;
      }

      const record = await this.accountService.createAccount(
        {
          displayName: String(req.body.displayName),
          phoneNumber: String(req.body.sourceHandle),
          apiKey: String(req.body.apiKey),
          senderId: req.body.senderId ? String(req.body.senderId) : undefined,
          businessId: req.body.businessId
            ? String(req.body.businessId)
            : undefined,
          appName: req.body.appName ? String(req.body.appName) : undefined,
        },
        req.user.id
      );

      await recordAuditLog({
        action: "whatsapp.account.create",
        changedBy: req.user.id,
        entityType: "WhatsAppNumber",
        entityId: record.id,
        newValues: record,
        category: AuditCategory.CAMPAIGN_MANAGEMENT,
        subCategory: WHATSAPP_SUBCATEGORY,
      });

      res.status(201).json({
        ...record,
        sourceHandle: record.phoneNumber,
      });
    } catch (error) {
      handleError(error, res, "Create WhatsApp account");
    }
  };

  updateAccount = async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return handleValidationError(
          res,
          "Authenticated user required",
          "user",
          "Update account"
        );
      }

      const accountId = Number(req.params.id);
      if (Number.isNaN(accountId)) {
        return handleValidationError(
          res,
          "Valid account ID is required",
          "id",
          "Update account"
        );
      }

      if (
        !validateRequiredFields(
          req.body,
          ["displayName", "status"],
          res,
          "Update account"
        )
      ) {
        return;
      }

      const record = await this.accountService.updateAccount(
        accountId,
        {
          displayName: String(req.body.displayName),
          status: String(req.body.status),
        },
        req.user.id
      );

      await recordAuditLog({
        action: "whatsapp.account.update",
        changedBy: req.user.id,
        entityType: "WhatsAppNumber",
        entityId: record.id,
        newValues: { displayName: record.displayName, status: record.status },
        category: AuditCategory.CAMPAIGN_MANAGEMENT,
        subCategory: WHATSAPP_SUBCATEGORY,
      });

      res.json({
        ...record,
        sourceHandle: record.phoneNumber,
      });
    } catch (error) {
      handleError(error, res, "Update WhatsApp account");
    }
  };

  listTemplates = async (req: Request, res: Response) => {
    try {
      const accountId = Number(req.query.accountId);
      if (Number.isNaN(accountId)) {
        return handleValidationError(
          res,
          "accountId is required",
          "accountId",
          "List templates"
        );
      }
      const templates = await this.templateService.listTemplates(accountId);
      res.json(templates);
    } catch (error) {
      handleError(error, res, "List WhatsApp templates");
    }
  };

  syncTemplates = async (req: Request, res: Response) => {
    try {
      const accountId = Number(req.body.accountId ?? req.query.accountId);
      if (Number.isNaN(accountId)) {
        return handleValidationError(
          res,
          "accountId is required",
          "accountId",
          "Sync templates"
        );
      }
      const result = await this.templateService.syncTemplates(accountId);
      res.json(result);
    } catch (error) {
      handleError(error, res, "Sync WhatsApp templates");
    }
  };

  createTemplate = async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return handleValidationError(
          res,
          "Authenticated user required",
          "user",
          "Create template"
        );
      }

      const accountId = Number(req.body.accountId);
      if (Number.isNaN(accountId)) {
        return handleValidationError(
          res,
          "accountId is required",
          "accountId",
          "Create template"
        );
      }

      if (
        !validateRequiredFields(
          req.body,
          ["template_name", "language", "category", "components"],
          res,
          "Create template"
        )
      ) {
        return;
      }

      const result = await this.templateService.createTemplate(accountId, {
        template_name: String(req.body.template_name),
        language: String(req.body.language),
        category: String(req.body.category),
        button_url: req.body.button_url,
        message_ttl: req.body.message_ttl
          ? Number(req.body.message_ttl)
          : undefined,
        ttl_in_seconds: req.body.ttl_in_seconds
          ? Number(req.body.ttl_in_seconds)
          : undefined,
        components: req.body.components,
      });

      await recordAuditLog({
        action: "whatsapp.template.create",
        changedBy: req.user.id,
        entityType: "WhatsAppTemplate",
        entityId: 0,
        newValues: { accountId, template_name: req.body.template_name },
        category: AuditCategory.CAMPAIGN_MANAGEMENT,
        subCategory: WHATSAPP_SUBCATEGORY,
      });

      res.status(201).json(result);
    } catch (error) {
      handleError(error, res, "Create WhatsApp template");
    }
  };

  updateTemplate = async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return handleValidationError(
          res,
          "Authenticated user required",
          "user",
          "Update template"
        );
      }

      const accountId = Number(req.body.accountId);
      if (Number.isNaN(accountId)) {
        return handleValidationError(
          res,
          "accountId is required",
          "accountId",
          "Update template"
        );
      }

      const templateName = req.params.name || req.body.template_name;
      if (!templateName) {
        return handleValidationError(
          res,
          "template_name is required",
          "template_name",
          "Update template"
        );
      }

      if (!req.body.components) {
        return handleValidationError(
          res,
          "components is required",
          "components",
          "Update template"
        );
      }

      const result = await this.templateService.updateTemplate(
        accountId,
        String(templateName),
        req.body.components
      );

      await recordAuditLog({
        action: "whatsapp.template.update",
        changedBy: req.user.id,
        entityType: "WhatsAppTemplate",
        entityId: 0,
        newValues: { accountId, template_name: templateName },
        category: AuditCategory.CAMPAIGN_MANAGEMENT,
        subCategory: WHATSAPP_SUBCATEGORY,
      });

      res.json(result);
    } catch (error) {
      handleError(error, res, "Update WhatsApp template");
    }
  };

  uploadTemplateMedia = async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return handleValidationError(
          res,
          "Authenticated user required",
          "user",
          "Upload media"
        );
      }

      const accountId = Number(req.body.accountId);
      if (Number.isNaN(accountId)) {
        return handleValidationError(
          res,
          "accountId is required",
          "accountId",
          "Upload media"
        );
      }

      if (!req.body.mediaBase64 || !req.body.mimeType) {
        return handleValidationError(
          res,
          "mediaBase64 and mimeType are required",
          "media",
          "Upload media"
        );
      }

      // Convert base64 to buffer
      const mediaBuffer = Buffer.from(req.body.mediaBase64, "base64");
      const mimeType = String(req.body.mimeType);

      const headerHandle = await this.templateService.uploadMedia(
        accountId,
        mediaBuffer,
        mimeType
      );

      res.json({ headerHandle });
    } catch (error) {
      handleError(error, res, "Upload template media");
    }
  };

  uploadCampaignMedia = async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return handleValidationError(
          res,
          "Authenticated user required",
          "user",
          "Upload campaign media"
        );
      }

      if (!req.body.mediaBase64 || !req.body.mimeType) {
        return handleValidationError(
          res,
          "mediaBase64 and mimeType are required",
          "media",
          "Upload campaign media"
        );
      }

      // Convert base64 to buffer
      const mediaBuffer = Buffer.from(req.body.mediaBase64, "base64");
      const mimeType = String(req.body.mimeType);
      const filename = req.body.filename || "media";

      // Validate file size (max 10MB)
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB
      if (mediaBuffer.length > maxSizeBytes) {
        return handleValidationError(
          res,
          "File size exceeds maximum allowed size of 10MB",
          "fileSize",
          "Upload campaign media"
        );
      }

      // Validate MIME type
      const allowedMimeTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "video/mp4",
        "video/3gpp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      if (!allowedMimeTypes.includes(mimeType)) {
        return handleValidationError(
          res,
          "Invalid file type. Allowed types: images (jpeg, png, webp), videos (mp4, 3gpp), documents (pdf, doc, docx)",
          "mimeType",
          "Upload campaign media"
        );
      }

      // Upload to S3 using existing upload service
      const { uploadImageToS3 } = await import("../services/upload.service.js");
      const result = await uploadImageToS3(
        mediaBuffer,
        "whatsapp-campaign",
        filename,
        mimeType
      );

      console.log("✅ Campaign media uploaded to S3:", result.secureUrl);

      res.json({
        url: result.secureUrl,
        key: result.publicId,
      });
    } catch (error) {
      handleError(error, res, "Upload campaign media");
    }
  };

  deleteTemplate = async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return handleValidationError(
          res,
          "Authenticated user required",
          "user",
          "Delete template"
        );
      }

      const accountId = Number(req.query.accountId || req.body.accountId);
      if (Number.isNaN(accountId)) {
        return handleValidationError(
          res,
          "accountId is required",
          "accountId",
          "Delete template"
        );
      }

      const templateName =
        req.params.name || req.query.name || req.body.template_name;
      if (!templateName) {
        return handleValidationError(
          res,
          "template_name is required",
          "template_name",
          "Delete template"
        );
      }

      const result = await this.templateService.deleteTemplate(
        accountId,
        String(templateName)
      );

      await recordAuditLog({
        action: "whatsapp.template.delete",
        changedBy: req.user.id,
        entityType: "WhatsAppTemplate",
        entityId: 0,
        newValues: { accountId, template_name: templateName },
        category: AuditCategory.CAMPAIGN_MANAGEMENT,
        subCategory: WHATSAPP_SUBCATEGORY,
      });

      res.json(result);
    } catch (error) {
      handleError(error, res, "Delete WhatsApp template");
    }
  };

  syncNumbers = async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return handleValidationError(
          res,
          "Authenticated user required",
          "user",
          "Sync numbers"
        );
      }

      const result = await this.accountService.syncNumbers(req.user.id);

      await recordAuditLog({
        action: "whatsapp.numbers.sync",
        changedBy: req.user.id,
        entityType: "WhatsAppNumber",
        entityId: 0,
        newValues: { synced: result.synced, errors: result.errors },
        category: AuditCategory.CAMPAIGN_MANAGEMENT,
        subCategory: WHATSAPP_SUBCATEGORY,
      });

      res.json(result);
    } catch (error) {
      handleError(error, res, "Sync WhatsApp numbers");
    }
  };

  listCampaigns = async (_req: Request, res: Response) => {
    try {
      const campaigns = await this.sendService.listCampaigns();
      res.json(campaigns);
    } catch (error) {
      handleError(error, res, "List WhatsApp campaigns");
    }
  };

  getCampaignById = async (req: Request, res: Response) => {
    try {
      const campaignId = Number(req.params.id);
      if (Number.isNaN(campaignId)) {
        return handleValidationError(
          res,
          "campaign id must be a number",
          "id",
          "Get campaign"
        );
      }

      const campaign = await this.sendService.getCampaignById(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      handleError(error, res, "Get WhatsApp campaign");
    }
  };

  getCampaignConfig = async (req: Request, res: Response) => {
    try {
      const campaignId = Number(req.params.id);
      if (Number.isNaN(campaignId)) {
        return handleValidationError(
          res,
          "campaign id must be a number",
          "id",
          "Get campaign config"
        );
      }

      const config = await this.sendService.getCampaignConfig(campaignId);
      if (!config) {
        return res
          .status(404)
          .json({ error: "Campaign configuration not found" });
      }
      res.json(config);
    } catch (error) {
      handleError(error, res, "Get WhatsApp campaign config");
    }
  };

  updateCampaign = async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return handleValidationError(
          res,
          "Authenticated user required",
          "user",
          "Update campaign"
        );
      }

      const campaignId = Number(req.params.id);
      if (Number.isNaN(campaignId)) {
        return handleValidationError(
          res,
          "campaign id must be a number",
          "id",
          "Update campaign"
        );
      }

      const payload: UpdateCampaignInput = {
        name: req.body.name ? String(req.body.name) : undefined,
        description:
          req.body.description !== undefined
            ? String(req.body.description)
            : undefined,
        templateName: req.body.templateName
          ? String(req.body.templateName)
          : undefined,
        language: req.body.language ? String(req.body.language) : undefined,
        messageParams: req.body.params || undefined,
        audience: req.body.toAudience
          ? (String(req.body.toAudience).toLowerCase() as "all" | "segment")
          : undefined,
        segmentId:
          req.body.segmentId !== undefined
            ? req.body.segmentId
              ? Number(req.body.segmentId)
              : null
            : undefined,
      };

      const result = await this.sendService.updateCampaign(campaignId, payload);

      await recordAuditLog({
        action: "whatsapp.campaign.update",
        changedBy: req.user.id,
        entityType: "Campaign",
        entityId: campaignId,
        newValues: payload as Record<string, unknown>,
        category: AuditCategory.CAMPAIGN_MANAGEMENT,
        subCategory: WHATSAPP_SUBCATEGORY,
      });

      res.json(result);
    } catch (error) {
      handleError(error, res, "Update WhatsApp campaign");
    }
  };

  createCampaign = async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return handleValidationError(
          res,
          "Authenticated user required",
          "user",
          "Create campaign"
        );
      }

      if (
        !validateRequiredFields(
          req.body,
          ["name", "accountId", "templateName"],
          res,
          "Create campaign"
        )
      ) {
        return;
      }

      const audience = String(req.body.toAudience || "all").toLowerCase();
      if (!["all", "segment", "upload", "leads"].includes(audience)) {
        return handleValidationError(
          res,
          "Invalid audience value",
          "toAudience",
          "Create campaign"
        );
      }

      const accountId = Number(req.body.accountId);
      if (Number.isNaN(accountId)) {
        return handleValidationError(
          res,
          "accountId must be a number",
          "accountId",
          "Create campaign"
        );
      }

      const segmentId = req.body.segmentId
        ? Number(req.body.segmentId)
        : undefined;
      if (segmentId !== undefined && Number.isNaN(segmentId)) {
        return handleValidationError(
          res,
          "segmentId must be a number",
          "segmentId",
          "Create campaign"
        );
      }

      const payload: CreateCampaignInput = {
        name: String(req.body.name),
        description: req.body.description
          ? String(req.body.description)
          : undefined,
        accountId,
        templateName: String(req.body.templateName),
        language: req.body.language ? String(req.body.language) : undefined,
        messageParams: req.body.params || {},
        audience: audience as "all" | "segment" | "upload",
        segmentId,
        csvContacts: req.body.csvContacts,
        phoneColumnName: req.body.phoneColumnName,
        createdBy: req.user.id,
        isDraft: Boolean(req.body.isDraft),
      };

      if (payload.audience === "segment" && !payload.segmentId) {
        return handleValidationError(
          res,
          "segmentId is required for segment audience",
          "segmentId",
          "Create campaign"
        );
      }

      if (payload.audience === "upload") {
        if (
          !payload.csvContacts ||
          !Array.isArray(payload.csvContacts) ||
          payload.csvContacts.length === 0
        ) {
          return handleValidationError(
            res,
            "csvContacts is required for upload audience",
            "csvContacts",
            "Create campaign"
          );
        }
        if (!payload.phoneColumnName) {
          return handleValidationError(
            res,
            "phoneColumnName is required for upload audience",
            "phoneColumnName",
            "Create campaign"
          );
        }
      }

      const result = await this.sendService.createCampaign(payload);

      await recordAuditLog({
        action: "whatsapp.campaign.create",
        changedBy: req.user.id,
        entityType: "Campaign",
        entityId: result.campaign.id,
        newValues: {
          campaignId: result.campaign.id,
          accountId: payload.accountId,
          templateName: payload.templateName,
          audience: payload.audience,
          segmentId: payload.segmentId,
        },
        category: AuditCategory.CAMPAIGN_MANAGEMENT,
        subCategory: WHATSAPP_SUBCATEGORY,
      });

      res.status(201).json(result);
    } catch (error) {
      handleError(error, res, "Create WhatsApp campaign");
    }
  };

  scheduleOrSend = async (req: Request, res: Response) => {
    try {
      const campaignId = Number(req.params.id);
      if (Number.isNaN(campaignId)) {
        return handleValidationError(
          res,
          "campaign id must be a number",
          "id",
          "Send campaign"
        );
      }

      const result = await this.sendService.sendCampaign(campaignId);

      if (req.user?.id) {
        await recordAuditLog({
          action: "whatsapp.campaign.send",
          changedBy: req.user.id,
          entityType: "Campaign",
          entityId: campaignId,
          newValues: { queued: result.queued },
          category: AuditCategory.CAMPAIGN_MANAGEMENT,
          subCategory: WHATSAPP_SUBCATEGORY,
        });
      }

      res.json(result);
    } catch (error) {
      handleError(error, res, "Send WhatsApp campaign");
    }
  };

  scheduleCampaign = async (req: Request, res: Response) => {
    try {
      const campaignId = Number(req.params.id);
      if (Number.isNaN(campaignId)) {
        return handleValidationError(
          res,
          "campaign id must be a number",
          "id",
          "Schedule campaign"
        );
      }

      const { scheduledAt } = req.body;
      if (!scheduledAt) {
        return handleValidationError(
          res,
          "scheduledAt is required",
          "scheduledAt",
          "Schedule campaign"
        );
      }

      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate <= new Date()) {
        return handleValidationError(
          res,
          "Scheduled time must be in the future",
          "scheduledAt",
          "Schedule campaign"
        );
      }

      const result = await this.sendService.scheduleCampaign(
        campaignId,
        scheduledDate
      );

      if (req.user?.id) {
        await recordAuditLog({
          action: "whatsapp.campaign.schedule",
          changedBy: req.user.id,
          entityType: "Campaign",
          entityId: campaignId,
          newValues: { scheduledAt: scheduledDate.toISOString() },
          category: AuditCategory.CAMPAIGN_MANAGEMENT,
          subCategory: WHATSAPP_SUBCATEGORY,
        });
      }

      res.json(result);
    } catch (error) {
      handleError(error, res, "Schedule WhatsApp campaign");
    }
  };

  optOut = async (req: Request, res: Response) => {
    try {
      const {
        phone,
        channel = "whatsapp",
        reason,
        source = "manual",
      } = req.body;

      if (!phone) {
        return handleValidationError(
          res,
          "Phone number is required",
          "phone",
          "Opt-out"
        );
      }

      const result = await this.optOutService.addOptOut({
        phone,
        channel: channel as "whatsapp" | "sms" | "email",
        source,
        reason,
      });

      res.json({
        success: true,
        message: "Phone number opted out successfully",
        data: result,
      });
    } catch (error) {
      handleError(error, res, "Opt-out");
    }
  };

  removeOptOut = async (req: Request, res: Response) => {
    try {
      const { phone, channel = "whatsapp" } = req.body;

      if (!phone) {
        return handleValidationError(
          res,
          "Phone number is required",
          "phone",
          "Remove opt-out"
        );
      }

      const result = await this.optOutService.removeOptOut(
        phone,
        channel as "whatsapp" | "sms" | "email"
      );

      res.json({
        success: true,
        message: "Opt-out removed successfully",
        data: result,
      });
    } catch (error) {
      handleError(error, res, "Remove opt-out");
    }
  };

  listOptOuts = async (req: Request, res: Response) => {
    try {
      const channel = req.query.channel as string | undefined;
      const search = req.query.search as string | undefined;
      const skip = Number(req.query.skip) || 0;
      const take = Number(req.query.take) || 50;
      const sortBy =
        (req.query.sortBy as "optedOutAt" | "phone") || "optedOutAt";
      const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

      const result = await this.optOutService.listOptOuts({
        channel,
        search,
        skip,
        take,
        sortBy,
        sortOrder,
      });

      res.json(result);
    } catch (error) {
      handleError(error, res, "List opt-outs");
    }
  };

  getOptOutStats = async (_req: Request, res: Response) => {
    try {
      const stats = await this.optOutService.getOptOutStats();
      res.json(stats);
    } catch (error) {
      handleError(error, res, "Get opt-out stats");
    }
  };

  checkOptOut = async (req: Request, res: Response) => {
    try {
      const { phone, channel = "whatsapp" } = req.query;

      if (!phone || typeof phone !== "string") {
        return handleValidationError(
          res,
          "Phone number is required",
          "phone",
          "Check opt-out"
        );
      }

      const isOptedOut = await this.optOutService.isOptedOut(
        phone,
        channel as "whatsapp" | "sms" | "email"
      );

      res.json({
        phone,
        channel,
        isOptedOut,
      });
    } catch (error) {
      handleError(error, res, "Check opt-out");
    }
  };

  listDeliveries = async (req: Request, res: Response) => {
    try {
      const campaignId = Number(req.query.campaignId);
      if (Number.isNaN(campaignId)) {
        return handleValidationError(
          res,
          "campaignId is required",
          "campaignId",
          "List deliveries"
        );
      }

      const deliveries = await this.sendService.listDeliveries(campaignId);
      res.json(deliveries);
    } catch (error) {
      handleError(error, res, "List WhatsApp deliveries");
    }
  };

  listEvents = async (req: Request, res: Response) => {
    try {
      const campaignId = Number(req.query.campaignId);
      if (Number.isNaN(campaignId)) {
        return handleValidationError(
          res,
          "campaignId is required",
          "campaignId",
          "List events"
        );
      }

      const events = await this.sendService.listEvents(campaignId);
      res.json(events);
    } catch (error) {
      handleError(error, res, "List WhatsApp events");
    }
  };

  handleWebhook = async (req: Request, res: Response) => {
    try {
      const result = await this.webhookService.handleMsg91Event(req.body);
      res.json(result);
    } catch (error) {
      handleError(error, res, "WhatsApp webhook");
    }
  };

  handleInboundMessage = async (req: Request, res: Response) => {
    try {
      console.log("=== INBOUND MESSAGE WEBHOOK CALLED ===");
      console.log("Request headers:", JSON.stringify(req.headers, null, 2));
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      console.log("Request method:", req.method);
      console.log("Request URL:", req.url);
      console.log("Request IP:", req.ip);
      console.log("=======================================");

      const result = await this.webhookService.handleMsg91InboundMessage(
        req.body
      );

      console.log("=== INBOUND MESSAGE RESULT ===");
      console.log("Result:", JSON.stringify(result, null, 2));
      console.log("==============================");

      res.json(result);
    } catch (error) {
      console.error("=== INBOUND MESSAGE ERROR ===");
      console.error("Error:", error);
      console.error(
        "Error stack:",
        error instanceof Error ? error.stack : "No stack trace"
      );
      console.error("=============================");
      handleError(error, res, "WhatsApp inbound message webhook");
    }
  };
}
