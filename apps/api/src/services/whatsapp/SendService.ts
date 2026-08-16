import { prisma } from "@repo/db";
import { CampaignDeliveryStatus, Prisma } from "@prisma/client";
import { WhatsappAccountService } from "./AccountService.js";
import { WhatsappTemplateService } from "./TemplateService.js";
import { SegmentService } from "../segment.service.js";
import { getMsg91Credentials } from "../../utils/integration.utils.js";
import { Msg91Client } from "./Msg91Client.js";
import { OptOutService } from "./OptOutService.js";

type AudienceType = "all" | "segment" | "upload";

type ContactRecord = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  countryCode: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  position: string | null;
};

type CsvContactRecord = Record<string, string>;

type DeliveryWithContact = Prisma.CampaignDeliveryGetPayload<{
  include: {
    contact: {
      select: {
        id: true;
        name: true;
        email: true;
        phone: true;
        countryCode: true;
        city: true;
        state: true;
        pincode: true;
        position: true;
      };
    };
  };
}> & {
  csvData?: Record<string, string> | null;
};

export interface CreateCampaignInput {
  name: string;
  description?: string;
  accountId: number;
  templateName: string;
  language?: string;
  messageParams?: Record<string, unknown>;
  audience: AudienceType;
  segmentId?: number;
  csvContacts?: CsvContactRecord[];
  phoneColumnName?: string;
  createdBy: number;
  isDraft?: boolean;
  batchSize?: number;
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  templateName?: string;
  language?: string;
  messageParams?: Record<string, unknown>;
  audience?: AudienceType;
  segmentId?: number | null;
  batchSize?: number;
}

export class WhatsappSendService {
  private accountService: WhatsappAccountService;

  private templateService: WhatsappTemplateService;

  private segmentService: SegmentService;

  constructor() {
    this.accountService = new WhatsappAccountService();
    this.templateService = new WhatsappTemplateService();
    this.segmentService = new SegmentService();
  }

