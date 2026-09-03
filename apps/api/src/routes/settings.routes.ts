import { Router } from "express";
import {
  getGlobalSettings,
  updateGlobalSetting,
  getCurrencies,
} from "../controllers/settings.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/global-settings", getGlobalSettings);

router.put(
  "/global-settings",
  requirePermission("settings.manage"),
  updateGlobalSetting
);

router.get("/currencies", getCurrencies);

export default router;
