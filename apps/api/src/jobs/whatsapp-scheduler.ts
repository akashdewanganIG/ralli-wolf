import { prisma } from "@repo/db";
import { WhatsappSendService } from "../services/whatsapp/send-service.js";
import { runWithSchedulerLease } from "./scheduler-lease.js";
import { logError, logInfo } from "../utils/logger.js";

const WHATSAPP_SCHEDULER_INTERVAL_MS = 60_000;

const sendService = new WhatsappSendService();

export async function processScheduledWhatsappCampaigns() {
  const now = new Date();

  try {
    const dueConfigs = await prisma.whatsAppCampaignConfig.findMany({
      where: {
        scheduledAt: {
          lte: now,
        },
      },
      select: { campaignId: true },
      orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
      take: 20,
    });

    if (!dueConfigs.length) {
      return;
    }

    logInfo("whatsapp_scheduled_campaigns_due", {
      campaignCount: dueConfigs.length,
    });

    for (const config of dueConfigs) {
      try {
        await sendService.sendCampaign(config.campaignId);
      } catch (err) {
        await prisma.whatsAppCampaignConfig.updateMany({
          where: {
            campaignId: config.campaignId,
            scheduledAt: { lte: now },
          },
          data: { scheduledAt: new Date(Date.now() + 15 * 60_000) },
        });
        logError("whatsapp_scheduled_campaign_failed", err, {
          campaignId: config.campaignId,
        });
      }
    }
  } catch (error) {
    logError("whatsapp_schedule_scan_failed", error);
  }
}

export function startWhatsappScheduler(): NodeJS.Timeout {
  const run = () =>
    runWithSchedulerLease(
      "whatsapp-campaigns",
      Math.max(WHATSAPP_SCHEDULER_INTERVAL_MS * 2, 10 * 60_000),
      processScheduledWhatsappCampaigns
    ).catch(error => logError("whatsapp_scheduler_lease_failed", error));
  void run();
  const timer = setInterval(() => void run(), WHATSAPP_SCHEDULER_INTERVAL_MS);
  timer.unref();
  logInfo("whatsapp_scheduler_started", {
    intervalMs: WHATSAPP_SCHEDULER_INTERVAL_MS,
  });
  return timer;
}
