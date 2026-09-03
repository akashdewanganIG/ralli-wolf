import { prisma } from "@repo/db";
import { CampaignDeliveryStatus, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { WhatsappAccountService } from "./account-service.js";
import { WhatsappTemplateService } from "./template-service.js";
import { SegmentService } from "../segment.service.js";
import { getMsg91BaseUrl } from "../../utils/integration.utils.js";
import { Msg91Client } from "./msg91-client.js";
import { OptOutService } from "./opt-out-service.js";
import { logError } from "../../utils/logger.js";
import { normalizeWhatsAppPhone } from "./phone.js";
import { getSignedS3DownloadUrl } from "../s3.service.js";

type AudienceType = "all" | "segment" | "upload" | "leads";

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
  companyName?: string | null;
};

type AudienceRecipient = ContactRecord & {
  contactId: number | null;
  leadId: number | null;
};

type CsvContactRecord = Record<string, string>;

type PreparedDelivery = Omit<
  Prisma.CampaignDeliveryCreateManyInput,
  "campaignId"
>;

type DeliveryClaimRow = { id: number };

const MAX_DELIVERY_ATTEMPTS = 3;
const DELIVERY_CLAIM_TIMEOUT_MS = 15 * 60_000;
const CAMPAIGN_CONTINUATION_DELAY_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

type DeliveryStats = {
  total: number;
  pending: number;
  processing: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  opted_out: number;
};

