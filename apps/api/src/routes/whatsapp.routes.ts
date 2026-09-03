import express, { Router } from "express";
import { WhatsappController } from "../controllers/whatsapp.controller.js";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rate-limit.js";

const router = Router();
const controller = new WhatsappController();
const mediaBody = express.json({ limit: "14mb" });
const mediaUploadLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: req => String(req.user?.id || req.ip || ""),
});

router.use(requireAuth, requirePermission("whatsapp.manage"));

router.get("/accounts", (req, res) => controller.listAccounts(req, res));
router.post("/accounts", (req, res) => controller.createAccount(req, res));
router.patch("/accounts/:id", (req, res) => controller.updateAccount(req, res));

router.post("/numbers/sync", (req, res) => controller.syncNumbers(req, res));

router.get("/templates", (req, res) => controller.listTemplates(req, res));
router.post("/templates", (req, res) => controller.createTemplate(req, res));
router.post("/templates/sync", (req, res) =>
  controller.syncTemplates(req, res)
);
router.post(
  "/templates/upload-media",
  mediaUploadLimit,
  mediaBody,
  (req, res) => controller.uploadTemplateMedia(req, res)
);
router.put("/templates/:name", (req, res) =>
  controller.updateTemplate(req, res)
);
router.delete("/templates/:name", (req, res) =>
  controller.deleteTemplate(req, res)
);

router.post(
  "/campaigns/upload-media",
  mediaUploadLimit,
  mediaBody,
  (req, res) => controller.uploadCampaignMedia(req, res)
);
router.get("/campaigns", (req, res) => controller.listCampaigns(req, res));
router.get("/campaigns/:id", (req, res) =>
  controller.getCampaignById(req, res)
);
router.get("/campaigns/:id/config", (req, res) =>
  controller.getCampaignConfig(req, res)
);
router.post("/campaigns", (req, res) => controller.createCampaign(req, res));
router.put("/campaigns/:id", (req, res) => controller.updateCampaign(req, res));
router.post("/campaigns/:id/send", (req, res) =>
  controller.scheduleOrSend(req, res)
);
router.post("/campaigns/:id/schedule", (req, res) =>
  controller.scheduleCampaign(req, res)
);
router.get("/deliveries", (req, res) => controller.listDeliveries(req, res));
router.get("/events", (req, res) => controller.listEvents(req, res));

router.get("/optouts", (req, res) => controller.listOptOuts(req, res));
router.get("/optouts/stats", (req, res) => controller.getOptOutStats(req, res));
router.get("/optouts/check", (req, res) => controller.checkOptOut(req, res));
router.post("/optout", (req, res) => controller.optOut(req, res));
router.delete("/optout", (req, res) => controller.removeOptOut(req, res));

export default router;
