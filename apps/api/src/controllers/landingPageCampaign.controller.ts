import { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
} from "../utils/errorHandler.js";

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

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};

      // Search filter
      if (search) {
        where.OR = [
          {
            name: {
              contains: search as string,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: search as string,
              mode: "insensitive",
            },
          },
        ];
      }

      // Status filter
      if (status) {
        where.status = status;
      }

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
            [sortBy as string]: sortOrder,
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
      const { name, description, status, createdBy } = req.body;

      if (!name) {
        return handleValidationError(
          res,
          "Campaign name is required",
          "name",
          "Create landing page campaign"
        );
      }

      const campaign = await prisma.landingPageCampaign.create({
        data: {
          name,
          description,
          status: status || "ACTIVE",
          createdBy,
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
      const { id } = req.params;
      if (!id) {
        return handleValidationError(
          res,
          "Campaign ID is required",
          "id",
          "Get landing page campaign by ID"
        );
      }

      const campaign = await prisma.landingPageCampaign.findUnique({
        where: { id: parseInt(id) },
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
      const { id } = req.params;
      if (!id) {
        return handleValidationError(
          res,
          "Campaign ID is required",
          "id",
          "Update landing page campaign"
        );
      }

      const { name, description, status } = req.body;

      const campaign = await prisma.landingPageCampaign.update({
        where: { id: parseInt(id) },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(status && { status }),
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

      res.json(campaign);
    } catch (error: any) {
      if (error.code === "P2025") {
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
      const { id } = req.params;
      if (!id) {
        return handleValidationError(
          res,
          "Campaign ID is required",
          "id",
          "Delete landing page campaign"
        );
      }

      await prisma.landingPageCampaign.delete({
        where: { id: parseInt(id) },
      });

      res.status(204).send();
    } catch (error: any) {
      if (error.code === "P2025") {
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
