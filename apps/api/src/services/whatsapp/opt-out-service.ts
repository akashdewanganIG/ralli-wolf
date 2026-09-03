import { prisma } from "@repo/db";
import { Prisma } from "@prisma/client";
import { normalizeWhatsAppPhone, whatsappPhoneVariants } from "./phone.js";

const WHATSAPP_CHANNEL = "whatsapp";

export class OptOutService {
  async addOptOut(params: {
    phone: string;
    source?: string;
    campaignId?: number;
    reason?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    const normalized = normalizeWhatsAppPhone(params.phone);
    if (!normalized) throw new Error("Invalid phone number");

    return prisma.$transaction(async tx => {
      const optOut = await tx.optOut.upsert({
        where: {
          phone_channel: {
            phone: normalized,
            channel: WHATSAPP_CHANNEL,
          },
        },
        create: {
          phone: normalized,
          channel: WHATSAPP_CHANNEL,
          source: params.source || "manual",
          campaignId: params.campaignId,
          reason: params.reason,
          metadata: params.metadata,
        },
        update: {
          optedOutAt: new Date(),
          source: params.source || "manual",
          campaignId: params.campaignId,
          reason: params.reason,
          metadata: params.metadata,
        },
      });

      await this.syncOptOutToEntities(tx, normalized, true);
      return optOut;
    });
  }

  async removeOptOut(phone: string) {
    const normalized = normalizeWhatsAppPhone(phone);
    if (!normalized) throw new Error("Invalid phone number");

    return prisma.$transaction(async tx => {
      const existingOptOut = await tx.optOut.findUnique({
        where: {
          phone_channel: {
            phone: normalized,
            channel: WHATSAPP_CHANNEL,
          },
        },
      });
      if (!existingOptOut) return null;

      await tx.optOut.delete({ where: { id: existingOptOut.id } });
      await this.syncOptOutToEntities(tx, normalized, false);
      await this.createOptOutRemovalActivity(tx, normalized, existingOptOut);

      return {
        success: true,
        phone: normalized,
        channel: WHATSAPP_CHANNEL,
      };
    });
  }

  private async createOptOutRemovalActivity(
    tx: Prisma.TransactionClient,
    phone: string,
    optOutRecord: { campaignId: number | null } | null
  ) {
    if (!optOutRecord?.campaignId) return;

    const phoneVariants = whatsappPhoneVariants(phone);
    const contact = await tx.contact.findFirst({
      where: { phone: { in: phoneVariants as string[] } },
      select: { id: true },
    });
    const lead = contact
      ? null
      : await tx.lead.findFirst({
          where: { phone: { in: phoneVariants } },
          select: { id: true },
        });
    if (!contact && !lead) return;

    await tx.analyticsEvent.create({
      data: {
        campaignId: optOutRecord.campaignId,
        contactId: contact?.id || null,
        leadId: lead?.id || null,
        eventType: "whatsapp.opt_out_removed",
        eventData: {
          source: "manual_removal",
          reason: "Opt-out was manually removed from the list",
          timestamp: new Date().toISOString(),
          channel: WHATSAPP_CHANNEL,
        },
      },
    });
  }

  async isOptedOut(phone: string): Promise<boolean> {
    const normalized = normalizeWhatsAppPhone(phone);
    if (!normalized) throw new Error("Invalid phone number");

    const optOut = await prisma.optOut.findUnique({
      where: {
        phone_channel: {
          phone: normalized,
          channel: WHATSAPP_CHANNEL,
        },
      },
    });

    return !!optOut;
  }

  async filterOptedOut(phones: string[]) {
    const normalized = [
      ...new Set(
        phones
          .map(normalizeWhatsAppPhone)
          .filter((phone): phone is string => phone !== null)
      ),
    ];

    const optOuts = await prisma.optOut.findMany({
      where: {
        phone: { in: normalized },
        channel: WHATSAPP_CHANNEL,
      },
      select: { phone: true },
    });

    const optedOutSet = new Set(optOuts.map(o => o.phone));

    return {
      allowed: normalized.filter(p => !optedOutSet.has(p)),
      blocked: normalized.filter(p => optedOutSet.has(p)),
      blockedCount: optedOutSet.size,
      allowedCount: normalized.length - optedOutSet.size,
    };
  }

  private async syncOptOutToEntities(
    tx: Prisma.TransactionClient,
    phone: string,
    optedOut: boolean
  ) {
    const phoneVariants = whatsappPhoneVariants(phone);
    if (optedOut) {
      const optedOutAt = new Date();
      await tx.contact.updateMany({
        where: { phone: { in: phoneVariants } },
        data: { whatsappOptOut: true, optOutDate: optedOutAt },
      });
      await tx.lead.updateMany({
        where: { phone: { in: phoneVariants } },
        data: { whatsappOptOut: true, optOutDate: optedOutAt },
      });
      return;
    }

    await tx.contact.updateMany({
      where: { phone: { in: phoneVariants } },
      data: { whatsappOptOut: false },
    });
    await tx.lead.updateMany({
      where: { phone: { in: phoneVariants } },
      data: { whatsappOptOut: false },
    });

    await tx.contact.updateMany({
      where: {
        phone: { in: phoneVariants },
        whatsappOptOut: false,
        smsOptOut: false,
        emailOptOut: false,
      },
      data: { optOutDate: null },
    });
    await tx.lead.updateMany({
      where: {
        phone: { in: phoneVariants },
        whatsappOptOut: false,
        smsOptOut: false,
        emailOptOut: false,
      },
      data: { optOutDate: null },
    });
  }

  async listOptOuts(params: {
    search?: string;
    skip?: number;
    take?: number;
    sortBy?: "optedOutAt" | "phone";
    sortOrder?: "asc" | "desc";
  }) {
    const {
      search,
      skip = 0,
      take = 50,
      sortBy = "optedOutAt",
      sortOrder = "desc",
    } = params;

    const where: Prisma.OptOutWhereInput = { channel: WHATSAPP_CHANNEL };

    if (search) {
      where.phone = {
        contains: search.replace(/[^\d]/g, ""),
      };
    }

    const [optOuts, total] = await Promise.all([
      prisma.optOut.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.optOut.count({ where }),
    ]);

    return {
      data: optOuts,
      pagination: {
        total,
        skip,
        take,
        pages: Math.ceil(total / take),
      },
    };
  }

  async getOptOutStats() {
    const total = await prisma.optOut.count({
      where: { channel: WHATSAPP_CHANNEL },
    });
    return { total };
  }
}
