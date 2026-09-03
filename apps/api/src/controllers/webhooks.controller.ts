import type { Request, Response } from "express";
import { handleError } from "../utils/error-handler.js";
import {
  ingestLandingiPayload,
  LandingiPayloadError,
} from "../services/landingi.service.js";

export class WebhookController {
  async handleLandingiWebhook(
    req: Request,
    res: Response
  ): Promise<Response | void> {
    try {
      const result = await ingestLandingiPayload(req.body);
      return res.status(200).json({
        success: true,
        message: "Webhook received and processed",
        processedAt: new Date().toISOString(),
        receivedKeys: result.receivedKeys,
        leadCreated: result.leadCreated,
        leadId: result.leadId,
        enquiryId: result.enquiryId,
        formSubmissionCreated: true,
        formSubmissionId: result.formSubmissionId,
      });
    } catch (error) {
      if (error instanceof LandingiPayloadError) {
        return res.status(400).json({
          error: error.message,
          code: "INVALID_WEBHOOK_PAYLOAD",
        });
      }
      handleError(error, res, "Process Landingi webhook");
    }
  }
}
