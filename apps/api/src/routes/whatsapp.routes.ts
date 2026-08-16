import { Router } from "express";
import { WhatsappController } from "../controllers/whatsapp.controller.js";

const router = Router();
const controller = new WhatsappController();

// Accounts
router.get("/accounts", (req, res) => controller.listAccounts(req, res));
router.post("/accounts", (req, res) => controller.createAccount(req, res));
router.patch("/accounts/:id", (req, res) => controller.updateAccount(req, res));

// Numbers
router.post("/numbers/sync", (req, res) => controller.syncNumbers(req, res));

// Templates
router.get("/templates", (req, res) => controller.listTemplates(req, res));
router.post("/templates", (req, res) => controller.createTemplate(req, res));
router.post("/templates/sync", (req, res) =>
  controller.syncTemplates(req, res)
);
router.post("/templates/upload-media", (req, res) =>
  controller.uploadTemplateMedia(req, res)
);
router.put("/templates/:name", (req, res) =>
  controller.updateTemplate(req, res)
);
router.delete("/templates/:name", (req, res) =>
  controller.deleteTemplate(req, res)
);

// Campaigns
router.post("/campaigns/upload-media", (req, res) =>
  controller.uploadCampaignMedia(req, res)
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

// Webhook moved to /api/webhook/gupshup (unauthenticated)

// Opt-out management
router.get("/optouts", (req, res) => controller.listOptOuts(req, res));
router.get("/optouts/stats", (req, res) => controller.getOptOutStats(req, res));
router.get("/optouts/check", (req, res) => controller.checkOptOut(req, res));
router.post("/optout", (req, res) => controller.optOut(req, res));
router.delete("/optout", (req, res) => controller.removeOptOut(req, res));

export default router;
