import { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
} from "../utils/errorHandler.js";

export class CampaignController {
  async getAllCampaigns(req: Request, res: Response) {
    try {
      const campaigns = await prisma.campaign.findMany({
        include: {
          creator: {},
          campaignMembers: {
            include: {
              contact: true,
              lead: true,
            },
          },
        },
      });
      res.json(campaigns);
    } catch (error) {
      handleError(error, res, "Get all campaigns");
    }
  }

  async createCampaign(req: Request, res: Response) {
    try {
      const { name, description, startDate, endDate, createdBy } = req.body;
      const campaign = await prisma.campaign.create({
        data: {
          name,
          description,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          createdBy,
        },
        include: {
          creator: {},
        },
      });
      res.status(201).json(campaign);
    } catch (error) {
      handleError(error, res, "Create campaign");
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
          "Get campaign by ID"
        );
      }
      const campaign = await prisma.campaign.findUnique({
        where: { id: parseInt(id) },
        include: {
          creator: {},
          campaignMembers: {
            include: {
              contact: true,
              lead: true,
            },
          },
          analyticsEvents: {
            orderBy: {
              occurredAt: "desc",
            },
          },
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
      const { id } = req.params;
      if (!id) {
        return handleValidationError(
          res,
          "Campaign ID is required",
          "id",
          "Update campaign"
        );
      }
      const updateData = req.body;

      // Handle date conversion if needed
      if (updateData.startDate) {
        updateData.startDate = new Date(updateData.startDate);
      }
      if (updateData.endDate) {
        updateData.endDate = new Date(updateData.endDate);
      }

      const campaign = await prisma.campaign.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          creator: {},
        },
      });

      res.json(campaign);
    } catch (error: any) {
      if (error.code === "P2025") {
        // Record not found
        return handleNotFoundError(res, "Campaign", "Update campaign");
      }
      handleError(error, res, "Update campaign");
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
          "Delete campaign"
        );
      }

      await prisma.campaign.delete({
        where: { id: parseInt(id) },
      });

      res.status(204).send();
    } catch (error: any) {
      if (error.code === "P2025") {
        // Record not found
        return handleNotFoundError(res, "Campaign", "Delete campaign");
      }
      handleError(error, res, "Delete campaign");
    }
  }
}
