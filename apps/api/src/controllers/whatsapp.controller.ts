import { Request, Response } from "express";
import { WhatsappAccountService } from "../services/whatsapp/account-service.js";
import { WhatsappTemplateService } from "../services/whatsapp/template-service.js";
import {
  WhatsappSendService,
  CreateCampaignInput,
  UpdateCampaignInput,
} from "../services/whatsapp/send-service.js";
import { WhatsappWebhookService } from "../services/whatsapp/webhook-service.js";
import { OptOutService } from "../services/whatsapp/opt-out-service.js";
import {
  handleError,
  handleNotFoundError,
  handleValidationError,
  validateRequiredFields,
} from "../utils/error-handler.js";
import { recordAuditLog } from "../utils/audit.utils.js";
import { AuditCategory } from "@prisma/client";
import {
  decodeBase64File,
  verifyFileContent,
} from "../utils/file-validation.js";
import { uploadToS3 } from "../services/s3.service.js";
import {
  parseBoundedInteger,
  parseIsoDate,
  parsePositiveInteger,
  parseStrictBoolean,
} from "../utils/validators.js";
import { optionalString, requireString } from "../utils/supply-chain-http.js";
import { normalizeWhatsAppPhone } from "../services/whatsapp/phone.js";

const WHATSAPP_SUBCATEGORY = "WHATSAPP";
const MAX_WHATSAPP_MEDIA_BYTES = 10 * 1024 * 1024;
const WHATSAPP_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/3gpp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

type JsonObject = Record<string, unknown>;
type CsvContact = Record<string, string>;

function isPlainObject(value: unknown): value is JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parseJsonObject(
  value: unknown,
  maximumKeys = 100,
  maximumBytes = 64 * 1024
): JsonObject | null {
  if (!isPlainObject(value)) return null;
  if (Object.keys(value).length > maximumKeys) return null;
  return Buffer.byteLength(JSON.stringify(value), "utf8") <= maximumBytes
    ? value
    : null;
}

function parseCsvContacts(value: unknown): CsvContact[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10_000) {
    return null;
  }
  const rows: CsvContact[] = [];
  for (const valueRow of value) {
    if (!isPlainObject(valueRow)) return null;
    const entries = Object.entries(valueRow);
    if (entries.length < 1 || entries.length > 100) return null;
    const row: CsvContact = {};
    for (const [key, cell] of entries) {
      if (
        key.length < 1 ||
        key.length > 120 ||
        typeof cell !== "string" ||
        cell.length > 2_000
      ) {
        return null;
      }
      row[key] = cell;
    }
    rows.push(row);
  }
  return rows;
}

function parseTemplateComponents(value: unknown): JsonObject[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    return null;
  }
  if (!value.every(isPlainObject)) return null;
  return Buffer.byteLength(JSON.stringify(value), "utf8") <= 128 * 1024
    ? value
    : null;
}

function isWhatsAppChannel(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (typeof value === "string" && value.trim().toLowerCase() === "whatsapp")
  );
}