  async createCampaign(input: CreateCampaignInput) {
    const account = await this.accountService.getAccountOrThrow(
      input.accountId
    );
    const template = await this.templateService.findTemplateByName(
      account.id,
      input.templateName
    );
    if (!template) {
      throw new Error("Template not found. Please sync templates first.");
    }

    const isDraft = input.isDraft === true;

    // For draft campaigns, we only persist configuration and skip generating deliveries.
    // This keeps deliveryStats.total === 0 so the UI can treat them as "Draft". We still
    // set a startDate on the core Campaign record to satisfy the schema.
    let contacts: ContactRecord[] = [];
    let csvContactsData: CsvContactRecord[] = [];

    if (!isDraft) {
      if (input.audience === "upload") {
        if (!input.csvContacts || !input.csvContacts.length) {
          throw new Error("CSV contacts data is required for upload audience");
        }
        if (!input.phoneColumnName) {
          throw new Error("Phone column name is required for upload audience");
        }
        csvContactsData = input.csvContacts;
      } else {
        contacts = await this.resolveContacts(input.audience, input.segmentId);
        if (!contacts.length) {
          throw new Error("No contacts matched the selected audience");
        }
      }
    }

    const now = new Date();

    const campaign = await prisma.campaign.create({
      data: {
        name: input.name,
        description: input.description,
        createdBy: input.createdBy,
        startDate: now,
        campaignChannels: {
          create: {
            channelType: "whatsapp",
            externalId: `msg91:${account.id}`,
          },
        },
      },
    });

    // Validate and set batch size (max 800, default 100, min 1)
    let batchSize = input.batchSize ?? 100;
    if (batchSize < 1) {
      batchSize = 1;
    } else if (batchSize > 800) {
      throw new Error("Batch size cannot exceed 800 recipients");
    }

    await prisma.whatsAppCampaignConfig.create({
      data: {
        campaignId: campaign.id,
        whatsappNumberId: account.id,
        templateId: template.id,
        segmentId: input.segmentId || null,
        language: input.language || template.language || "en",
        messageParams: (input.messageParams || {}) as Prisma.InputJsonValue,
        batchSize,
      },
    });

    let totalRecipients = 0;

    if (!isDraft) {
      let deliveriesData: Array<{
        campaignId: number;
        contactId?: number | null;
        channel: string;
        address: string;
        whatsappNumberId: number;
        segmentId?: number | null;
        status: CampaignDeliveryStatus;
        csvData?: Prisma.InputJsonValue;
      }> = [];

      if (input.audience === "upload" && csvContactsData.length > 0) {
        // Handle CSV contacts with opt-out filtering
        const optOutService = new OptOutService();

        // Extract and normalize all phone numbers from CSV
        const allPhones = csvContactsData
          .map(csvContact => csvContact[input.phoneColumnName!])
          .filter((phone): phone is string => Boolean(phone));

        // Check which phone numbers are opted out
        const { allowed: allowedPhones, blockedCount } =
          await optOutService.filterOptedOut(allPhones, "whatsapp");

        if (blockedCount > 0) {
          console.log(
            `⚠️  Filtered out ${blockedCount} opted-out numbers from CSV upload`
          );
        }

        const allowedPhoneSet = new Set(allowedPhones);

        deliveriesData = csvContactsData
          .map(csvContact => {
            const phone = csvContact[input.phoneColumnName!];
            const normalized = this.normalizePhone(phone || "");

            // Skip if phone is invalid or opted out
            if (!normalized || !allowedPhoneSet.has(normalized)) return null;

            return {
              campaignId: campaign.id,
              contactId: null, // CSV contacts are not saved in the system
              channel: "whatsapp",
              address: normalized,
              whatsappNumberId: account.id,
              segmentId: null,
              status: CampaignDeliveryStatus.PENDING,
              csvData: csvContact as Prisma.InputJsonValue,
            };
          })
          .filter((record): record is NonNullable<typeof record> =>
            Boolean(record)
          );
      } else {
        // Handle database contacts
        deliveriesData = contacts
          .map(contact => {
            const normalized = this.normalizePhone(contact.phone || "");
            if (!normalized) return null;
            return {
              campaignId: campaign.id,
              contactId: contact.id,
              channel: "whatsapp",
              address: normalized,
              whatsappNumberId: account.id,
              segmentId: input.segmentId || null,
              status: CampaignDeliveryStatus.PENDING,
            };
          })
          .filter((record): record is NonNullable<typeof record> =>
            Boolean(record)
          );
      }

      if (!deliveriesData.length) {
        throw new Error(
          "None of the selected contacts have a valid phone number"
        );
      }

      await prisma.campaignDelivery.createMany({
        data: deliveriesData,
      });

      totalRecipients = deliveriesData.length;
    }

    return {
      campaign,
      totalRecipients,
    };
  }

  async getCampaignConfig(campaignId: number) {
    const config = await prisma.whatsAppCampaignConfig.findUnique({
      where: { campaignId },
      include: {
        campaign: true,
        whatsappNumber: true,
        template: true,
        segment: true,
      },
    });

    if (!config) {
      return null;
    }

    return {
      id: config.campaign.id,
      name: config.campaign.name,
      description: config.campaign.description,
      accountId: config.whatsappNumberId,
      templateName: config.template.name,
      language: config.language || config.template.language,
      messageParams: config.messageParams,
      audience: config.segmentId ? "segment" : "all",
      segmentId: config.segmentId,
      scheduledAt: config.scheduledAt,
      batchSize: config.batchSize,
    };
  }

