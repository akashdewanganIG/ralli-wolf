import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const analyticsController = new AnalyticsController();

router.use(requireAuth, requirePermission("analytics.view"));

router.get("/events", analyticsController.getAllEvents);

router.get("/events/:id", analyticsController.getEventById);

router.get(
  "/events/campaign/:campaignId",
  analyticsController.getEventsByCampaign
);

router.get(
  "/events/contact/:contactId",
  analyticsController.getEventsByContact
);

router.get("/events/lead/:leadId", analyticsController.getEventsByLead);

export default router;