function parseListPagination(req: Request): {
  skip: number;
  take: number;
} | null {
  const skip =
    req.query.skip === undefined
      ? 0
      : parseBoundedInteger(req.query.skip, 0, 1_000_000);
  const take =
    req.query.take === undefined
      ? 50
      : parseBoundedInteger(req.query.take, 1, 200);
  return skip === null || take === null ? null : { skip, take };
}

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

      const response = accounts.map(account => ({
        ...account,
        sourceHandle: account.phoneNumber,
      }));

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
          displayName: requireString(req.body.displayName, "displayName", 120),
          phoneNumber: requireString(req.body.sourceHandle, "sourceHandle", 40),
          apiKey: requireString(req.body.apiKey, "apiKey", 2_048),
          senderId: optionalString(req.body.senderId, "senderId", 120),
          businessId: optionalString(req.body.businessId, "businessId", 120),
          appName: optionalString(req.body.appName, "appName", 120),
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

      const accountId = parsePositiveInteger(req.params.id);
      if (accountId === null) {
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

      const status = requireString(req.body.status, "status", 20).toUpperCase();
      if (status !== "ACTIVE" && status !== "INACTIVE") {
        return handleValidationError(
          res,
          "status must be ACTIVE or INACTIVE",
          "status",
          "Update account"
        );
      }

      const record = await this.accountService.updateAccount(
        accountId,
        {
          displayName: requireString(req.body.displayName, "displayName", 120),
          status: status as "ACTIVE" | "INACTIVE",
          apiKey: optionalString(req.body.apiKey, "apiKey", 2_048),
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
      const accountId = parsePositiveInteger(req.query.accountId);
      if (accountId === null) {
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
      const accountId = parsePositiveInteger(
        req.body.accountId ?? req.query.accountId
      );
      if (accountId === null) {
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

      const accountId = parsePositiveInteger(req.body.accountId);
      if (accountId === null) {
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

      const templateName = requireString(
        req.body.template_name,
        "template_name",
        512
      );
      if (!/^[a-z0-9_]+$/.test(templateName)) {
        return handleValidationError(
          res,
          "template_name may contain only lowercase letters, numbers, and underscores",
          "template_name",
          "Create template"
        );
      }
      const language = requireString(req.body.language, "language", 20);
      if (!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language)) {
        return handleValidationError(
          res,
          "language must be a supported locale code such as en or en_US",
          "language",
          "Create template"
        );
      }
      const category = requireString(
        req.body.category,
        "category",
        30
      ).toUpperCase();
      if (!["UTILITY", "MARKETING", "AUTHENTICATION"].includes(category)) {
        return handleValidationError(
          res,
          "category must be UTILITY, MARKETING, or AUTHENTICATION",
          "category",
          "Create template"
        );
      }
      const components = parseTemplateComponents(req.body.components);
      if (!components) {
        return handleValidationError(
          res,
          "components must contain 1 to 20 valid objects within 128KB",
          "components",
          "Create template"
        );
      }
      const buttonUrl =
        req.body.button_url === undefined
          ? undefined
          : parseStrictBoolean(req.body.button_url);
      if (req.body.button_url !== undefined && buttonUrl === null) {
        return handleValidationError(
          res,
          "button_url must be true or false",
          "button_url",
          "Create template"
        );
      }

      const messageTtl =
        req.body.message_ttl === undefined
          ? undefined
          : parseBoundedInteger(req.body.message_ttl, 30, 900);
      const ttlInSeconds =
        req.body.ttl_in_seconds === undefined
          ? undefined
          : parseBoundedInteger(req.body.ttl_in_seconds, 1, 2_592_000);
      if (
        (req.body.message_ttl !== undefined && messageTtl === null) ||
        (req.body.ttl_in_seconds !== undefined && ttlInSeconds === null)
      ) {
        return handleValidationError(
          res,
          "message_ttl must be 30-900 seconds and ttl_in_seconds must be 1-2592000 seconds",
          "message_ttl",
          "Create template"
        );
      }

      const result = await this.templateService.createTemplate(accountId, {
        template_name: templateName,
        language,
        category,
        button_url: buttonUrl ?? undefined,
        message_ttl: messageTtl ?? undefined,
        ttl_in_seconds: ttlInSeconds ?? undefined,
        components,
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

      const accountId = parsePositiveInteger(req.body.accountId);
      if (accountId === null) {
        return handleValidationError(
          res,
          "accountId is required",
          "accountId",
          "Update template"
        );
      }

      const rawTemplateName = req.params.name || req.body.template_name;
      if (!rawTemplateName) {
        return handleValidationError(
          res,
          "template_name is required",
          "template_name",
          "Update template"
        );
      }

      const templateName = requireString(rawTemplateName, "template_name", 512);
      if (!/^[a-z0-9_]+$/.test(templateName)) {
        return handleValidationError(
          res,
          "template_name may contain only lowercase letters, numbers, and underscores",
          "template_name",
          "Update template"
        );
      }
      const components = parseTemplateComponents(req.body.components);
      if (!components) {
        return handleValidationError(
          res,
          "components must contain 1 to 20 valid objects within 128KB",
          "components",
          "Update template"
        );
      }

      const result = await this.templateService.updateTemplate(
        accountId,
        templateName,
        components
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

      const accountId = parsePositiveInteger(req.body.accountId);
      if (accountId === null) {
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

      const mediaBuffer = decodeBase64File(
        req.body.mediaBase64,
        MAX_WHATSAPP_MEDIA_BYTES
      );
      const verified = mediaBuffer
        ? verifyFileContent(
            mediaBuffer,
            req.body.mimeType,
            WHATSAPP_MEDIA_MIME_TYPES
          )
        : null;
      if (!mediaBuffer || !verified) {
        return handleValidationError(
          res,
          "Media must be a valid supported file no larger than 10MB",
          "media",
          "Upload media"
        );
      }

      const headerHandle = await this.templateService.uploadMedia(
        accountId,
        mediaBuffer,
        verified.mimeType
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

      const mediaBuffer = decodeBase64File(
        req.body.mediaBase64,
        MAX_WHATSAPP_MEDIA_BYTES
      );
      const verified = mediaBuffer
        ? verifyFileContent(
            mediaBuffer,
            req.body.mimeType,
            WHATSAPP_MEDIA_MIME_TYPES
          )
        : null;
      if (!mediaBuffer || !verified) {
        return handleValidationError(
          res,
          "Media must be a valid supported file no larger than 10MB",
          "media",
          "Upload campaign media"
        );
      }

      const rawFilename = req.body.filename;
      if (
        rawFilename !== undefined &&
        (typeof rawFilename !== "string" || rawFilename.trim().length > 120)
      ) {
        return handleValidationError(
          res,
          "filename cannot exceed 120 characters",
          "filename",
          "Upload campaign media"
        );
      }
      const filename =
        typeof rawFilename === "string" && rawFilename.trim()
          ? rawFilename.trim()
          : "media";

      const result = await uploadToS3(mediaBuffer, {
        folder: "whatsapp-campaign",
        filename,
        contentType: verified.mimeType,
        publicRead: false,
      });

      return res.json({
        url: `s3://${result.key}`,
        key: result.key,
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

      const accountId = parsePositiveInteger(
        req.query.accountId ?? req.body.accountId
      );
      if (accountId === null) {
        return handleValidationError(
          res,
          "accountId is required",
          "accountId",
          "Delete template"
        );
      }

      const rawTemplateName =
        req.params.name || req.query.name || req.body.template_name;
      if (!rawTemplateName) {
        return handleValidationError(
          res,
          "template_name is required",
          "template_name",
          "Delete template"
        );
      }
      const templateName = requireString(rawTemplateName, "template_name", 512);
      if (!/^[a-z0-9_]+$/.test(templateName)) {
        return handleValidationError(
          res,
          "template_name may contain only lowercase letters, numbers, and underscores",
          "template_name",
          "Delete template"
        );
      }

      const result = await this.templateService.deleteTemplate(
        accountId,
        templateName
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

  listCampaigns = async (req: Request, res: Response) => {
    try {
      const skip =
        req.query.skip === undefined
          ? 0
          : parseBoundedInteger(req.query.skip, 0, 1_000_000);
      const take =
        req.query.take === undefined
          ? 25
          : parseBoundedInteger(req.query.take, 1, 200);
      if (skip === null || take === null) {
        return handleValidationError(
          res,
          "skip must be non-negative and take must be between 1 and 200",
          "pagination",
          "List campaigns"
        );
      }
      const search =
        req.query.search === undefined
          ? undefined
          : (optionalString(req.query.search, "search", 200) ?? undefined);
      const rawStatus =
        req.query.status === undefined
          ? undefined
          : requireString(req.query.status, "status", 20).toLowerCase();
      const allowedStatuses = [
        "draft",
        "pending",
        "failed",
        "sent",
        "sending",
        "active",
      ] as const;
      if (
        rawStatus !== undefined &&
        !allowedStatuses.includes(rawStatus as (typeof allowedStatuses)[number])
      ) {
        return handleValidationError(
          res,
          "status must be draft, pending, failed, sent, sending, or active",
          "status",
          "List campaigns"
        );
      }
      const startDate =
        req.query.startDate === undefined
          ? undefined
          : parseIsoDate(req.query.startDate);
      const createdFrom =
        req.query.createdFrom === undefined
          ? undefined
          : parseIsoDate(req.query.createdFrom);
      const createdTo =
        req.query.createdTo === undefined
          ? undefined
          : parseIsoDate(req.query.createdTo);
      if (
        (req.query.startDate !== undefined && !startDate) ||
        (req.query.createdFrom !== undefined && !createdFrom) ||
        (req.query.createdTo !== undefined && !createdTo) ||
        (createdFrom && createdTo && createdTo < createdFrom)
      ) {
        return handleValidationError(
          res,
          "Campaign dates must be valid YYYY-MM-DD values in chronological order",
          "dates",
          "List campaigns"
        );
      }

      const campaigns = await this.sendService.listCampaigns({
        skip,
        take,
        search,
        status: rawStatus as
          | "draft"
          | "pending"
          | "failed"
          | "sent"
          | "sending"
          | "active"
          | undefined,
        startDate: startDate ?? undefined,
        createdFrom: createdFrom ?? undefined,
        createdTo: createdTo ?? undefined,
      });
      res.json(campaigns);
    } catch (error) {
      handleError(error, res, "List WhatsApp campaigns");
    }
  };

  getCampaignById = async (req: Request, res: Response) => {
    try {
      const campaignId = parsePositiveInteger(req.params.id);
      if (campaignId === null) {
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
      const campaignId = parsePositiveInteger(req.params.id);
      if (campaignId === null) {
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

      const campaignId = parsePositiveInteger(req.params.id);
      if (campaignId === null) {
        return handleValidationError(
          res,
          "campaign id must be a number",
          "id",
          "Update campaign"
        );
      }

      const requestedAudience =
        req.body.toAudience === undefined
          ? undefined
          : requireString(req.body.toAudience, "toAudience", 20).toLowerCase();
      if (
        requestedAudience !== undefined &&
        !["all", "segment", "leads"].includes(requestedAudience)
      ) {
        return handleValidationError(
          res,
          "Audience must be all, segment, or leads when editing a campaign",
          "toAudience",
          "Update campaign"
        );
      }
      const segmentId =
        req.body.segmentId === undefined
          ? undefined
          : req.body.segmentId === null || req.body.segmentId === ""
            ? null
            : parsePositiveInteger(req.body.segmentId);
      if (
        segmentId === null &&
        req.body.segmentId !== null &&
        req.body.segmentId !== ""
      ) {
        return handleValidationError(
          res,
          "segmentId must be a positive integer",
          "segmentId",
          "Update campaign"
        );
      }
      if (requestedAudience === "segment" && !segmentId) {
        return handleValidationError(
          res,
          "segmentId is required for segment audience",
          "segmentId",
          "Update campaign"
        );
      }

      const params =
        req.body.params === undefined
          ? undefined
          : parseJsonObject(req.body.params);
      if (req.body.params !== undefined && !params) {
        return handleValidationError(
          res,
          "params must be an object with at most 100 keys and 64KB",
          "params",
          "Update campaign"
        );
      }
      const batchSize =
        req.body.batchSize === undefined
          ? undefined
          : parseBoundedInteger(req.body.batchSize, 1, 800);
      if (req.body.batchSize !== undefined && batchSize === null) {
        return handleValidationError(
          res,
          "batchSize must be an integer between 1 and 800",
          "batchSize",
          "Update campaign"
        );
      }

      const payload: UpdateCampaignInput = {
        name:
          req.body.name === undefined
            ? undefined
            : requireString(req.body.name, "name", 160),
        description:
          req.body.description === undefined
            ? undefined
            : optionalString(req.body.description, "description", 2_000),
        templateName:
          req.body.templateName === undefined
            ? undefined
            : requireString(req.body.templateName, "templateName", 512),
        language:
          req.body.language === undefined
            ? undefined
            : requireString(req.body.language, "language", 20),
        messageParams: params ?? undefined,
        audience: requestedAudience as "all" | "segment" | "leads" | undefined,
        segmentId,
        batchSize: batchSize ?? undefined,
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

      const audience =
        req.body.toAudience === undefined
          ? "all"
          : requireString(req.body.toAudience, "toAudience", 20).toLowerCase();
      if (!["all", "segment", "upload", "leads"].includes(audience)) {
        return handleValidationError(
          res,
          "Invalid audience value",
          "toAudience",
          "Create campaign"
        );
      }

      const accountId = parsePositiveInteger(req.body.accountId);
      if (accountId === null) {
        return handleValidationError(
          res,
          "accountId must be a number",
          "accountId",
          "Create campaign"
        );
      }

      const segmentId =
        req.body.segmentId === undefined || req.body.segmentId === ""
          ? undefined
          : parsePositiveInteger(req.body.segmentId);
      if (segmentId === null) {
        return handleValidationError(
          res,
          "segmentId must be a number",
          "segmentId",
          "Create campaign"
        );
      }

      const parsedIsDraft =
        req.body.isDraft === undefined
          ? false
          : parseStrictBoolean(req.body.isDraft);
      if (parsedIsDraft === null) {
        return handleValidationError(
          res,
          "isDraft must be true or false",
          "isDraft",
          "Create campaign"
        );
      }

      const params =
        req.body.params === undefined ? {} : parseJsonObject(req.body.params);
      if (!params) {
        return handleValidationError(
          res,
          "params must be an object with at most 100 keys and 64KB",
          "params",
          "Create campaign"
        );
      }
      const batchSize =
        req.body.batchSize === undefined
          ? undefined
          : parseBoundedInteger(req.body.batchSize, 1, 800);
      if (req.body.batchSize !== undefined && batchSize === null) {
        return handleValidationError(
          res,
          "batchSize must be an integer between 1 and 800",
          "batchSize",
          "Create campaign"
        );
      }

      const payload: CreateCampaignInput = {
        name: requireString(req.body.name, "name", 160),
        description:
          optionalString(req.body.description, "description", 2_000) ??
          undefined,
        accountId,
        templateName: requireString(req.body.templateName, "templateName", 512),
        language:
          optionalString(req.body.language, "language", 20) ?? undefined,
        messageParams: params,
        audience: audience as "all" | "segment" | "upload" | "leads",
        segmentId:
          audience === "segment" ? (segmentId ?? undefined) : undefined,
        createdBy: req.user.id,
        isDraft: parsedIsDraft,
        batchSize: batchSize ?? undefined,
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
        if (parsedIsDraft) {
          return handleValidationError(
            res,
            "Upload audiences cannot be saved as an empty draft",
            "isDraft",
            "Create campaign"
          );
        }
        const csvContacts = parseCsvContacts(req.body.csvContacts);
        if (!csvContacts) {
          return handleValidationError(
            res,
            "csvContacts must contain 1 to 10000 valid string rows",
            "csvContacts",
            "Create campaign"
          );
        }
        const phoneColumnName = optionalString(
          req.body.phoneColumnName,
          "phoneColumnName",
          120
        );
        if (
          !phoneColumnName ||
          !csvContacts.every(row =>
            Object.prototype.hasOwnProperty.call(row, phoneColumnName)
          )
        ) {
          return handleValidationError(
            res,
            "phoneColumnName must identify a column in every CSV row",
            "phoneColumnName",
            "Create campaign"
          );
        }
        payload.csvContacts = csvContacts;
        payload.phoneColumnName = phoneColumnName;
      } else if (
        req.body.segmentId !== undefined &&
        req.body.segmentId !== "" &&
        audience !== "segment"
      ) {
        return handleValidationError(
          res,
          "segmentId is only valid for segment audience",
          "segmentId",
          "Create campaign"
        );
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
      const campaignId = parsePositiveInteger(req.params.id);
      if (campaignId === null) {
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
      const campaignId = parsePositiveInteger(req.params.id);
      if (campaignId === null) {
        return handleValidationError(
          res,
          "campaign id must be a number",
          "id",
          "Schedule campaign"
        );
      }

      const rawScheduledAt = req.body.scheduledAt;
      const scheduledDate =
        typeof rawScheduledAt === "string" && rawScheduledAt.includes("T")
          ? parseIsoDate(rawScheduledAt)
          : null;
      if (!scheduledDate) {
        return handleValidationError(
          res,
          "scheduledAt must be a valid timezone-qualified ISO timestamp",
          "scheduledAt",
          "Schedule campaign"
        );
      }

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
      if (!isWhatsAppChannel(req.body.channel)) {
        return handleValidationError(
          res,
          "channel must be whatsapp",
          "channel",
          "Opt-out"
        );
      }
      const phone = requireString(req.body.phone, "phone", 40);
      const normalizedPhone = normalizeWhatsAppPhone(phone);
      if (!normalizedPhone) {
        return handleValidationError(
          res,
          "phone must be a valid international or 10-digit Indian number",
          "phone",
          "Opt-out"
        );
      }

      const result = await this.optOutService.addOptOut({
        phone: normalizedPhone,
        source: optionalString(req.body.source, "source", 120) ?? "manual",
        reason: optionalString(req.body.reason, "reason", 1_000) ?? undefined,
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
      if (!isWhatsAppChannel(req.body.channel)) {
        return handleValidationError(
          res,
          "channel must be whatsapp",
          "channel",
          "Remove opt-out"
        );
      }
      const phone = requireString(req.body.phone, "phone", 40);
      const normalizedPhone = normalizeWhatsAppPhone(phone);
      if (!normalizedPhone) {
        return handleValidationError(
          res,
          "phone must be a valid international or 10-digit Indian number",
          "phone",
          "Remove opt-out"
        );
      }

      const result = await this.optOutService.removeOptOut(normalizedPhone);
      if (!result) {
        return handleNotFoundError(res, "WhatsApp opt-out", "Remove opt-out");
      }

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
      if (!isWhatsAppChannel(req.query.channel)) {
        return handleValidationError(
          res,
          "channel must be whatsapp",
          "channel",
          "List opt-outs"
        );
      }
      const search =
        req.query.search === undefined
          ? undefined
          : typeof req.query.search === "string"
            ? req.query.search.trim()
            : null;
      if (search === null) {
        return handleValidationError(
          res,
          "search must be text",
          "search",
          "List opt-outs"
        );
      }
      if (search && search.length > 200) {
        return handleValidationError(
          res,
          "search cannot exceed 200 characters",
          "search",
          "List opt-outs"
        );
      }
      if (search && !/^\+?[\d\s().-]+$/.test(search)) {
        return handleValidationError(
          res,
          "search must contain only phone-number characters",
          "search",
          "List opt-outs"
        );
      }
      const skip =
        req.query.skip === undefined
          ? 0
          : parseBoundedInteger(req.query.skip, 0, 1_000_000);
      const take =
        req.query.take === undefined
          ? 50
          : parseBoundedInteger(req.query.take, 1, 200);
      if (skip === null || take === null) {
        return handleValidationError(
          res,
          "skip must be non-negative and take must be between 1 and 200",
          "pagination",
          "List opt-outs"
        );
      }
      const sortBy = req.query.sortBy ?? "optedOutAt";
      const sortOrder = req.query.sortOrder ?? "desc";
      if (
        typeof sortBy !== "string" ||
        (sortBy !== "optedOutAt" && sortBy !== "phone")
      ) {
        return handleValidationError(
          res,
          "sortBy must be optedOutAt or phone",
          "sortBy",
          "List opt-outs"
        );
      }
      if (
        typeof sortOrder !== "string" ||
        (sortOrder !== "asc" && sortOrder !== "desc")
      ) {
        return handleValidationError(
          res,
          "sortOrder must be asc or desc",
          "sortOrder",
          "List opt-outs"
        );
      }

      const result = await this.optOutService.listOptOuts({
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
      const phone = req.query.phone;
      if (!phone || typeof phone !== "string") {
        return handleValidationError(
          res,
          "Phone number is required",
          "phone",
          "Check opt-out"
        );
      }
      if (!isWhatsAppChannel(req.query.channel)) {
        return handleValidationError(
          res,
          "channel must be whatsapp",
          "channel",
          "Check opt-out"
        );
      }
      const normalizedPhone = normalizeWhatsAppPhone(phone);
      if (!normalizedPhone) {
        return handleValidationError(
          res,
          "phone must be a valid international or 10-digit Indian number",
          "phone",
          "Check opt-out"
        );
      }

      const isOptedOut = await this.optOutService.isOptedOut(normalizedPhone);

      res.json({
        phone: normalizedPhone,
        channel: "whatsapp",
        isOptedOut,
      });
    } catch (error) {
      handleError(error, res, "Check opt-out");
    }
  };

  listDeliveries = async (req: Request, res: Response) => {
    try {
      const campaignId = parsePositiveInteger(req.query.campaignId);
      if (campaignId === null) {
        return handleValidationError(
          res,
          "campaignId is required",
          "campaignId",
          "List deliveries"
        );
      }
      const pagination = parseListPagination(req);
      if (!pagination) {
        return handleValidationError(
          res,
          "skip must be non-negative and take must be between 1 and 200",
          "pagination",
          "List deliveries"
        );
      }

      const deliveries = await this.sendService.listDeliveries(
        campaignId,
        pagination
      );
      res.json(deliveries);
    } catch (error) {
      handleError(error, res, "List WhatsApp deliveries");
    }
  };

  listEvents = async (req: Request, res: Response) => {
    try {
      const campaignId = parsePositiveInteger(req.query.campaignId);
      if (campaignId === null) {
        return handleValidationError(
          res,
          "campaignId is required",
          "campaignId",
          "List events"
        );
      }
      const pagination = parseListPagination(req);
      if (!pagination) {
        return handleValidationError(
          res,
          "skip must be non-negative and take must be between 1 and 200",
          "pagination",
          "List events"
        );
      }

      const events = await this.sendService.listEvents(campaignId, pagination);
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
      const result = await this.webhookService.handleMsg91InboundMessage(
        req.body
      );
      res.json(result);
    } catch (error) {
      handleError(error, res, "WhatsApp inbound message webhook");
    }
  };
}
