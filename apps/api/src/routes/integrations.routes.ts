import { Router } from "express";
import { integrationsController } from "../controllers/integrations.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth, requirePermission("integrations.manage"));

router.get("/credentials", integrationsController.getCredentials);
router.put("/credentials", integrationsController.upsertCredential);
router.get("/config", integrationsController.getConfig);
router.put("/config", integrationsController.upsertConfig);

export default router;
