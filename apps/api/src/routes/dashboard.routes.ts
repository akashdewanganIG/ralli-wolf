import { Router } from "express";
import { DashboardController } from "../controllers/dashboard.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();
const dashboardController = new DashboardController();

router.use(requireAuth, requirePermission("analytics.view"));

router.get("/leads-generated", dashboardController.getLeadsGeneratedOverTime);

router.get("/conversion-rate", dashboardController.getConversionRate);

router.get("/lead-sources", dashboardController.getLeadSources);

router.get("/key-metrics", dashboardController.getKeyMetrics);

export default router;
