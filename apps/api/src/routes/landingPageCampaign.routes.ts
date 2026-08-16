import { Router } from "express";
import { LandingPageCampaignController } from "../controllers/landingPageCampaign.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { UserRole } from "@prisma/client";

const router = Router();
const landingPageCampaignController = new LandingPageCampaignController();

// All routes require authentication (except public unique ID lookup)
router.use(requireAuth);

// GET /api/landing-page-campaigns/stats - Get campaign stats
router.get(
  "/stats",
  requireRole([UserRole.ADMIN]),
  landingPageCampaignController.getStats
);

// GET /api/landing-page-campaigns - Get all campaigns (paginated, searchable, filterable)
router.get(
  "/",
  requireRole([UserRole.ADMIN]),
  landingPageCampaignController.getAllCampaigns
);

// POST /api/landing-page-campaigns - Create new campaign
router.post(
  "/",
  requireRole([UserRole.ADMIN]),
  landingPageCampaignController.createCampaign
);

// GET /api/landing-page-campaigns/unique/:uniqueId - Get campaign by unique ID (public for forms)
router.get(
  "/unique/:uniqueId",
  landingPageCampaignController.getCampaignByUniqueId
);

// GET /api/landing-page-campaigns/:id - Get campaign by ID
router.get(
  "/:id",
  requireRole([UserRole.ADMIN]),
  landingPageCampaignController.getCampaignById
);

// PUT /api/landing-page-campaigns/:id - Update campaign
router.put(
  "/:id",
  requireRole([UserRole.ADMIN]),
  landingPageCampaignController.updateCampaign
);

// DELETE /api/landing-page-campaigns/:id - Delete campaign
router.delete(
  "/:id",
  requireRole([UserRole.ADMIN]),
  landingPageCampaignController.deleteCampaign
);

export default router;
