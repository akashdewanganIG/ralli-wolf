import { Router } from "express";
import { BrevoController } from "../controllers/brevo.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const brevoController = new BrevoController();

router.post("/webhooks", brevoController.handleWebhook);

router.use(requireAuth, requirePermission("campaigns.manage"));

router.post("/sync-leads", brevoController.syncLeadsToBrevo);

router.get("/campaigns", brevoController.getCampaigns);
router.get("/campaigns/:id", brevoController.getCampaignDetails);
router.put("/campaigns/:id", brevoController.updateCampaign);
router.put("/campaigns/:id/status", brevoController.updateCampaignStatus);
router.delete("/campaigns/:id", brevoController.deleteCampaign);

router.post("/send-campaign", brevoController.sendCampaign);

router.get("/analytics", brevoController.getBrevoAnalytics);

router.get("/test-connection", brevoController.testConnection);

export default router;