  async updateCampaign(campaignId: number, input: UpdateCampaignInput) {
    const config = await prisma.whatsAppCampaignConfig.findUnique({
      where: { campaignId },
      include: {
        campaign: true,
        whatsappNumber: true,
        template: true,
      },
    });

    if (!config) {
      throw new Error("Campaign configuration not found");
    }

    // Check if campaign can be edited (only draft/pending campaigns)
    const deliveryStats = await prisma.campaignDelivery.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: { status: true },
    });

    const hasBeenSent = deliveryStats.some(
      s =>
        s.status === CampaignDeliveryStatus.SENT ||
        s.status === CampaignDeliveryStatus.DELIVERED ||
        s.status === CampaignDeliveryStatus.READ ||
        s.status === CampaignDeliveryStatus.QUEUED
    );

    if (hasBeenSent) {
      throw new Error("Cannot edit a campaign that has already been sent");
    }

    // Update campaign name/description if provided
    if (input.name || input.description !== undefined) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
        },
      });
    }

    // Update WhatsApp config if template or params changed
    const configUpdates: Record<string, unknown> = {};

    if (input.templateName && input.templateName !== config.template?.name) {
      const template = await this.templateService.findTemplateByName(
        config.whatsappNumberId,
        input.templateName
      );
      if (!template) {
        throw new Error("Template not found");
      }
      configUpdates.templateId = template.id;
    }

    if (input.language) {
      configUpdates.language = input.language;
    }

    if (input.messageParams) {
      configUpdates.messageParams =
        input.messageParams as Prisma.InputJsonValue;
    }

    if (input.segmentId !== undefined) {
      configUpdates.segmentId = input.segmentId;
    }

    if (input.batchSize !== undefined) {
      // Validate batch size (max 800, min 1)
      let batchSize = input.batchSize;
      if (batchSize < 1) {
        batchSize = 1;
      } else if (batchSize > 800) {
        throw new Error("Batch size cannot exceed 800 recipients");
      }
      configUpdates.batchSize = batchSize;
    }

    if (Object.keys(configUpdates).length > 0) {
      await prisma.whatsAppCampaignConfig.update({
        where: { campaignId },
        data: configUpdates,
      });
    }

    // If audience changed, we need to update deliveries
    if (input.audience !== undefined || input.segmentId !== undefined) {
      const contacts = await this.resolveContacts(
        input.audience || (config.segmentId ? "segment" : "all"),
        input.segmentId ?? config.segmentId ?? undefined
      );

      // Delete existing pending deliveries
      await prisma.campaignDelivery.deleteMany({
        where: {
          campaignId,
          status: CampaignDeliveryStatus.PENDING,
        },
      });

      // Create new deliveries
      const deliveriesData = contacts
        .map(contact => {
          const normalized = this.normalizePhone(contact.phone || "");
          if (!normalized) return null;
          return {
            campaignId,
            contactId: contact.id,
            channel: "whatsapp",
            address: normalized,
            whatsappNumberId: config.whatsappNumberId,
            segmentId: input.segmentId ?? config.segmentId ?? null,
            status: CampaignDeliveryStatus.PENDING,
          };
        })
        .filter((record): record is NonNullable<typeof record> =>
          Boolean(record)
        );

      if (deliveriesData.length > 0) {
        await prisma.campaignDelivery.createMany({
          data: deliveriesData,
        });
      }
    }

    return this.getCampaignById(campaignId);
  }

  async sendCampaign(campaignId: number) {
    const config = await prisma.whatsAppCampaignConfig.findUnique({
      where: { campaignId },
      include: {
        campaign: true,
        whatsappNumber: true,
        template: true,
      },
    });

    if (!config) {
      throw new Error("Campaign configuration not found");
    }

    const account = await this.accountService.getAccountOrThrow(
      config.whatsappNumberId
    );

    // Get MSG91 credentials from integration config
    const credentials = await getMsg91Credentials();
    const client = new Msg91Client({
      apiKey: credentials.apiKey,
      baseUrl: credentials.baseUrl,
    });
    const integratedNumber = account.phoneNumber;

    if (!integratedNumber) {
      throw new Error(
        "WhatsApp account is missing the integrated phone number"
      );
    }

    const rawDeliveries = await prisma.campaignDelivery.findMany({
      where: {
        campaignId,
        status: {
          in: [CampaignDeliveryStatus.PENDING, CampaignDeliveryStatus.FAILED],
        },
      },
      include: {
        contact: true,
      },
      orderBy: { id: "asc" },
      take: 200,
    });

    let deliveries: DeliveryWithContact[] = rawDeliveries.map(delivery => ({
      ...delivery,
      csvData: delivery.csvData
        ? (delivery.csvData as Record<string, string>)
        : null,
    }));

    if (!deliveries.length) {
      return { queued: 0, message: "No pending deliveries" };
    }

    // Re-check opt-out status before sending (to catch users who opted out after campaign creation)
    const optOutService = new OptOutService();
    const allPhones = deliveries.map(d => d.address);
    const { allowed: allowedPhones, blockedCount } =
      await optOutService.filterOptedOut(allPhones, "whatsapp");

    if (blockedCount > 0) {
      console.log(
        `⚠️  Found ${blockedCount} opted-out numbers at send time. Marking as OPTED_OUT.`
      );

      // Get blocked phone numbers
      const allowedPhoneSet = new Set(allowedPhones);
      const blockedDeliveries = deliveries.filter(
        d => !allowedPhoneSet.has(d.address)
      );

      // Update blocked deliveries to OPTED_OUT status
      if (blockedDeliveries.length > 0) {
        await prisma.campaignDelivery.updateMany({
          where: { id: { in: blockedDeliveries.map(d => d.id) } },
          data: {
            status: CampaignDeliveryStatus.OPTED_OUT,
            failedAt: new Date(),
            errorMessage: "User opted out before campaign was sent",
          },
        });

        // Log analytics events for opted-out deliveries
        await Promise.all(
          blockedDeliveries.map(delivery =>
            prisma.analyticsEvent.create({
              data: {
                campaignId: delivery.campaignId,
                contactId: delivery.contactId,
                leadId: delivery.leadId,
                eventType: "whatsapp.opted_out",
                eventData: {
                  reason: "User opted out before campaign was sent",
                  address: delivery.address,
                  timestamp: new Date().toISOString(),
                },
              },
            })
          )
        );
      }

      // Filter out blocked deliveries from sending
      deliveries = deliveries.filter(d => allowedPhoneSet.has(d.address));
    }

    if (!deliveries.length) {
      return {
        queued: 0,
        message: "All deliveries were opted out",
        blockedCount,
      };
    }

    // Use configured batch size from campaign config (default 100, max 800)
    const batchSize = config.batchSize || 100;
    const batches = this.chunk(deliveries, batchSize);
    let queued = 0;

    const templateLanguage =
      config.language || config.template.language || "en";

    // Extract namespace from template components data
    // Try multiple possible locations for namespace
    const templateComponents = config.template.components as Record<
      string,
      unknown
    > | null;
    const templateComponentsJson = (config.template as Record<string, unknown>)
      ?.componentsJson as Record<string, unknown> | undefined;
    let templateNamespace = templateComponents?.namespace as string | undefined;

    // Also check componentsJson
    if (!templateNamespace && templateComponentsJson) {
      templateNamespace = templateComponentsJson?.namespace as
        | string
        | undefined;
    }

    // Validation before sending
    if (!config.template.name) {
      throw new Error("Template name is missing");
    }

    if (!integratedNumber) {
      throw new Error("Integrated number is missing");
    }

    // Log warning if namespace is missing (MSG91 might require it)
    if (!templateNamespace) {
      console.warn(
        "⚠️  WARNING: Template namespace is missing. This might cause MSG91 API to reject the request."
      );
      console.warn(
        "Template components:",
        JSON.stringify(config.template.components, null, 2)
      );
      console.warn(
        "Template componentsJson:",
        JSON.stringify(templateComponentsJson, null, 2)
      );
    }

    console.log("=== Campaign Send Debug ===");
    console.log("Campaign ID:", campaignId);
    console.log("Campaign Name:", config.campaign.name);
    console.log("Template name:", config.template.name);
    console.log("Template language:", templateLanguage);
    console.log("Template namespace:", templateNamespace);
    console.log("Integrated Number:", integratedNumber);
    console.log("Total deliveries to send:", deliveries.length);
    console.log("Number of batches:", batches.length);
    console.log(
      "Message params:",
      JSON.stringify(config.messageParams, null, 2)
    );

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch || batch.length === 0) {
        console.warn(`Skipping empty batch ${i + 1}/${batches.length}`);
        continue;
      }
      console.log(
        `\n=== Processing Batch ${i + 1}/${batches.length} (${batch.length} recipients) ===`
      );

      try {
        const recipients = batch.map(delivery => {
          // Get CSV data if available
          const csvData = delivery.csvData
            ? (delivery.csvData as Record<string, string>)
            : undefined;

          const variables = this.renderVariables(
            (config.messageParams as Record<string, unknown>) || {},
            delivery.contact,
            csvData
          );
          this.applyTemplateSpecificVariables(
            variables,
            config.template.category
          );
          console.log(
            `Recipient ${delivery.address}:`,
            JSON.stringify(variables, null, 2)
          );
          return {
            phone: delivery.address,
            variables,
          };
        });

        console.log(
          "Sending to MSG91 with payload:",
          JSON.stringify(
            {
              templateName: config.template.name,
              templateLanguage,
              templateNamespace,
              sender: integratedNumber,
              campaignName: config.campaign.name,
              recipientCount: recipients.length,
            },
            null,
            2
          )
        );

        const response = await client.sendTemplateMessage({
          templateName: config.template.name,
          templateLanguage,
          templatePolicy: "deterministic",
          templateNamespace,
          sender: integratedNumber,
          campaignName: config.campaign.name,
          recipients,
        });

        console.log("MSG91 Response:", JSON.stringify(response, null, 2));

        const requestId =
          response?.request_id ||
          response?.requestId ||
          response?.data?.request_id ||
          `msg91-${campaignId}-${Date.now()}`;

        await prisma.campaignDelivery.updateMany({
          where: { id: { in: batch.map(item => item.id) } },
          data: {
            status: CampaignDeliveryStatus.QUEUED,
            sentAt: new Date(),
            providerMessageId: requestId,
            webhookPayload: response as Prisma.InputJsonValue,
          },
        });

        queued += batch.length;
        console.log(
          `✅ Batch ${i + 1} sent successfully. Queued: ${batch.length}`
        );

        await prisma.analyticsEvent.create({
          data: {
            campaignId,
            contactId: null,
            leadId: null,
            eventType: "whatsapp.campaign.queued",
            eventData: {
              requestId,
              batchSize: batch.length,
            },
          },
        });
      } catch (error) {
        console.error(`❌ Batch ${i + 1} FAILED:`, error);
        console.error("Error details:", {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          response: (error as any)?.response?.data,
        });

        const errorMessage =
          error instanceof Error ? error.message : "MSG91 send failed";

        await prisma.campaignDelivery.updateMany({
          where: { id: { in: batch.map(item => item.id) } },
          data: {
            status: CampaignDeliveryStatus.FAILED,
            failedAt: new Date(),
            errorMessage: errorMessage,
          },
        });

        // Log failed batch to analytics
        await prisma.analyticsEvent.create({
          data: {
            campaignId,
            contactId: null,
            leadId: null,
            eventType: "whatsapp.campaign.batch_failed",
            eventData: {
              batchNumber: i + 1,
              batchSize: batch.length,
              error: errorMessage,
              recipients: batch.map(d => d.address),
            },
          },
        });
      }
    }

    console.log(`\n=== Campaign Send Complete ===`);
    console.log(`Total queued: ${queued}/${deliveries.length}`);
    console.log(`Failed: ${deliveries.length - queued}`);
    console.log("================================\n");

    return { queued };
  }

  async scheduleCampaign(campaignId: number, scheduledAt: Date) {
    const config = await prisma.whatsAppCampaignConfig.findUnique({
      where: { campaignId },
      include: {
        campaign: true,
      },
    });

    if (!config) {
      throw new Error("WhatsApp campaign configuration not found");
    }

    // Persist scheduled time on both the core campaign and the WhatsApp config,
    // so that reporting and the scheduler job can reliably detect due campaigns.
    await prisma.$transaction([
      prisma.campaign.update({
        where: { id: campaignId },
        data: {
          startDate: scheduledAt,
        },
      }),
      prisma.whatsAppCampaignConfig.update({
        where: { campaignId },
        data: {
          scheduledAt,
        },
      }),
      prisma.analyticsEvent.create({
        data: {
          campaignId,
          contactId: null,
          leadId: null,
          eventType: "whatsapp.campaign.scheduled",
          eventData: {
            scheduledAt: scheduledAt.toISOString(),
          },
        },
      }),
    ]);

    return { scheduled: true, scheduledAt: scheduledAt.toISOString() };
  }

  async getCampaignById(campaignId: number) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        campaignChannels: true,
      },
    });

    if (!campaign) {
      return null;
    }

    // Get WhatsApp campaign config with template
    const config = await prisma.whatsAppCampaignConfig.findUnique({
      where: { campaignId },
      include: {
        template: true,
        whatsappNumber: true,
      },
    });

    const deliveryStats = await prisma.campaignDelivery.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: { status: true },
    });

    const stats = {
      total: 0,
      pending: 0,
      queued: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
    };

    deliveryStats.forEach(stat => {
      const count = stat._count.status;
      stats.total += count;
      const key = stat.status.toLowerCase() as keyof typeof stats;
      if (key in stats) {
        stats[key] = count;
      }
    });

    return {
      ...campaign,
      deliveryStats: stats,
      // Include template and message params if it's a WhatsApp campaign
      ...(config && {
        templateName: config.template?.name,
        template: config.template,
        messageParams: config.messageParams,
        language: config.language,
      }),
    };
  }

  async listCampaigns() {
    const campaigns = await prisma.campaign.findMany({
      where: {
        campaignChannels: {
          some: {
            channelType: "whatsapp",
          },
        },
      },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        campaignChannels: true,
        whatsappConfig: true,
        _count: {
          select: {
            deliveries: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with delivery statistics and template info
    const enriched = await Promise.all(
      campaigns.map(async campaign => {
        const deliveryStats = await prisma.campaignDelivery.groupBy({
          by: ["status"],
          where: { campaignId: campaign.id },
          _count: { status: true },
        });

        const stats = {
          total: 0,
          pending: 0,
          queued: 0,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
        };

        deliveryStats.forEach(stat => {
          const count = stat._count.status;
          stats.total += count;
          const key = stat.status.toLowerCase() as keyof typeof stats;
          if (key in stats) {
            stats[key] = count;
          }
        });

        // Get WhatsApp campaign config with template name (and scheduled time)
        const config = await prisma.whatsAppCampaignConfig.findUnique({
          where: { campaignId: campaign.id },
          include: {
            template: {
              select: { name: true },
            },
          },
        });

        return {
          ...campaign,
          deliveryStats: stats,
          templateName: config?.template?.name,
          scheduledAt:
            config?.scheduledAt ?? campaign.whatsappConfig?.scheduledAt ?? null,
        };
      })
    );

    return enriched;
  }

  async listDeliveries(campaignId: number) {
    return prisma.campaignDelivery.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            countryCode: true,
            city: true,
            state: true,
            pincode: true,
            position: true,
          },
        },
      },
    });
  }

  async listEvents(campaignId: number) {
    return prisma.analyticsEvent.findMany({
      where: {
        campaignId,
        eventType: { contains: "whatsapp." },
      },
      orderBy: { occurredAt: "desc" },
    });
  }

  private async resolveContacts(
    audience: AudienceType,
    segmentId?: number
  ): Promise<ContactRecord[]> {
    if (audience === "segment") {
      if (!segmentId) {
        throw new Error("segmentId is required when audience is segment");
      }
      const contactIds = await this.segmentService.getContactIds(segmentId);
      if (!contactIds?.length) {
        return [];
      }
      return prisma.contact.findMany({
        where: {
          id: { in: contactIds },
          whatsappOptOut: false, // Filter out opted-out contacts
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          countryCode: true,
          city: true,
          state: true,
          pincode: true,
          position: true,
        },
      });
    }

    // Default to all contacts (excluding opted-out)
    return prisma.contact.findMany({
      where: {
        whatsappOptOut: false, // Filter out opted-out contacts
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        countryCode: true,
        city: true,
        state: true,
        pincode: true,
        position: true,
      },
    });
  }

  private normalizePhone(phone: string) {
    if (!phone) return null;
    const digits = phone.replace(/[^\d]/g, "");
    if (!digits) return null;
    if (digits.startsWith("0") && digits.length > 10) {
      return digits.slice(1);
    }
    if (digits.length === 10) {
      return `91${digits}`;
    }
    return digits;
  }

  private renderVariables(
    variables: Record<string, unknown>,
    contact: ContactRecord | null,
    csvData?: Record<string, string>
  ): Record<string, unknown> {
    const rendered: Record<string, unknown> = {};
    Object.entries(variables || {}).forEach(([key, value]) => {
      if (typeof value === "string") {
        rendered[key] = this.interpolate(value, contact, csvData);
        return;
      }

      if (value && typeof value === "object") {
        const typedValue = { ...(value as Record<string, unknown>) };
        if (typeof typedValue.value === "string") {
          typedValue.value = this.interpolate(
            typedValue.value,
            contact,
            csvData
          );
        }
        rendered[key] = typedValue;
        return;
      }

      rendered[key] = value;
    });
    return rendered;
  }

  private interpolate(
    template: string,
    contact: ContactRecord | null,
    csvData?: Record<string, string>
  ) {
    let result = template;

    // If CSV data is provided, replace CSV column placeholders first
    if (csvData) {
      // Replace all {{columnName}} placeholders with CSV data
      result = result.replace(/\{\{([^}]+)\}\}/g, (match, columnName) => {
        const trimmedColumn = columnName.trim();
        // Check if it's a CSV column
        if (csvData[trimmedColumn] !== undefined) {
          return csvData[trimmedColumn];
        }
        // Keep the placeholder if not found in CSV data
        return match;
      });
    }

    // If contact data is provided, handle database fields
    if (contact) {
      // Get first and last name from full name if needed
      const nameParts = (contact?.name || "").split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      result = result
        // Support both {{contact.field}} and {{field}} formats
        .replace(/\{\{\s*(?:contact\.)?name\s*\}\}/gi, contact?.name || "")
        .replace(/\{\{\s*(?:contact\.)?firstName\s*\}\}/gi, firstName)
        .replace(/\{\{\s*(?:contact\.)?lastName\s*\}\}/gi, lastName)
        .replace(/\{\{\s*(?:contact\.)?email\s*\}\}/gi, contact?.email || "")
        .replace(/\{\{\s*(?:contact\.)?phone\s*\}\}/gi, contact?.phone || "")
        .replace(
          /\{\{\s*(?:contact\.)?countryCode\s*\}\}/gi,
          contact?.countryCode || ""
        )
        .replace(/\{\{\s*(?:contact\.)?city\s*\}\}/gi, contact?.city || "")
        .replace(/\{\{\s*(?:contact\.)?state\s*\}\}/gi, contact?.state || "")
        .replace(
          /\{\{\s*(?:contact\.)?pincode\s*\}\}/gi,
          contact?.pincode || ""
        )
        .replace(
          /\{\{\s*(?:contact\.)?position\s*\}\}/gi,
          contact?.position || ""
        )
        // Lead-specific fields (return empty for contacts)
        .replace(/\{\{\s*(?:contact\.)?companyName\s*\}\}/gi, "");
    }

    return result;
  }

  private applyTemplateSpecificVariables(
    variables: Record<string, unknown>,
    templateCategory?: string | null
  ) {
    if (
      !templateCategory ||
      templateCategory.toUpperCase() !== "AUTHENTICATION"
    ) {
      return;
    }

    const extractValue = (entry: unknown): string | undefined => {
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        return trimmed || undefined;
      }
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const candidate = record.value ?? record.text;
        if (typeof candidate === "string") {
          const trimmed = candidate.trim();
          return trimmed || undefined;
        }
      }
      return undefined;
    };

    const otpValue =
      extractValue(variables["button_1"]) || extractValue(variables["body_1"]);
    if (!otpValue) {
      return;
    }

    variables["body_1"] = otpValue;
    const buttonPayload = {
      type: "text",
      sub_type: "COPY_CODE",
      value: otpValue,
      text: otpValue,
    };
    variables["button_1"] = buttonPayload;
    variables["button_0"] = buttonPayload;
  }

  private chunk<T>(records: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < records.length; i += size) {
      batches.push(records.slice(i, i + size));
    }
    return batches;
  }
}
