import { Request, Response } from "express";
import { LandingPageCampaignStatus, Prisma } from "@prisma/client";
import { prisma } from "@repo/db";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
} from "../utils/error-handler.js";
import { validateFieldLength } from "../utils/validators.js";

const CAMPAIGN_STATUSES = new Set(Object.values(LandingPageCampaignStatus));
const SORT_FIELDS = new Set(["name", "status", "createdAt", "updatedAt"]);

function parseCampaignStatus(value: unknown): LandingPageCampaignStatus | null {
  return typeof value === "string" &&
    CAMPAIGN_STATUSES.has(value as LandingPageCampaignStatus)
    ? (value as LandingPageCampaignStatus)
    : null;
}

function parseId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export class LandingPageCampaignController {
  async getAllCampaigns(req: Request, res: Response) {
    try {
      const {
        page = "1",
        limit = "10",
        search = "",
        status,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const requestedPage = Number(page);
      const requestedLimit = Number(limit);
      const pageNum =
        Number.isSafeInteger(requestedPage) && requestedPage > 0
          ? requestedPage
          : 1;
      const limitNum =
        Number.isSafeInteger(requestedLimit) &&
        requestedLimit >= 1 &&
        requestedLimit <= 100
          ? requestedLimit
          : 10;
      const skip = (pageNum - 1) * limitNum;

      const where: Prisma.LandingPageCampaignWhereInput = {};

      const searchTerm =
        typeof search === "string" ? search.trim().slice(0, 200) : "";
      if (searchTerm) {
        where.OR = [
          {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        ];
      }

      if (status) {
        const parsedStatus = parseCampaignStatus(status);
        if (!parsedStatus) {
          return handleValidationError(
            res,
            "Campaign status is invalid",
            "status",
            "List landing page campaigns"
          );
        }
        where.status = parsedStatus;
      }

      const normalizedSortBy =
        typeof sortBy === "string" && SORT_FIELDS.has(sortBy)
          ? sortBy
          : "createdAt";
      const normalizedSortOrder = sortOrder === "asc" ? "asc" : "desc";

      const [campaigns, total] = await Promise.all([
        prisma.landingPageCampaign.findMany({
          where,
          include: {
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            _count: {
              select: {
                enquiries: true,
              },
            },
          },
          orderBy: {
            [normalizedSortBy]: normalizedSortOrder,
          },
          skip,
          take: limitNum,
        }),
        prisma.landingPageCampaign.count({ where }),
      ]);

      res.json({
        campaigns,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      handleError(error, res, "Get all landing page campaigns");
    }
  }

  async getStats(req: Request, res: Response) {
    try {
      const [
        activeCampaigns,
        nonArchivedCampaigns,
        totalEnquiries,
        unresolvedEnquiries,
      ] = await Promise.all([
        prisma.landingPageCampaign.count({
          where: {
            status: "ACTIVE",
          },
        }),
        prisma.landingPageCampaign.count({
          where: {
            status: {
              not: "ARCHIVED",
            },
          },
        }),
        prisma.enquiry.count(),
        prisma.enquiry.count({
          where: {
            status: "UNRESOLVED",
          },
        }),
      ]);

      res.json({
        activeCampaigns,
        totalCampaigns: nonArchivedCampaigns,
        totalEnquiries,
        unresolvedEnquiries,
      });
    } catch (error) {
      handleError(error, res, "Get landing page campaign stats");
    }
  }

  async createCampaign(req: Request, res: Response) {
    try {
      const { name, description, status } = req.body || {};

      if (
        typeof name !== "string" ||
        !name.trim() ||
        !validateFieldLength(name.trim(), 255)
      ) {
        return handleValidationError(
          res,
          "Campaign name is required and must be 255 characters or less",
          "name",
          "Create landing page campaign"
        );
      }
      if (
        description !== undefined &&
        description !== null &&
        (typeof description !== "string" ||
          !validateFieldLength(description.trim(), 2_000))
      ) {
        return handleValidationError(
          res,
          "Description must be 2000 characters or less",
          "description",
          "Create landing page campaign"
        );
      }
      const normalizedStatus =
        status === undefined
          ? LandingPageCampaignStatus.ACTIVE
          : parseCampaignStatus(status);
      if (!normalizedStatus) {
        return handleValidationError(
          res,
          "Campaign status is invalid",
          "status",
          "Create landing page campaign"
        );
      }

      const campaign = await prisma.landingPageCampaign.create({
        data: {
          name: name.trim(),
          description:
            typeof description === "string" ? description.trim() || null : null,
          status: normalizedStatus,
          createdBy: req.user!.id,
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      res.status(201).json(campaign);
    } catch (error) {
      handleError(error, res, "Create landing page campaign");
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
          "Get landing page campaign by ID"
        );
      }

      const campaign = await prisma.landingPageCampaign.findUnique({
        where: { id },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          enquiries: {
            include: {
              lead: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
            orderBy: {
              enquiryCreatedAt: "desc",
            },
            take: 50,
          },
          _count: {
            select: {
              enquiries: true,
            },
          },
        },
      });

      if (!campaign) {
        return handleNotFoundError(
          res,
          "Landing Page Campaign",
          "Get landing page campaign by ID"
        );
      }

      res.json(campaign);
    } catch (error) {
      handleError(error, res, "Get landing page campaign by ID");
    }
  }

  async getCampaignByUniqueId(req: Request, res: Response) {
    try {
      const { uniqueId } = req.params;
      if (!uniqueId) {
        return handleValidationError(
          res,
          "Campaign unique ID is required",
          "uniqueId",
          "Get landing page campaign by unique ID"
        );
      }

      const campaign = await prisma.landingPageCampaign.findUnique({
        where: { uniqueId },
        select: {
          id: true,
          name: true,
          description: true,
          uniqueId: true,
          status: true,
        },
      });

      if (!campaign) {
        return handleNotFoundError(
          res,
          "Landing Page Campaign",
          "Get landing page campaign by unique ID"
        );
      }

      res.json(campaign);
    } catch (error) {
      handleError(error, res, "Get landing page campaign by unique ID");
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
          "Update landing page campaign"
        );
      }

      const { name, description, status } = req.body || {};
      if ([name, description, status].every(value => value === undefined)) {
        return handleValidationError(
          res,
          "At least one campaign field is required",
          undefined,
          "Update landing page campaign"
        );
      }
      if (
        name !== undefined &&
        (typeof name !== "string" ||
          !name.trim() ||
          !validateFieldLength(name.trim(), 255))
      ) {
        return handleValidationError(
          res,
          "Campaign name must be non-empty and 255 characters or less",
          "name",
          "Update landing page campaign"
        );
      }
      if (
        description !== undefined &&
        description !== null &&
        (typeof description !== "string" ||
          !validateFieldLength(description.trim(), 2_000))
      ) {
        return handleValidationError(
          res,
          "Description must be 2000 characters or less",
          "description",
          "Update landing page campaign"
        );
      }
      const normalizedStatus =
        status === undefined ? undefined : parseCampaignStatus(status);
      if (status !== undefined && !normalizedStatus) {
        return handleValidationError(
          res,
          "Campaign status is invalid",
          "status",
          "Update landing page campaign"
        );
      }

      const data: Prisma.LandingPageCampaignUpdateInput = {};
      if (name !== undefined) data.name = name.trim();
      if (description !== undefined) {
        data.description =
          typeof description === "string" ? description.trim() || null : null;
      }
      if (normalizedStatus) data.status = normalizedStatus;

      const campaign = await prisma.landingPageCampaign.update({
        where: { id },
        data,
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      res.json(campaign);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return handleNotFoundError(
          res,
          "Landing Page Campaign",
          "Update landing page campaign"
        );
      }
      handleError(error, res, "Update landing page campaign");
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
          "Delete landing page campaign"
        );
      }

      await prisma.landingPageCampaign.delete({
        where: { id },
      });

      res.status(204).send();
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return handleNotFoundError(
          res,
          "Landing Page Campaign",
          "Delete landing page campaign"
        );
      }
      handleError(error, res, "Delete landing page campaign");
    }
  }
}
