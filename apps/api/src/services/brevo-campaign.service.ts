import { CampaignDeliveryStatus, Prisma } from "@prisma/client";
import { prisma } from "@repo/db";
import type { BrevoCampaign } from "../utils/brevo.types.js";

interface BrevoRecipient {
  leadId: number;
  email: string;
}

export function brevoDeliveryIdempotencyKey(deliveryId: number): string {
  if (!Number.isSafeInteger(deliveryId) || deliveryId <= 0) {
    throw new Error("Delivery ID must be a positive integer");
  }
  const suffix = deliveryId.toString(16).padStart(12, "0");
  if (suffix.length > 12) throw new Error("Delivery ID is too large");
  return `00000000-0000-4000-8000-${suffix}`;
}

export async function ensureLocalBrevoCampaign(
  campaign: BrevoCampaign,
  createdBy: number
): Promise<number> {
  const externalId = String(campaign.id);
  const existing = await prisma.campaignChannel.findUnique({
    where: {
      channelType_externalId: { channelType: "brevo", externalId },
    },
    select: { campaignId: true },
  });
  if (existing) return existing.campaignId;

  const scheduledAt = campaign.scheduledAt
    ? new Date(campaign.scheduledAt)
    : null;
  const startDate =
    scheduledAt && !Number.isNaN(scheduledAt.getTime())
      ? scheduledAt
      : new Date();
  try {
    const local = await prisma.campaign.create({
      data: {
        name: campaign.name.trim().slice(0, 255) || `Brevo ${campaign.id}`,
        description: `Brevo email campaign ${campaign.id}`,
        startDate,
        createdBy,
        campaignChannels: {
          create: { channelType: "brevo", externalId },
        },
      },
      select: { id: true },
    });
    return local.id;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await prisma.campaignChannel.findUnique({
        where: {
          channelType_externalId: { channelType: "brevo", externalId },
        },
        select: { campaignId: true },
      });
      if (raced) return raced.campaignId;
    }
    throw error;
  }
}

export async function prepareBrevoDeliveries(
  campaignId: number,
  recipients: readonly BrevoRecipient[]
) {
  const uniqueByEmail = new Map<string, BrevoRecipient>();
  for (const recipient of recipients) {
    if (!uniqueByEmail.has(recipient.email)) {
      uniqueByEmail.set(recipient.email, recipient);
    }
  }
  const uniqueRecipients = [...uniqueByEmail.values()];
  if (!uniqueRecipients.length) return [];
  await prisma.campaignDelivery.createMany({
    data: uniqueRecipients.map(recipient => ({
      campaignId,
      leadId: recipient.leadId,
      channel: "email",
      address: recipient.email,
      status: CampaignDeliveryStatus.PENDING,
    })),
    skipDuplicates: true,
  });

  const staleBefore = new Date(Date.now() - 30 * 60 * 1_000);
  await prisma.campaignDelivery.updateMany({
    where: {
      campaignId,
      channel: "email",
      address: { in: uniqueRecipients.map(recipient => recipient.email) },
      status: CampaignDeliveryStatus.PROCESSING,
      processingStartedAt: { lte: staleBefore },
    },
    data: {
      status: CampaignDeliveryStatus.FAILED,
      processingStartedAt: null,
      failedAt: new Date(),
      errorCode: "OUTCOME_UNKNOWN",
      errorMessage: "Previous send outcome is unknown; manual review required",
    },
  });

  return prisma.campaignDelivery.findMany({
    where: {
      campaignId,
      channel: "email",
      address: { in: uniqueRecipients.map(recipient => recipient.email) },
    },
    select: {
      id: true,
      leadId: true,
      address: true,
      status: true,
      errorCode: true,
      providerMessageId: true,
    },
    orderBy: { id: "asc" },
  });
}

export async function claimBrevoDelivery(deliveryId: number): Promise<boolean> {
  const now = new Date();
  const claimed = await prisma.campaignDelivery.updateMany({
    where: {
      id: deliveryId,
      status: {
        in: [CampaignDeliveryStatus.PENDING, CampaignDeliveryStatus.FAILED],
      },
      OR: [{ errorCode: null }, { errorCode: { not: "OUTCOME_UNKNOWN" } }],
      attemptCount: { lt: 3 },
    },
    data: {
      status: CampaignDeliveryStatus.PROCESSING,
      processingStartedAt: now,
      lastAttemptAt: now,
      attemptCount: { increment: 1 },
      errorCode: null,
      errorMessage: null,
      failedAt: null,
    },
  });
  return claimed.count === 1;
}

export async function completeBrevoDelivery(
  campaignId: number,
  deliveryId: number,
  leadId: number,
  providerMessageId: string
): Promise<void> {
  await prisma.$transaction(async tx => {
    const completed = await tx.campaignDelivery.updateMany({
      where: {
        id: deliveryId,
        campaignId,
        leadId,
        status: CampaignDeliveryStatus.PROCESSING,
      },
      data: {
        status: CampaignDeliveryStatus.SENT,
        processingStartedAt: null,
        providerMessageId,
        sentAt: new Date(),
      },
    });
    if (completed.count !== 1) {
      throw new Error("Claimed Brevo delivery could not be completed");
    }

    await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${campaignId} FOR UPDATE`;
    const existingMember = await tx.campaignMember.findFirst({
      where: { campaignId, leadId },
      select: { id: true },
    });
    if (existingMember) {
      await tx.campaignMember.update({
        where: { id: existingMember.id },
        data: { status: "sent" },
      });
    } else {
      await tx.campaignMember.create({
        data: { campaignId, leadId, status: "sent" },
      });
    }
  });
}

export async function failBrevoDelivery(
  deliveryId: number,
  outcomeUnknown: boolean
): Promise<void> {
  await prisma.campaignDelivery.updateMany({
    where: { id: deliveryId, status: CampaignDeliveryStatus.PROCESSING },
    data: {
      status: CampaignDeliveryStatus.FAILED,
      processingStartedAt: null,
      failedAt: new Date(),
      errorCode: outcomeUnknown ? "OUTCOME_UNKNOWN" : "PROVIDER_REJECTED",
      errorMessage: outcomeUnknown
        ? "Provider response was uncertain; manual review required"
        : "Provider rejected the email request",
    },
  });
}
