import { Router } from "express";
import { CampaignController } from "../controllers/campaigns.controller.js";

const router = Router();
const campaignController = new CampaignController();

// GET /api/campaigns
router.get("/", campaignController.getAllCampaigns);

// POST /api/campaigns
router.post("/", campaignController.createCampaign);

// GET /api/campaigns/:id
router.get("/:id", campaignController.getCampaignById);

// PUT /api/campaigns/:id
router.put("/:id", campaignController.updateCampaign);

// DELETE /api/campaigns/:id
router.delete("/:id", campaignController.deleteCampaign);

export default router;
