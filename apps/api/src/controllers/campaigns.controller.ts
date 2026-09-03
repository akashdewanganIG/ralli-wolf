import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "@repo/db";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
} from "../utils/error-handler.js";
import { validateFieldLength } from "../utils/validators.js";

const CREATOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
} as const;

function parseId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateText(
  res: Response,
  value: unknown,
  field: "name" | "description",
  required: boolean
): string | null | false {
  if (value === undefined && !required) return null;
  if (typeof value !== "string" || (required && !value.trim())) {
    handleValidationError(
      res,
      required ? "Campaign name is required" : "Description must be text",
      field,
      "Campaign"
    );
    return false;
  }
  const normalized = value.trim();
  const maxLength = field === "name" ? 255 : 2_000;
  if (!validateFieldLength(normalized, maxLength)) {
    handleValidationError(
      res,
      `${field === "name" ? "Campaign name" : "Description"} must be ${maxLength} characters or less`,
      field,
      "Campaign"
    );
    return false;
  }
  return normalized || null;
}

export class CampaignController {
  async getAllCampaigns(_req: Request, res: Response) {
    try {
      const campaigns = await prisma.campaign.findMany({
        include: {
          creator: { select: CREATOR_SELECT },
          campaignMembers: {
            include: {
              contact: true,
              lead: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      res.json(campaigns);
    } catch (error) {
      handleError(error, res, "Get all campaigns");
    }
  }

  async createCampaign(req: Request, res: Response) {
    try {
      const name = validateText(res, req.body?.name, "name", true);
      if (name === false || name === null) return;
      const description = validateText(
        res,
        req.body?.description,
        "description",
        false
      );
      if (description === false) return;

      const startDate = parseDate(req.body?.startDate);
      if (!startDate) {
        return handleValidationError(
          res,
          "A valid start date is required",
          "startDate",
          "Create campaign"
        );
      }
      const hasEndDate =
        req.body?.endDate !== undefined &&
        req.body.endDate !== null &&
        req.body.endDate !== "";
      const endDate = hasEndDate ? parseDate(req.body.endDate) : null;
      if (hasEndDate && !endDate) {
        return handleValidationError(
          res,
          "End date must be a valid date",
          "endDate",
          "Create campaign"
        );
      }
      if (endDate && endDate < startDate) {
        return handleValidationError(
          res,
          "End date cannot be before the start date",
          "endDate",
          "Create campaign"
        );
      }

      const campaign = await prisma.campaign.create({
        data: {
          name,
          description,
          startDate,
          endDate,
          createdBy: req.user!.id,
        },
        include: { creator: { select: CREATOR_SELECT } },
      });
      res.status(201).json(campaign);
    } catch (error) {
      handleError(error, res, "Create campaign");
    }
  }

  async getCampaignById(req: Request, res: Response) {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return handleValidationError(
          res,
          "Campaign ID is invalid",
          "id",
          "Get campaign by ID"
        );
      }
      const campaign = await prisma.campaign.findUnique({
        where: { id },
        include: {
          creator: { select: CREATOR_SELECT },
          campaignMembers: {
            include: {
              contact: true,
              lead: true,
            },
          },
          analyticsEvents: { orderBy: { occurredAt: "desc" } },
        },
      });

      if (!campaign) {
        return handleNotFoundError(res, "Campaign", "Get campaign by ID");
      }

      res.json(campaign);
    } catch (error) {
      handleError(error, res, "Get campaign by ID");
    }
  }

  async updateCampaign(req: Request, res: Response) {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return handleValidationError(
          res,
          "Campaign ID is invalid",
          "id",
          "Update campaign"
        );
      }

      const body = req.body || {};
      const supported = ["name", "description", "startDate", "endDate"];
      if (!supported.some(field => body[field] !== undefined)) {
        return handleValidationError(
          res,
          "At least one campaign field is required",
          undefined,
          "Update campaign"
        );
      }

      const data: Prisma.CampaignUpdateInput = {};
      if (body.name !== undefined) {
        const name = validateText(res, body.name, "name", true);
        if (name === false || name === null) return;
        data.name = name;
      }
      if (body.description !== undefined) {
        const description = validateText(
          res,
          body.description,
          "description",
          false
        );
        if (description === false) return;
        data.description = description;
      }
      if (body.startDate !== undefined) {
        const startDate = parseDate(body.startDate);
        if (!startDate) {
          return handleValidationError(
            res,
            "Start date must be a valid date",
            "startDate",
            "Update campaign"
          );
        }
        data.startDate = startDate;
      }
      if (body.endDate !== undefined) {
        if (body.endDate === null || body.endDate === "") {
          data.endDate = null;
        } else {
          const endDate = parseDate(body.endDate);
          if (!endDate) {
            return handleValidationError(
              res,
              "End date must be a valid date",
              "endDate",
              "Update campaign"
            );
          }
          data.endDate = endDate;
        }
      }

      const current = await prisma.campaign.findUnique({
        where: { id },
        select: { startDate: true, endDate: true },
      });
      if (!current) {
        return handleNotFoundError(res, "Campaign", "Update campaign");
      }
      const resultingStart =
        data.startDate instanceof Date ? data.startDate : current.startDate;
      const resultingEnd =
        data.endDate === undefined
          ? current.endDate
          : data.endDate instanceof Date
            ? data.endDate
            : null;
      if (resultingEnd && resultingEnd < resultingStart) {
        return handleValidationError(
          res,
          "End date cannot be before the start date",
          "endDate",
          "Update campaign"
        );
      }

      const campaign = await prisma.campaign.update({
        where: { id },
        data,
        include: { creator: { select: CREATOR_SELECT } },
      });

      res.json(campaign);
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2025"
      ) {
        return handleNotFoundError(res, "Campaign", "Update campaign");
      }
      handleError(error, res, "Update campaign");
    }
  }

  async deleteCampaign(req: Request, res: Response) {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return handleValidationError(
          res,
          "Campaign ID is invalid",
          "id",
          "Delete campaign"
        );
      }

      await prisma.campaign.delete({ where: { id } });
      res.status(204).send();
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2025"
      ) {
        return handleNotFoundError(res, "Campaign", "Delete campaign");
      }
      handleError(error, res, "Delete campaign");
    }
  }
}
