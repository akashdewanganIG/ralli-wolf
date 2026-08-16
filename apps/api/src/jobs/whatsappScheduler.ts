import { prisma } from "@repo/db";
import { CampaignDeliveryStatus } from "@prisma/client";
import { WhatsappSendService } from "../services/whatsapp/SendService.js";

const sendService = new WhatsappSendService();

// Run every minute from the server bootstrap using setInterval.
// This keeps logic simple without adding extra dependencies like node-cron.
export async function processScheduledWhatsappCampaigns() {
  const now = new Date();

  try {
    // Find WhatsApp configs that are scheduled at or before "now"
    // and still have pending deliveries. We limit how many we process
    // in a single run to avoid overloading the system.
    const dueConfigs = await prisma.whatsAppCampaignConfig.findMany({
      where: {
        scheduledAt: {
          lte: now,
        },
      },
      include: {
        campaign: true,
      },
      take: 20,
    });

    if (!dueConfigs.length) {
      return;
    }

    console.log(
      `🕒 Found ${dueConfigs.length} scheduled WhatsApp campaign(s) due for sending`
    );

    for (const config of dueConfigs) {
      try {
        // Double-check there are still pending deliveries for this campaign.
        const pendingCount = await prisma.campaignDelivery.count({
          where: {
            campaignId: config.campaignId,
            status: CampaignDeliveryStatus.PENDING,
          },
        });

        if (!pendingCount) {
          // Nothing to send; clear scheduledAt so we don't re-process.
          await prisma.whatsAppCampaignConfig.update({
            where: { campaignId: config.campaignId },
            data: { scheduledAt: null },
          });
          continue;
        }

        console.log(
          `📨 Processing scheduled WhatsApp campaign ${config.campaignId} (pending deliveries: ${pendingCount})`
        );

        await sendService.sendCampaign(config.campaignId);

        // Clear scheduledAt after triggering send so it doesn't run again.
        await prisma.whatsAppCampaignConfig.update({
          where: { campaignId: config.campaignId },
          data: { scheduledAt: null },
        });
      } catch (err) {
        console.error(
          `❌ Failed to process scheduled WhatsApp campaign ${config.campaignId}:`,
          err
        );
      }
    }
  } catch (error) {
    console.error(
      "❌ Error while scanning scheduled WhatsApp campaigns:",
      error
    );
  }
}
