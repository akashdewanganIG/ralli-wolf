import { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
} from "../utils/errorHandler.js";

export class AnalyticsController {
  async getAllEvents(req: Request, res: Response) {
    try {
      const { campaignId, contactId, leadId, eventType } = req.query;

      const where: any = {};
      if (campaignId) where.campaignId = parseInt(campaignId as string);
      if (contactId) where.contactId = parseInt(contactId as string);
      if (leadId) where.leadId = parseInt(leadId as string);
      if (eventType) where.eventType = eventType;

      const events = await prisma.analyticsEvent.findMany({
        where,
        include: {
          campaign: true,
          contact: true,
          lead: true,
        },
        orderBy: {
          occurredAt: "desc",
        },
      });
      res.json(events);
    } catch (error) {
      handleError(error, res, "Get all analytics events");
    }
  }

  async createEvent(req: Request, res: Response) {
    try {
      const { campaignId, contactId, leadId, eventType, eventData } = req.body;
      const event = await prisma.analyticsEvent.create({
        data: {
          campaignId,
          contactId,
          leadId,
          eventType,
          eventData: eventData || {},
        },
        include: {
          campaign: true,
          contact: true,
          lead: true,
        },
      });
      res.status(201).json(event);
    } catch (error) {
      handleError(error, res, "Create analytics event");
    }
  }

  async getEventById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return handleValidationError(
          res,
          "Event ID is required",
          "id",
          "Get event by ID"
        );
      }
      const event = await prisma.analyticsEvent.findUnique({
        where: { id: parseInt(id) },
        include: {
          campaign: true,
          contact: true,
          lead: true,
        },
      });

      if (!event) {
        return handleNotFoundError(res, "Event", "Get event by ID");
      }

      res.json(event);
    } catch (error) {
      handleError(error, res, "Get event by ID");
    }
  }

  async getEventsByCampaign(req: Request, res: Response) {
    try {
      const { campaignId } = req.params;
      if (!campaignId) {
        return handleValidationError(
          res,
          "Campaign ID is required",
          "campaignId",
          "Get events by campaign"
        );
      }
      const events = await prisma.analyticsEvent.findMany({
        where: { campaignId: parseInt(campaignId) },
        include: {
          contact: true,
          lead: true,
        },
        orderBy: {
          occurredAt: "desc",
        },
      });
      res.json(events);
    } catch (error) {
      handleError(error, res, "Get events by campaign");
    }
  }

  async getEventsByContact(req: Request, res: Response) {
    try {
      const { contactId } = req.params;
      if (!contactId) {
        return handleValidationError(
          res,
          "Contact ID is required",
          "contactId",
          "Get events by contact"
        );
      }
      const events = await prisma.analyticsEvent.findMany({
        where: { contactId: parseInt(contactId) },
        include: {
          campaign: true,
          lead: true,
        },
        orderBy: {
          occurredAt: "desc",
        },
      });
      res.json(events);
    } catch (error) {
      handleError(error, res, "Get events by contact");
    }
  }

  async getEventsByLead(req: Request, res: Response) {
    try {
      const { leadId } = req.params;
      if (!leadId) {
        return handleValidationError(
          res,
          "Lead ID is required",
          "leadId",
          "Get events by lead"
        );
      }
      const events = await prisma.analyticsEvent.findMany({
        where: { leadId: parseInt(leadId) },
        include: {
          campaign: true,
          contact: true,
        },
        orderBy: {
          occurredAt: "desc",
        },
      });
      res.json(events);
    } catch (error) {
      handleError(error, res, "Get events by lead");
    }
  }
}
