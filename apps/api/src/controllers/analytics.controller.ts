import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { Prisma } from "@prisma/client";
import {
  handleError,
  handleValidationError,
  handleNotFoundError,
} from "../utils/error-handler.js";
import { parsePositiveInteger } from "../utils/validators.js";

const ANALYTICS_EVENT_SELECT = {
  id: true,
  campaignId: true,
  contactId: true,
  leadId: true,
  eventType: true,
  eventData: true,
  occurredAt: true,
} satisfies Prisma.AnalyticsEventSelect;

const MAX_EVENTS_PER_REQUEST = 200;

export class AnalyticsController {
  async getAllEvents(req: Request, res: Response) {
    try {
      const { campaignId, contactId, leadId, eventType } = req.query;

      const where: Prisma.AnalyticsEventWhereInput = {};
      for (const [field, raw] of [
        ["campaignId", campaignId],
        ["contactId", contactId],
        ["leadId", leadId],
      ] as const) {
        if (raw === undefined) continue;
        const id = parsePositiveInteger(raw);
        if (id === null) {
          return handleValidationError(
            res,
            `Invalid ${field}`,
            field,
            "Get all analytics events"
          );
        }
        where[field] = id;
      }
      if (eventType !== undefined) {
        if (
          typeof eventType !== "string" ||
          !eventType.trim() ||
          eventType.trim().length > 80
        ) {
          return handleValidationError(
            res,
            "eventType must be between 1 and 80 characters",
            "eventType",
            "Get all analytics events"
          );
        }
        where.eventType = eventType.trim();
      }

      const events = await prisma.analyticsEvent.findMany({
        where,
        select: ANALYTICS_EVENT_SELECT,
        orderBy: {
          occurredAt: "desc",
        },
        take: MAX_EVENTS_PER_REQUEST,
      });
      res.json(events);
    } catch (error) {
      handleError(error, res, "Get all analytics events");
    }
  }

  async getEventById(req: Request, res: Response) {
    try {
      const id = parsePositiveInteger(req.params.id);
      if (id === null) {
        return handleValidationError(
          res,
          "Event ID is required",
          "id",
          "Get event by ID"
        );
      }
      const event = await prisma.analyticsEvent.findUnique({
        where: { id },
        select: ANALYTICS_EVENT_SELECT,
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
      const campaignId = parsePositiveInteger(req.params.campaignId);
      if (campaignId === null) {
        return handleValidationError(
          res,
          "Campaign ID is required",
          "campaignId",
          "Get events by campaign"
        );
      }
      const events = await prisma.analyticsEvent.findMany({
        where: { campaignId },
        select: ANALYTICS_EVENT_SELECT,
        orderBy: {
          occurredAt: "desc",
        },
        take: MAX_EVENTS_PER_REQUEST,
      });
      res.json(events);
    } catch (error) {
      handleError(error, res, "Get events by campaign");
    }
  }

  async getEventsByContact(req: Request, res: Response) {
    try {
      const contactId = parsePositiveInteger(req.params.contactId);
      if (contactId === null) {
        return handleValidationError(
          res,
          "Contact ID is required",
          "contactId",
          "Get events by contact"
        );
      }
      const events = await prisma.analyticsEvent.findMany({
        where: { contactId },
        select: ANALYTICS_EVENT_SELECT,
        orderBy: {
          occurredAt: "desc",
        },
        take: MAX_EVENTS_PER_REQUEST,
      });
      res.json(events);
    } catch (error) {
      handleError(error, res, "Get events by contact");
    }
  }

  async getEventsByLead(req: Request, res: Response) {
    try {
      const leadId = parsePositiveInteger(req.params.leadId);
      if (leadId === null) {
        return handleValidationError(
          res,
          "Lead ID is required",
          "leadId",
          "Get events by lead"
        );
      }
      const events = await prisma.analyticsEvent.findMany({
        where: { leadId },
        select: ANALYTICS_EVENT_SELECT,
        orderBy: {
          occurredAt: "desc",
        },
        take: MAX_EVENTS_PER_REQUEST,
      });
      res.json(events);
    } catch (error) {
      handleError(error, res, "Get events by lead");
    }
  }
}
