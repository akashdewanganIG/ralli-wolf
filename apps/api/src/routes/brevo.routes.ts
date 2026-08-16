import { Router } from "express";
import { BrevoController } from "../controllers/brevo.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { UserRole } from "@prisma/client";

const router = Router();
const brevoController = new BrevoController();

// All routes except webhooks require authentication/authz
router.use(requireAuth, requireRole([UserRole.ADMIN]));

// Lead sync operations
router.post("/sync-leads", brevoController.syncLeadsToBrevo);

// Campaign operations
router.get("/campaigns", brevoController.getCampaigns);
router.get("/campaigns/active", brevoController.getActiveCampaigns);
router.get("/campaigns/:id", brevoController.getCampaignDetails);
router.put("/campaigns/:id", brevoController.updateCampaign);
router.put("/campaigns/:id/status", brevoController.updateCampaignStatus);
router.delete("/campaigns/:id", brevoController.deleteCampaign);

// Email sending operations
router.post("/send-campaign", brevoController.sendCampaign);

// Analytics operations
router.get("/analytics", brevoController.getBrevoAnalytics);

// Connection test
router.get("/test-connection", brevoController.testConnection);

// Webhook endpoint (no authentication required)
router.post("/webhooks", brevoController.handleWebhook);

export default router;