function buildDeliveryStats(
  rows: Array<{
    status: CampaignDeliveryStatus;
    _count: { status: number };
  }>
): DeliveryStats {
  const stats: DeliveryStats = {
    total: 0,
    pending: 0,
    processing: 0,
    queued: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    opted_out: 0,
  };
  for (const row of rows) {
    const count = row._count.status;
    stats.total += count;
    stats[row.status.toLowerCase() as keyof Omit<DeliveryStats, "total">] =
      count;
  }
  return stats;
}

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
    lead: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        email: true;
        phone: true;
        countryCode: true;
        city: true;
        state: true;
        pincode: true;
        companyName: true;
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
  description?: string | null;
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
    if (isDraft && input.audience === "upload") {
      throw new Error(
        "Upload audiences cannot be saved as an empty draft; provide the CSV and create the campaign when ready."
      );
    }
    if (input.audience === "segment" && !input.segmentId) {
      throw new Error("segmentId is required for segment audience");
    }
    if (input.audience !== "segment" && input.segmentId !== undefined) {
      throw new Error("segmentId is only valid for segment audience");
    }

    const batchSize = input.batchSize ?? 100;
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 800) {
      throw new Error("Batch size must be an integer between 1 and 800");
    }

    let contacts: AudienceRecipient[] = [];
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

    let deliveriesData: PreparedDelivery[] = [];

    if (!isDraft) {
      if (input.audience === "upload" && csvContactsData.length > 0) {
        const optOutService = new OptOutService();

        const allPhones = csvContactsData
          .map(csvContact => csvContact[input.phoneColumnName!])
          .filter((phone): phone is string => Boolean(phone));

        const { allowed: allowedPhones } =
          await optOutService.filterOptedOut(allPhones);

        const allowedPhoneSet = new Set(allowedPhones);

        deliveriesData = csvContactsData
          .map(csvContact => {
            const phone = csvContact[input.phoneColumnName!];
            const normalized = normalizeWhatsAppPhone(phone || "");

            if (!normalized || !allowedPhoneSet.has(normalized)) return null;

            return {
              contactId: null,
              leadId: null,
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
        deliveriesData = contacts
          .map(contact => {
            const normalized = normalizeWhatsAppPhone(contact.phone || "");
            if (!normalized) return null;
            return {
              contactId: contact.contactId,
              leadId: contact.leadId,
              channel: "whatsapp",
              address: normalized,
              whatsappNumberId: account.id,
              segmentId: input.segmentId ?? null,
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

      deliveriesData = [
        ...new Map(
          deliveriesData.map(delivery => [delivery.address, delivery])
        ).values(),
      ];
    }

    const campaign = await prisma.$transaction(async tx => {
      const created = await tx.campaign.create({
        data: {
          name: input.name,
          description: input.description,
          createdBy: input.createdBy,
          startDate: new Date(),
          campaignChannels: {
            create: {
              channelType: "whatsapp",
              externalId: `msg91-local:${randomUUID()}`,
            },
          },
        },
      });

      await tx.whatsAppCampaignConfig.create({
        data: {
          campaignId: created.id,
          whatsappNumberId: account.id,
          templateId: template.id,
          segmentId: input.audience === "segment" ? input.segmentId : null,
          audience: input.audience,
          language: input.language || template.language || "en",
          messageParams: (input.messageParams || {}) as Prisma.InputJsonValue,
          batchSize,
        },
      });

      if (deliveriesData.length > 0) {
        await tx.campaignDelivery.createMany({
          data: deliveriesData.map(delivery => ({
            ...delivery,
            campaignId: created.id,
          })),
        });
      }

      return created;
    });

    return {
      campaign,
      totalRecipients: deliveriesData.length,
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
      audience: config.audience as AudienceType,
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

    const currentAudience = config.audience as AudienceType;
    if (!["all", "segment", "upload", "leads"].includes(currentAudience)) {
      throw new Error("Campaign has an invalid stored audience");
    }
    const nextAudience = input.audience ?? currentAudience;
    if (input.audience === "upload") {
      throw new Error("An upload audience cannot be replaced without CSV data");
    }
    const nextSegmentId =
      nextAudience === "segment"
        ? input.segmentId === null
          ? null
          : (input.segmentId ?? config.segmentId)
        : null;
    if (nextAudience === "segment" && !nextSegmentId) {
      throw new Error("segmentId is required for segment audience");
    }
    if (
      nextAudience !== "segment" &&
      input.segmentId !== undefined &&
      input.segmentId !== null
    ) {
      throw new Error("segmentId is only valid for segment audience");
    }

    const configUpdates: Prisma.WhatsAppCampaignConfigUncheckedUpdateInput = {};

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

    if (input.messageParams !== undefined) {
      configUpdates.messageParams =
        input.messageParams as Prisma.InputJsonValue;
    }

    if (input.batchSize !== undefined) {
      if (
        !Number.isSafeInteger(input.batchSize) ||
        input.batchSize < 1 ||
        input.batchSize > 800
      ) {
        throw new Error("Batch size must be an integer between 1 and 800");
      }
      configUpdates.batchSize = input.batchSize;
    }

    const replaceAudience =
      input.audience !== undefined || input.segmentId !== undefined;
    let replacementDeliveries: PreparedDelivery[] = [];
    if (replaceAudience) {
      if (nextAudience === "upload") {
        throw new Error("Upload audience recipients cannot be edited in place");
      }
      const contacts = await this.resolveContacts(
        nextAudience,
        nextSegmentId ?? undefined
      );
      replacementDeliveries = contacts.flatMap<PreparedDelivery>(contact => {
        const address = normalizeWhatsAppPhone(contact.phone || "");
        if (!address) return [];
        return [
          {
            contactId: contact.contactId,
            leadId: contact.leadId,
            channel: "whatsapp",
            address,
            whatsappNumberId: config.whatsappNumberId,
            segmentId: nextSegmentId,
            status: CampaignDeliveryStatus.PENDING,
          } satisfies PreparedDelivery,
        ];
      });
      replacementDeliveries = [
        ...new Map(
          replacementDeliveries.map(delivery => [delivery.address, delivery])
        ).values(),
      ];
      if (replacementDeliveries.length === 0) {
        throw new Error(
          "None of the selected contacts have a valid phone number"
        );
      }
      configUpdates.audience = nextAudience;
      configUpdates.segmentId = nextSegmentId;
    }

    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT id FROM "whatsapp_campaign_configs" WHERE "campaign_id" = ${campaignId} FOR UPDATE`;
      const lockedConfig = await tx.whatsAppCampaignConfig.findUnique({
        where: { campaignId },
        select: { updatedAt: true },
      });
      if (!lockedConfig) {
        throw new Error("Campaign configuration not found");
      }
      if (lockedConfig.updatedAt.getTime() !== config.updatedAt.getTime()) {
        throw new Error("Campaign was modified concurrently; reload and retry");
      }

      const startedDeliveries = await tx.campaignDelivery.count({
        where: {
          campaignId,
          status: { not: CampaignDeliveryStatus.PENDING },
        },
      });
      if (startedDeliveries > 0) {
        throw new Error("Cannot edit a campaign after sending has started");
      }

      if (input.name !== undefined || input.description !== undefined) {
        await tx.campaign.update({
          where: { id: campaignId },
          data: {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.description !== undefined && {
              description: input.description,
            }),
          },
        });
      }

      if (Object.keys(configUpdates).length > 0) {
        await tx.whatsAppCampaignConfig.update({
          where: { campaignId },
          data: configUpdates,
        });
      }

      if (replaceAudience) {
        await tx.campaignDelivery.deleteMany({ where: { campaignId } });
        await tx.campaignDelivery.createMany({
          data: replacementDeliveries.map(delivery => ({
            ...delivery,
            campaignId,
          })),
        });
      }
    });

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
    if (config.template.isArchived || config.template.status !== "APPROVED") {
      throw new Error("Campaign template is not active and approved");
    }

    const account = await this.accountService.getAccountOrThrow(
      config.whatsappNumberId
    );

    const client = new Msg91Client({
      apiKey: account.apiKey,
      baseUrl: await getMsg91BaseUrl(),
    });
    const integratedNumber = account.phoneNumber;

    if (!integratedNumber) {
      throw new Error(
        "WhatsApp account is missing the integrated phone number"
      );
    }

    const templateLanguage =
      config.language || config.template.language || "en";
    const templateComponents = config.template.components as Record<
      string,
      unknown
    > | null;
    const templateNamespace = templateComponents?.namespace as
      | string
      | undefined;
    if (!config.template.name) {
      throw new Error("Template name is missing");
    }
    if (!templateNamespace) {
      throw new Error("WhatsApp template namespace is missing");
    }

    const claimStartedAt = new Date();
    const staleBefore = new Date(
      claimStartedAt.getTime() - DELIVERY_CLAIM_TIMEOUT_MS
    );
    const claimLimit = config.batchSize;
    const claimedIds = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT id FROM "whatsapp_campaign_configs" WHERE "campaign_id" = ${campaignId} FOR UPDATE`;
      await tx.campaignDelivery.updateMany({
        where: {
          campaignId,
          status: CampaignDeliveryStatus.PROCESSING,
          processingStartedAt: { lt: staleBefore },
        },
        data: {
          status: CampaignDeliveryStatus.FAILED,
          processingStartedAt: null,
          failedAt: claimStartedAt,
          errorMessage: "Delivery worker claim expired before completion",
        },
      });

      const rows = await tx.$queryRaw<DeliveryClaimRow[]>`
        SELECT "id"
        FROM "campaign_deliveries"
        WHERE "campaign_id" = ${campaignId}
          AND (
            "status" = 'PENDING'
            OR (
              "status" = 'FAILED'
              AND "attempt_count" < ${MAX_DELIVERY_ATTEMPTS}
            )
          )
        ORDER BY "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${claimLimit}
      `;
      if (rows.length === 0) return [];

      const ids = rows.map(row => row.id);
      const claimed = await tx.campaignDelivery.updateMany({
        where: { id: { in: ids } },
        data: {
          status: CampaignDeliveryStatus.PROCESSING,
          processingStartedAt: claimStartedAt,
          lastAttemptAt: claimStartedAt,
          attemptCount: { increment: 1 },
          failedAt: null,
          errorCode: null,
          errorMessage: null,
        },
      });
      if (claimed.count !== ids.length) {
        throw new Error("Failed to claim every selected campaign delivery");
      }
      return ids;
    });

    if (claimedIds.length === 0) {
      const remaining = await this.scheduleContinuation(campaignId);
      return {
        queued: 0,
        remaining,
        message: remaining
          ? "Another worker is processing the remaining deliveries"
          : "No pending deliveries",
      };
    }

    const rawDeliveries = await prisma.campaignDelivery.findMany({
      where: {
        id: { in: claimedIds },
        status: CampaignDeliveryStatus.PROCESSING,
      },
      include: {
        contact: true,
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            countryCode: true,
            city: true,
            state: true,
            pincode: true,
            companyName: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });

    let deliveries: DeliveryWithContact[] = rawDeliveries.map(delivery => ({
      ...delivery,
      csvData: delivery.csvData
        ? (delivery.csvData as Record<string, string>)
        : null,
    }));

    if (deliveries.length !== claimedIds.length) {
      throw new Error("Claimed campaign deliveries could not be reloaded");
    }

    const optOutService = new OptOutService();
    const allPhones = deliveries.map(d => d.address);
    const { allowed: allowedPhones, blockedCount } =
      await optOutService.filterOptedOut(allPhones);

    if (blockedCount > 0) {
      const allowedPhoneSet = new Set(allowedPhones);
      const blockedDeliveries = deliveries.filter(
        d => !allowedPhoneSet.has(d.address)
      );

      if (blockedDeliveries.length > 0) {
        await prisma.campaignDelivery.updateMany({
          where: {
            id: { in: blockedDeliveries.map(d => d.id) },
            status: CampaignDeliveryStatus.PROCESSING,
          },
          data: {
            status: CampaignDeliveryStatus.OPTED_OUT,
            processingStartedAt: null,
            failedAt: new Date(),
            errorMessage: "User opted out before campaign was sent",
          },
        });

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
                  timestamp: new Date().toISOString(),
                },
              },
            })
          )
        );
      }

      deliveries = deliveries.filter(d => allowedPhoneSet.has(d.address));
    }

    if (!deliveries.length) {
      const remaining = await this.scheduleContinuation(campaignId);
      return {
        queued: 0,
        remaining,
        message: "All deliveries were opted out",
        blockedCount,
      };
    }

    const batchSize = config.batchSize;
    const batches = this.chunk(deliveries, batchSize);
    let queued = 0;
    const signedMediaUrls = new Map<string, Promise<string>>();

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch || batch.length === 0) {
        continue;
      }
      try {
        const recipients = await Promise.all(
          batch.map(async delivery => {
            const csvData = delivery.csvData
              ? (delivery.csvData as Record<string, string>)
              : undefined;

            const variables = this.renderVariables(
              (config.messageParams as Record<string, unknown>) || {},
              delivery.contact ??
                (delivery.lead
                  ? {
                      id: delivery.lead.id,
                      name: [delivery.lead.firstName, delivery.lead.lastName]
                        .filter(Boolean)
                        .join(" "),
                      email: delivery.lead.email,
                      phone: delivery.lead.phone,
                      countryCode: delivery.lead.countryCode,
                      city: delivery.lead.city,
                      state: delivery.lead.state,
                      pincode: delivery.lead.pincode,
                      position: null,
                      companyName: delivery.lead.companyName,
                    }
                  : null),
              csvData
            );
            this.applyTemplateSpecificVariables(
              variables,
              config.template.category
            );
            await this.materializeHeaderMedia(
              variables,
              templateComponents,
              signedMediaUrls
            );
            return {
              phone: delivery.address,
              variables,
            };
          })
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

        const requestId =
          response.requestId || `msg91-${campaignId}-${Date.now()}`;

        await prisma.campaignDelivery.updateMany({
          where: {
            id: { in: batch.map(item => item.id) },
            status: CampaignDeliveryStatus.PROCESSING,
          },
          data: {
            status: CampaignDeliveryStatus.QUEUED,
            processingStartedAt: null,
            sentAt: new Date(),
            providerMessageId: requestId,
            webhookPayload: {
              provider: "MSG91",
              requestId,
            },
          },
        });

        queued += batch.length;
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
        logError("whatsapp_campaign_batch_failed", error, {
          campaignId,
          batchNumber: i + 1,
        });

        const errorMessage = "MSG91 send failed";

        await prisma.campaignDelivery.updateMany({
          where: {
            id: { in: batch.map(item => item.id) },
            status: CampaignDeliveryStatus.PROCESSING,
          },
          data: {
            status: CampaignDeliveryStatus.FAILED,
            processingStartedAt: null,
            failedAt: new Date(),
            errorMessage: errorMessage,
          },
        });

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
            },
          },
        });
      }
    }

    const remaining = await this.scheduleContinuation(campaignId);
    return { queued, remaining };
  }

  async scheduleCampaign(campaignId: number, scheduledAt: Date) {
    if (
      Number.isNaN(scheduledAt.getTime()) ||
      scheduledAt.getTime() <= Date.now()
    ) {
      throw new Error("Scheduled time must be in the future");
    }

    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT id FROM "whatsapp_campaign_configs" WHERE "campaign_id" = ${campaignId} FOR UPDATE`;
      const config = await tx.whatsAppCampaignConfig.findUnique({
        where: { campaignId },
        select: { id: true },
      });
      if (!config) {
        throw new Error("WhatsApp campaign configuration not found");
      }

      const [pending, started] = await Promise.all([
        tx.campaignDelivery.count({
          where: { campaignId, status: CampaignDeliveryStatus.PENDING },
        }),
        tx.campaignDelivery.count({
          where: {
            campaignId,
            status: { not: CampaignDeliveryStatus.PENDING },
          },
        }),
      ]);
      if (pending === 0) {
        throw new Error(
          "A campaign must have pending recipients to be scheduled"
        );
      }
      if (started > 0) {
        throw new Error(
          "A campaign cannot be scheduled after sending has started"
        );
      }

      await tx.campaign.update({
        where: { id: campaignId },
        data: { startDate: scheduledAt },
      });
      await tx.whatsAppCampaignConfig.update({
        where: { campaignId },
        data: { scheduledAt },
      });
      await tx.analyticsEvent.create({
        data: {
          campaignId,
          contactId: null,
          leadId: null,
          eventType: "whatsapp.campaign.scheduled",
          eventData: {
            scheduledAt: scheduledAt.toISOString(),
          },
        },
      });
    });

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

    const stats = buildDeliveryStats(deliveryStats);

    return {
      ...campaign,
      deliveryStats: stats,

      ...(config && {
        templateName: config.template?.name,
        template: config.template,
        messageParams: config.messageParams,
        language: config.language,
      }),
    };
  }

  async listCampaigns(params: {
    skip: number;
    take: number;
    search?: string;
    status?: "draft" | "pending" | "failed" | "sent" | "sending" | "active";
    startDate?: Date;
    createdFrom?: Date;
    createdTo?: Date;
  }) {
    const where: Prisma.CampaignWhereInput = {
      campaignChannels: {
        some: {
          channelType: "whatsapp",
        },
      },
    };
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        {
          creator: {
            is: {
              OR: [
                {
                  firstName: {
                    contains: params.search,
                    mode: "insensitive",
                  },
                },
                {
                  lastName: { contains: params.search, mode: "insensitive" },
                },
                { email: { contains: params.search, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }
    if (params.startDate) {
      where.startDate = {
        gte: params.startDate,
        lt: new Date(params.startDate.getTime() + 24 * 60 * 60_000),
      };
    }
    if (params.createdFrom || params.createdTo) {
      where.createdAt = {
        ...(params.createdFrom && { gte: params.createdFrom }),
        ...(params.createdTo && {
          lt: new Date(params.createdTo.getTime() + 24 * 60 * 60_000),
        }),
      };
    }

    const terminalProgress = [
      CampaignDeliveryStatus.SENT,
      CampaignDeliveryStatus.DELIVERED,
      CampaignDeliveryStatus.READ,
    ];
    const inFlight = [
      CampaignDeliveryStatus.PROCESSING,
      CampaignDeliveryStatus.QUEUED,
    ];
    if (params.status === "draft") {
      where.deliveries = { none: {} };
    } else if (params.status === "pending") {
      where.AND = [
        { deliveries: { some: {} } },
        { deliveries: { every: { status: CampaignDeliveryStatus.PENDING } } },
      ];
    } else if (params.status === "failed") {
      where.AND = [
        { deliveries: { some: {} } },
        { deliveries: { every: { status: CampaignDeliveryStatus.FAILED } } },
      ];
    } else if (params.status === "sent") {
      where.deliveries = { some: { status: { in: terminalProgress } } };
    } else if (params.status === "sending") {
      where.AND = [
        { deliveries: { none: { status: { in: terminalProgress } } } },
        { deliveries: { some: { status: { in: inFlight } } } },
      ];
    } else if (params.status === "active") {
      where.AND = [
        { deliveries: { some: {} } },
        { deliveries: { none: { status: { in: terminalProgress } } } },
        { deliveries: { none: { status: { in: inFlight } } } },
        {
          NOT: {
            deliveries: {
              every: { status: CampaignDeliveryStatus.PENDING },
            },
          },
        },
        {
          NOT: {
            deliveries: { every: { status: CampaignDeliveryStatus.FAILED } },
          },
        },
      ];
    }

    const [campaigns, total] = await prisma.$transaction([
      prisma.campaign.findMany({
        where,
        skip: params.skip,
        take: params.take,
        include: {
          creator: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          campaignChannels: true,
          whatsappConfig: {
            include: {
              template: {
                select: { name: true },
              },
            },
          },
          _count: {
            select: {
              deliveries: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      prisma.campaign.count({ where }),
    ]);

    const campaignIds = campaigns.map(campaign => campaign.id);
    const grouped =
      campaignIds.length > 0
        ? await prisma.campaignDelivery.groupBy({
            by: ["campaignId", "status"],
            where: { campaignId: { in: campaignIds } },
            _count: { status: true },
          })
        : [];
    const rowsByCampaign = new Map<
      number,
      Array<{
        status: CampaignDeliveryStatus;
        _count: { status: number };
      }>
    >();
    for (const row of grouped) {
      const rows = rowsByCampaign.get(row.campaignId) ?? [];
      rows.push(row);
      rowsByCampaign.set(row.campaignId, rows);
    }

    return {
      data: campaigns.map(campaign => ({
        ...campaign,
        deliveryStats: buildDeliveryStats(
          rowsByCampaign.get(campaign.id) ?? []
        ),
        templateName: campaign.whatsappConfig?.template.name,
        scheduledAt: campaign.whatsappConfig?.scheduledAt ?? null,
      })),
      pagination: {
        total,
        skip: params.skip,
        take: params.take,
        pages: Math.ceil(total / params.take),
      },
    };
  }

  async listDeliveries(
    campaignId: number,
    pagination: { skip: number; take: number }
  ) {
    const [data, total] = await prisma.$transaction([
      prisma.campaignDelivery.findMany({
        where: { campaignId },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              countryCode: true,
              city: true,
              state: true,
              pincode: true,
              companyName: true,
            },
          },
        },
      }),
      prisma.campaignDelivery.count({ where: { campaignId } }),
    ]);
    return {
      data,
      pagination: {
        total,
        ...pagination,
        pages: Math.ceil(total / pagination.take),
      },
    };
  }

  async listEvents(
    campaignId: number,
    pagination: { skip: number; take: number }
  ) {
    const where: Prisma.AnalyticsEventWhereInput = {
      campaignId,
      eventType: { startsWith: "whatsapp." },
    };
    const [data, total] = await prisma.$transaction([
      prisma.analyticsEvent.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      }),
      prisma.analyticsEvent.count({ where }),
    ]);
    return {
      data,
      pagination: {
        total,
        ...pagination,
        pages: Math.ceil(total / pagination.take),
      },
    };
  }

  private async scheduleContinuation(campaignId: number): Promise<number> {
    return prisma.$transaction(async tx => {
      const remaining = await tx.campaignDelivery.count({
        where: {
          campaignId,
          OR: [
            { status: CampaignDeliveryStatus.PENDING },
            {
              status: CampaignDeliveryStatus.FAILED,
              attemptCount: { lt: MAX_DELIVERY_ATTEMPTS },
            },
            { status: CampaignDeliveryStatus.PROCESSING },
          ],
        },
      });

      await tx.whatsAppCampaignConfig.update({
        where: { campaignId },
        data: {
          scheduledAt:
            remaining > 0
              ? new Date(Date.now() + CAMPAIGN_CONTINUATION_DELAY_MS)
              : null,
        },
      });
      return remaining;
    });
  }

  private async resolveContacts(
    audience: AudienceType,
    segmentId?: number
  ): Promise<AudienceRecipient[]> {
    if (audience === "leads") {
      const leads = await prisma.lead.findMany({
        where: {
          deletedAt: null,
          convertedToContactId: null,
          whatsappOptOut: false,
          phone: { not: null },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          countryCode: true,
          city: true,
          state: true,
          pincode: true,
          companyName: true,
        },
      });
      return leads.map(lead => ({
        id: lead.id,
        contactId: null,
        leadId: lead.id,
        name: [lead.firstName, lead.lastName].filter(Boolean).join(" "),
        email: lead.email,
        phone: lead.phone,
        countryCode: lead.countryCode,
        city: lead.city,
        state: lead.state,
        pincode: lead.pincode,
        position: null,
        companyName: lead.companyName,
      }));
    }

    if (audience === "segment") {
      if (!segmentId) {
        throw new Error("segmentId is required when audience is segment");
      }
      const contactIds = await this.segmentService.getContactIds(segmentId);
      if (!contactIds?.length) {
        return [];
      }
      const contacts = await prisma.contact.findMany({
        where: {
          id: { in: contactIds },
          whatsappOptOut: false,
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
      return contacts.map(contact => ({
        ...contact,
        contactId: contact.id,
        leadId: null,
        companyName: null,
      }));
    }

    const contacts = await prisma.contact.findMany({
      where: {
        whatsappOptOut: false,
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
    return contacts.map(contact => ({
      ...contact,
      contactId: contact.id,
      leadId: null,
      companyName: null,
    }));
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

    if (csvData) {
      result = result.replace(/\{\{([^}]+)\}\}/g, (match, columnName) => {
        const trimmedColumn = columnName.trim();

        if (csvData[trimmedColumn] !== undefined) {
          return csvData[trimmedColumn];
        }

        return match;
      });
    }

    if (contact) {
      const nameParts = (contact?.name || "").split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      result = result

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
        .replace(
          /\{\{\s*(?:contact\.)?companyName\s*\}\}/gi,
          contact.companyName || ""
        );
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

  private async materializeHeaderMedia(
    variables: Record<string, unknown>,
    templateData: Record<string, unknown> | null,
    signedUrls: Map<string, Promise<string>>
  ): Promise<void> {
    const components = Array.isArray(templateData?.components)
      ? templateData.components
      : [];
    const header = components.find(component => {
      if (!isRecord(component)) return false;
      return (
        typeof component.type === "string" &&
        component.type.toUpperCase() === "HEADER"
      );
    });
    if (!isRecord(header) || typeof header.format !== "string") return;

    const mediaType = header.format.toLowerCase();
    if (!["image", "video", "document"].includes(mediaType)) return;

    const configured = variables.header_1;
    let rawReference: unknown = configured;
    if (isRecord(configured)) {
      const declaredType =
        typeof configured.type === "string"
          ? configured.type.trim().toLowerCase()
          : "";
      const media = configured[mediaType];
      if (declaredType !== mediaType || !isRecord(media)) {
        throw new Error(`Template requires valid ${mediaType} header_1 media`);
      }
      const id = typeof media.id === "string" ? media.id.trim() : "";
      const configuredLink =
        typeof media.link === "string" ? media.link.trim() : "";
      if ((id && configuredLink) || (!id && !configuredLink)) {
        throw new Error(`Template requires one ${mediaType} media reference`);
      }
      rawReference = id || configuredLink;
    }
    if (typeof rawReference !== "string" || !rawReference.trim()) {
      throw new Error(`Template requires ${mediaType} header_1 media`);
    }

    const reference = rawReference.trim();
    let link: string;
    if (reference.startsWith("s3://")) {
      const key = reference.slice("s3://".length);
      if (
        !key.startsWith("whatsapp-campaign/") ||
        key.includes("\\") ||
        key.split("/").includes("..")
      ) {
        throw new Error("Campaign contains an invalid private media reference");
      }
      let signed = signedUrls.get(key);
      if (!signed) {
        signed = getSignedS3DownloadUrl(key, 3_600);
        signedUrls.set(key, signed);
      }
      link = await signed;
    } else {
      let parsed: URL;
      try {
        parsed = new URL(reference);
      } catch {
        throw new Error("Campaign media must be a private upload or HTTPS URL");
      }
      const hostname = parsed.hostname.toLowerCase();
      if (
        parsed.protocol !== "https:" ||
        parsed.username ||
        parsed.password ||
        reference.length > 2_048 ||
        hostname === "localhost" ||
        hostname.endsWith(".local") ||
        /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
        hostname.includes(":")
      ) {
        throw new Error("Campaign media URL must use a public HTTPS hostname");
      }
      link = parsed.toString();
    }

    variables.header_1 = {
      type: mediaType,
      [mediaType]: { link },
    };
  }

  private chunk<T>(records: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < records.length; i += size) {
      batches.push(records.slice(i, i + size));
    }
    return batches;
  }
}
