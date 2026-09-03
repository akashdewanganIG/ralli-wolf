import { Router } from "express";
import { CampaignController } from "../controllers/campaigns.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const campaignController = new CampaignController();

router.use(requireAuth, requirePermission("campaigns.view"));

router.get("/", campaignController.getAllCampaigns);

router.post(
  "/",
  requirePermission("campaigns.manage"),
  campaignController.createCampaign
);

router.get("/:id", campaignController.getCampaignById);

router.put(
  "/:id",
  requirePermission("campaigns.manage"),
  campaignController.updateCampaign
);

router.delete(
  "/:id",
  requirePermission("campaigns.manage"),
  campaignController.deleteCampaign
);

export default router;
