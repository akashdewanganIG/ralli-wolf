import { prisma } from "@repo/db";
import { Prisma } from "@prisma/client";

type Channel = "whatsapp" | "sms" | "email";

export class OptOutService {
  /**
   * Normalize phone number to consistent format (e.g., "919876543210")
   */
  private normalizePhone(phone: string): string {
    // Remove all non-digit characters
    let normalized = phone.replace(/[^\d]/g, "");

    // If it's 10 digits, assume Indian number and add 91
    if (normalized.length === 10) {
      normalized = "91" + normalized;
    }

    return normalized;
  }

  /**
   * Add a phone number to the global opt-out list
   */
  async addOptOut(params: {
    phone: string;
    channel: Channel;
    source?: string;
    campaignId?: number;
    reason?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    const normalized = this.normalizePhone(params.phone);

    // Create or update global opt-out record
    const optOut = await prisma.optOut.upsert({
      where: {
        phone_channel: {
          phone: normalized,
          channel: params.channel,
        },
      },
      create: {
        phone: normalized,
        channel: params.channel,
        source: params.source || "manual",
        campaignId: params.campaignId,
        reason: params.reason,
        metadata: params.metadata,
      },
      update: {
        optedOutAt: new Date(), // refresh timestamp if re-opting out
        source: params.source || "manual",
        campaignId: params.campaignId,
        reason: params.reason,
        metadata: params.metadata,
      },
    });

    // Sync opt-out status to any matching contacts/leads
    await this.syncOptOutToEntities(normalized, params.channel, true);

    return optOut;
  }

  /**
   * Remove opt-out (re-subscribe)
   */
  async removeOptOut(phone: string, channel: Channel) {
    const normalized = this.normalizePhone(phone);

    console.log("🔄 Removing opt-out for phone:", normalized);

    // Find the opt-out record before deleting (to get campaign info)
    const existingOptOut = await prisma.optOut.findUnique({
      where: {
        phone_channel: {
          phone: normalized,
          channel: channel,
        },
      },
      include: {
        campaign: {
          select: { id: true, name: true },
        },
      },
    });

    // Remove from global opt-out table
    await prisma.optOut.deleteMany({
      where: {
        phone: normalized,
        channel: channel,
      },
    });

    // Update contacts/leads to allow communication again
    await this.syncOptOutToEntities(normalized, channel, false);

    // Create analytics event for opt-out removal
    await this.createOptOutRemovalActivity(normalized, channel, existingOptOut);

    console.log("✅ Successfully removed opt-out and created activity event");

    return { success: true, phone: normalized, channel };
  }

  /**
   * Create analytics event when opt-out is removed
   */
  private async createOptOutRemovalActivity(
    phone: string,
    channel: Channel,
    optOutRecord: any
  ) {
    try {
      console.log("📊 Creating opt-out removal activity...");

      // Try different phone number formats
      const phoneVariants = [
        phone,
        phone.replace(/^91/, ""), // Without country code
        `91${phone.replace(/^91/, "")}`, // With 91 prefix
        `+91${phone.replace(/^91/, "")}`, // With +91 prefix
      ].filter(Boolean);

      // Find contact first
      const contact = await prisma.contact.findFirst({
        where: { phone: { in: phoneVariants as string[] } },
        select: { id: true, name: true, email: true },
      });

      // If no contact, try to find lead
      let lead = null;
      if (!contact) {
        lead = await prisma.lead.findFirst({
          where: { phone: { in: phoneVariants as string[] } },
          select: { id: true, firstName: true, lastName: true, email: true },
        });
      }

      const userName =
        contact?.name ||
        (lead ? `${lead.firstName} ${lead.lastName || ""}`.trim() : null);

      console.log("👤 Found user for opt-out removal:", {
        contactId: contact?.id,
        leadId: lead?.id,
        name: userName,
      });

      if (contact || lead) {
        // Get or create campaign for activity tracking
        let campaignId: number;

        if (optOutRecord?.campaignId) {
          campaignId = optOutRecord.campaignId;
        } else {
          // Check if we have a system campaign
          let systemCampaign = await prisma.campaign.findFirst({
            where: { name: "System Events" },
            select: { id: true },
          });

          if (!systemCampaign) {
            systemCampaign = await prisma.campaign.create({
              data: {
                name: "System Events",
                description:
                  "System-generated events (opt-outs, unsubscribes, etc.)",
                createdBy: 1,
                startDate: new Date(),
                campaignChannels: {
                  create: {
                    channelType: channel,
                    externalId: "system",
                  },
                },
              },
              select: { id: true },
            });
          }

          campaignId = systemCampaign.id;
        }

        // Create analytics event
        const analyticsEvent = await prisma.analyticsEvent.create({
          data: {
            campaignId,
            contactId: contact?.id || null,
            leadId: lead?.id || null,
            eventType: "whatsapp.opt_out_removed",
            eventData: {
              source: "manual_removal",
              reason: "Opt-out was manually removed from the list",
              phone: phone,
              userName: userName || "Unknown User",
              timestamp: new Date().toISOString(),
              channel: channel,
              previousCampaignName: optOutRecord?.campaign?.name || null,
            },
          },
        });

        console.log("✅ Created opt-out removal analytics event:", {
          id: analyticsEvent.id,
          contactId: contact?.id,
          leadId: lead?.id,
          eventType: analyticsEvent.eventType,
        });
      } else {
        console.log("⚠️  No contact or lead found for phone:", phone);
      }
    } catch (error) {
      console.error("❌ Failed to create opt-out removal activity:", error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Check if a phone number is opted out for a specific channel
   */
  async isOptedOut(phone: string, channel: Channel): Promise<boolean> {
    const normalized = this.normalizePhone(phone);

    const optOut = await prisma.optOut.findUnique({
      where: {
        phone_channel: {
          phone: normalized,
          channel: channel,
        },
      },
    });

    return !!optOut;
  }

  /**
   * Batch check opt-outs for multiple phone numbers
   * Returns lists of allowed and blocked phone numbers
   */
  async filterOptedOut(phones: string[], channel: Channel) {
    const normalized = phones.map(p => this.normalizePhone(p));

    const optOuts = await prisma.optOut.findMany({
      where: {
        phone: { in: normalized },
        channel: channel,
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

  /**
   * Sync opt-out status to Contact/Lead entities by phone number
   */
  private async syncOptOutToEntities(
    phone: string,
    channel: Channel,
    optedOut: boolean
  ) {
    const fieldMap: Record<Channel, string> = {
      whatsapp: "whatsappOptOut",
      sms: "smsOptOut",
      email: "emailOptOut",
    };

    const field = fieldMap[channel];
    const updateData: {
      [key: string]: boolean | Date | null;
    } = {
      [field]: optedOut,
      optOutDate: optedOut ? new Date() : null,
    };

    // Update contacts matching this phone number
    await prisma.contact.updateMany({
      where: {
        phone: phone,
      },
      data: updateData,
    });

    // Update leads matching this phone number
    await prisma.lead.updateMany({
      where: {
        phone: phone,
      },
      data: updateData,
    });
  }

  /**
   * Get all opt-outs with pagination and filtering
   */
  async listOptOuts(params: {
    channel?: string;
    search?: string;
    skip?: number;
    take?: number;
    sortBy?: "optedOutAt" | "phone";
    sortOrder?: "asc" | "desc";
  }) {
    const {
      channel,
      search,
      skip = 0,
      take = 50,
      sortBy = "optedOutAt",
      sortOrder = "desc",
    } = params;

    const where: Prisma.OptOutWhereInput = {};

    if (channel) {
      where.channel = channel;
    }

    if (search) {
      where.phone = {
        contains: search.replace(/[^\d]/g, ""), // Search by normalized phone
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

  /**
   * Get opt-out statistics by channel
   */
  async getOptOutStats() {
    const stats = await prisma.optOut.groupBy({
      by: ["channel"],
      _count: {
        id: true,
      },
    });

    const total = await prisma.optOut.count();

    return {
      total,
      byChannel: stats.map(s => ({
        channel: s.channel,
        count: s._count.id,
      })),
    };
  }

  /**
   * Bulk import opt-outs from a list of phone numbers
   */
  async bulkImportOptOuts(
    phones: string[],
    channel: Channel,
    source: string = "bulk_import"
  ) {
    const normalized = phones.map(p => this.normalizePhone(p));
    const uniquePhones = [...new Set(normalized)];

    const optOuts = await Promise.all(
      uniquePhones.map(phone =>
        this.addOptOut({
          phone,
          channel,
          source,
          reason: "Bulk import",
        })
      )
    );

    return {
      imported: optOuts.length,
      skipped: phones.length - uniquePhones.length,
    };
  }
}
