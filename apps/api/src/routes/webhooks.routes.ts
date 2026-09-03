import { Router } from "express";
import { WebhookController } from "../controllers/webhooks.controller.js";
import { WhatsappController } from "../controllers/whatsapp.controller.js";
import {
  rejectWebhookReplay,
  requireWebhookSecret,
} from "../utils/webhook-auth.js";

const router = Router();
const webhookController = new WebhookController();
const whatsappController = new WhatsappController();

router.post(
  "/landingi",
  requireWebhookSecret("LANDINGI_WEBHOOK_SECRET", [
    "x-landingi-signature",
    "x-hub-signature-256",
    "x-signature",
  ]),
  rejectWebhookReplay("landingi"),
  webhookController.handleLandingiWebhook.bind(webhookController)
);

const requireWhatsappWebhook = requireWebhookSecret("WHATSAPP_WEBHOOK_SECRET");

router.post(
  "/msg91/whatsapp",
  requireWhatsappWebhook,
  rejectWebhookReplay("msg91-whatsapp-status"),
  (req, res) => whatsappController.handleWebhook(req, res)
);

router.post(
  "/msg91/whatsapp/inbound",
  requireWhatsappWebhook,
  rejectWebhookReplay("msg91-whatsapp-inbound"),
  (req, res) => whatsappController.handleInboundMessage(req, res)
);

export default router;
