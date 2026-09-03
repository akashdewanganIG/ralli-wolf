import { Router } from "express";
import { LandingPageCampaignController } from "../controllers/landing-page-campaign.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const landingPageCampaignController = new LandingPageCampaignController();

router.get(
  "/unique/:uniqueId",
  landingPageCampaignController.getCampaignByUniqueId
);

router.use(requireAuth, requirePermission("campaigns.view"));

router.get("/stats", landingPageCampaignController.getStats);

router.get("/", landingPageCampaignController.getAllCampaigns);

router.post(
  "/",
  requirePermission("campaigns.manage"),
  landingPageCampaignController.createCampaign
);

router.get("/:id", landingPageCampaignController.getCampaignById);

router.put(
  "/:id",
  requirePermission("campaigns.manage"),
  landingPageCampaignController.updateCampaign
);

router.delete(
  "/:id",
  requirePermission("campaigns.manage"),
  landingPageCampaignController.deleteCampaign
);

export default router;
