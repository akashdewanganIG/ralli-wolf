import { Router } from "express";
import { WebhookController } from "../controllers/webhooks.controller.js";
import { WhatsappController } from "../controllers/whatsapp.controller.js";

const router = Router();
const webhookController = new WebhookController();
const whatsappController = new WhatsappController();

// POST /api/webhook/landingi
router.post(
  "/landingi",
  webhookController.handleLandingiWebhook.bind(webhookController)
);

// GET /api/webhook/landingi/test
router.get(
  "/landingi/test",
  webhookController.testLandingiWebhook.bind(webhookController)
);

// Legacy Gupshup endpoint (still routed through unified handler)
router.post("/gupshup", (req, res) =>
  whatsappController.handleWebhook(req, res)
);

// MSG91 WhatsApp webhook (for delivery status updates)
router.post("/msg91/whatsapp", (req, res) =>
  whatsappController.handleWebhook(req, res)
);

// MSG91 WhatsApp inbound messages webhook (for STOP messages and opt-outs)
router.post("/msg91/whatsapp/inbound", (req, res) =>
  whatsappController.handleInboundMessage(req, res)
);

export default router;
