import { Request, Response } from "express";
import {
  SegmentService,
  SegmentPayload,
  SegmentRuleInput,
  SegmentRuleOperator,
} from "../services/segment.service.js";
import {
  handleError,
  handleNotFoundError,
  handleValidationError,
  validateRequiredFields,
} from "../utils/error-handler.js";
import { recordAuditLog } from "../utils/audit.utils.js";
import {
  SegmentRuleType,
  SegmentEntityType,
  AuditCategory,
} from "@prisma/client";

const WHATSAPP_SUBCATEGORY = "WHATSAPP";

export class SegmentController {
  private service: SegmentService;

  constructor() {
    this.service = new SegmentService();
  }

  list = async (req: Request, res: Response) => {
    try {
      const segments = await this.service.listSegments();
      res.json(segments);
    } catch (error) {
      handleError(error, res, "List segments");
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return handleValidationError(
          res,
          "Segment id must be a number",
          "id",
          "Get segment"
        );
      }

      const segment = await this.service.getSegmentById(id);
      if (!segment) {
        return handleNotFoundError(res, "Segment", "Get segment");
      }

      res.json(segment);
    } catch (error) {
      handleError(error, res, "Get segment");
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return handleValidationError(
          res,
          "Authenticated user required",
          "user",
          "Create segment"
        );
      }

      if (!validateRequiredFields(req.body, ["name"], res, "Create segment")) {
        return;
      }

      const payload = this.normalizePayload(req.body);
      if (!payload) {
        return handleValidationError(
          res,
          "Invalid rules payload",
          "rules",
          "Create segment"
        );
      }

      const segment = await this.service.createSegment(payload, req.user.id);

      await recordAuditLog({
        action: "segment.create",
        changedBy: req.user.id,
        entityType: "Segment",
        entityId: segment.id,
        newValues: {
          name: segment.name,
          logicOperator: segment.logicOperator,
          rules: payload.rules,
        },
        category: AuditCategory.CAMPAIGN_MANAGEMENT,
        subCategory: WHATSAPP_SUBCATEGORY,
      });

      res.status(201).json(segment);
    } catch (error) {
      handleError(error, res, "Create segment");
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return handleValidationError(
          res,
          "Authenticated user required",
          "user",
          "Update segment"
        );
      }

      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return handleValidationError(
          res,
          "Segment id must be a number",
          "id",
          "Update segment"
        );
      }

      const existing = await this.service.getSegmentById(id);
      if (!existing) {
        return handleNotFoundError(res, "Segment", "Update segment");
      }

      if (!validateRequiredFields(req.body, ["name"], res, "Update segment")) {
        return;
      }

      const payload = this.normalizePayload(req.body);
      if (!payload) {
        return handleValidationError(
          res,
          "Invalid rules payload",
          "rules",
          "Update segment"
        );
      }

      const segment = await this.service.updateSegment(
        id,
        payload,
        req.user.id
      );

      await recordAuditLog({
        action: "segment.update",
        changedBy: req.user.id,
        entityType: "Segment",
        entityId: segment.id,
        oldValues: {
          name: existing.name,
          logicOperator: existing.logicOperator,
          rules: existing.rules,
        },
        newValues: {
          name: segment.name,
          logicOperator: segment.logicOperator,
          rules: payload.rules,
        },
        category: AuditCategory.CAMPAIGN_MANAGEMENT,
        subCategory: WHATSAPP_SUBCATEGORY,
      });

      res.json(segment);
    } catch (error) {
      handleError(error, res, "Update segment");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return handleValidationError(
          res,
          "Authenticated user required",
          "user",
          "Delete segment"
        );
      }

      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return handleValidationError(
          res,
          "Segment id must be a number",
          "id",
          "Delete segment"
        );
      }

      const existing = await this.service.getSegmentById(id);
      if (!existing) {
        return handleNotFoundError(res, "Segment", "Delete segment");
      }

      await this.service.deleteSegment(id);

      await recordAuditLog({
        action: "segment.delete",
        changedBy: req.user.id,
        entityType: "Segment",
        entityId: id,
        oldValues: {
          name: existing.name,
          logicOperator: existing.logicOperator,
        },
        category: AuditCategory.CAMPAIGN_MANAGEMENT,
        subCategory: WHATSAPP_SUBCATEGORY,
      });

      res.json({ success: true });
    } catch (error) {
      handleError(error, res, "Delete segment");
    }
  };

  resolve = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return handleValidationError(
          res,
          "Segment id must be a number",
          "id",
          "Resolve segment"
        );
      }

      const limitSource =
        req.query.limit ?? (req.body?.limit as number | string | undefined);
      const limit = limitSource ? Number(limitSource) : 200;
      if (Number.isNaN(limit) || limit < 0 || limit > 1000) {
        return handleValidationError(
          res,
          "limit must be between 0 and 1000",
          "limit",
          "Resolve segment"
        );
      }

      const result = await this.service.resolveSegmentContacts(id, limit);
      if (!result) {
        return handleNotFoundError(res, "Segment", "Resolve segment");
      }

      res.json(result);
    } catch (error) {
      handleError(error, res, "Resolve segment");
    }
  };

  private normalizePayload(
    body: Record<string, unknown>
  ): SegmentPayload | null {
    const logicValue = body.logicOperator;
    const logicOperator =
      typeof logicValue === "string" ? logicValue.toUpperCase() : "AND";
    if (logicOperator && !["AND", "OR"].includes(logicOperator)) {
      return null;
    }

    const rulesValue = body.rules;
    type RawRule = { ruleType?: unknown; operator?: unknown; value?: unknown };
    const rawRules = Array.isArray(rulesValue) ? (rulesValue as RawRule[]) : [];
    const parsedRules: SegmentRuleInput[] = [];

    for (let i = 0; i < rawRules.length; i += 1) {
      const raw = rawRules[i];
      const type =
        typeof raw?.ruleType === "string" ? raw.ruleType.toUpperCase() : "";
      if (!Object.values(SegmentRuleType).includes(type as SegmentRuleType)) {
        return null;
      }

      const operator =
        typeof raw?.operator === "string" ? raw.operator.toUpperCase() : "IN";
      if (!["IN", "NOT_IN"].includes(operator)) {
        return null;
      }

      parsedRules.push({
        ruleType: type as SegmentRuleType,
        operator: operator as SegmentRuleOperator,
        value: raw?.value ?? null,
      });
    }

    const nameValue = body.name;
    if (typeof nameValue !== "string" || !nameValue.trim()) {
      return null;
    }

    return {
      name: nameValue.trim(),
      description:
        typeof body.description === "string" ? body.description : undefined,
      entityType: SegmentEntityType.CONTACT,
      logicOperator: (logicOperator as "AND" | "OR") ?? "AND",
      rules: parsedRules,
    };
  }
}
