import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller.js";

const router = Router();
const analyticsController = new AnalyticsController();

// GET /api/analytics/events
router.get("/events", analyticsController.getAllEvents);

// POST /api/analytics/events
router.post("/events", analyticsController.createEvent);

// GET /api/analytics/events/:id
router.get("/events/:id", analyticsController.getEventById);

// GET /api/analytics/events/campaign/:campaignId
router.get(
  "/events/campaign/:campaignId",
  analyticsController.getEventsByCampaign
);

// GET /api/analytics/events/contact/:contactId
router.get(
  "/events/contact/:contactId",
  analyticsController.getEventsByContact
);

// GET /api/analytics/events/lead/:leadId
router.get("/events/lead/:leadId", analyticsController.getEventsByLead);

export default router;
