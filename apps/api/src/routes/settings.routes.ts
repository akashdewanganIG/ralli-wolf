import { Router } from "express";
import {
  getGlobalSettings,
  updateGlobalSetting,
  getCurrencies,
} from "../controllers/settings.controller.js";
import { requireRole } from "../middleware/auth.middleware.js";
import { UserRole } from "@prisma/client";

const router = Router();

// GET - any authenticated user can read settings (used by frontend for threshold checks)
router.get("/global-settings", getGlobalSettings);

// PUT - only an admin can modify settings
router.put(
  "/global-settings",
  requireRole([UserRole.ADMIN]),
  updateGlobalSetting
);

router.get("/currencies", getCurrencies);

export default router;
