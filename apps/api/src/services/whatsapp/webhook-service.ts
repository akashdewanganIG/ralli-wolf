import { prisma } from "@repo/db";
import { CampaignDeliveryStatus, Prisma } from "@prisma/client";
import { OptOutService } from "./opt-out-service.js";
import { logError, logWarn } from "../../utils/logger.js";
import { normalizeWhatsAppPhone, whatsappPhoneVariants } from "./phone.js";

type Msg91WebhookPayload = {
  [key: string]: unknown;
  data?: Record<string, unknown>;
};

const OPT_OUT_COMMANDS = new Set([
  "stop",
  "unsubscribe",
  "optout",
  "opt-out",
  "opt out",
  "cancel",
]);

export function isWhatsAppOptOutCommand(message: string): boolean {
  const normalized = message
    .toLowerCase()
    .trim()
    .replace(/[.!]+$/, "")
    .replace(/\s+/g, " ");
  return OPT_OUT_COMMANDS.has(normalized);
}

export function mapMsg91DeliveryStatus(eventType: string): {
  status: CampaignDeliveryStatus;
  label: string;
} | null {
  switch (eventType.toLowerCase()) {
    case "sent":
    case "submitted":
      return { status: CampaignDeliveryStatus.SENT, label: "sent" };
    case "queued":
      return { status: CampaignDeliveryStatus.QUEUED, label: "queued" };
    case "delivered":
      return { status: CampaignDeliveryStatus.DELIVERED, label: "delivered" };
    case "read":
    case "seen":
      return { status: CampaignDeliveryStatus.READ, label: "read" };
    case "optout":
    case "opt-out":
    case "opt_out":
    case "opted_out":
    case "unsubscribed":
    case "unsubscribe":
      return { status: CampaignDeliveryStatus.OPTED_OUT, label: "opted_out" };
    case "failed":
    case "undelivered":
    case "error":
      return { status: CampaignDeliveryStatus.FAILED, label: "failed" };
    default:
      return null;
  }
}

function deliveryStatusRank(status: CampaignDeliveryStatus): number {
  switch (status) {
    case CampaignDeliveryStatus.PENDING:
      return 0;
    case CampaignDeliveryStatus.PROCESSING:
      return 0.5;
    case CampaignDeliveryStatus.QUEUED:
      return 1;
    case CampaignDeliveryStatus.SENT:
      return 2;
    case CampaignDeliveryStatus.DELIVERED:
      return 3;
    case CampaignDeliveryStatus.READ:
      return 4;
    case CampaignDeliveryStatus.FAILED:
      return 5;
    case CampaignDeliveryStatus.OPTED_OUT:
      return 6;
  }
}

export function shouldApplyDeliveryStatus(
  current: CampaignDeliveryStatus,
  next: CampaignDeliveryStatus
): boolean {
  if (next === CampaignDeliveryStatus.OPTED_OUT) {
    return current !== CampaignDeliveryStatus.OPTED_OUT;
  }
  if (next === CampaignDeliveryStatus.FAILED) {
    return deliveryStatusRank(current) < 3;
  }
  return deliveryStatusRank(next) > deliveryStatusRank(current);
}

export class WhatsappWebhookService {
  async handleMsg91InboundMessage(payload: Msg91WebhookPayload) {
    const phoneNumber =
      this.getStringValue(payload, "customerNumber") ||
      this.getStringValue(payload, "customer_number") ||
      this.getStringValue(payload, "from") ||
      this.getStringValue(payload, "sender") ||
      this.getStringValue(payload, "phone") ||
      this.getStringValue(payload, "mobile_number") ||
      this.getStringValue(payload.data, "from") ||
      this.getStringValue(payload.data, "sender") ||
      this.getStringValue(payload.data, "customerNumber");

    const messageText =
      this.getStringValue(payload, "text") ||
      this.getStringValue(payload, "message") ||
      this.getStringValue(payload, "body") ||
      this.getStringValue(payload.data, "text") ||
      this.getStringValue(payload.data, "message") ||
      this.getStringValue(payload.data, "body") ||
      "";

    if (!phoneNumber) {
      logWarn("whatsapp_inbound_phone_missing");
      return { success: false, message: "No phone number found in payload" };
    }

    const normalizedPhone = normalizeWhatsAppPhone(phoneNumber);
    if (!normalizedPhone) {
      logWarn("whatsapp_inbound_phone_invalid");
      return { success: false, message: "Invalid phone number in payload" };
    }

    const isStopMessage = isWhatsAppOptOutCommand(messageText);

    if (!isStopMessage) {
      return {
        success: true,
        message: "Message is not a STOP command",
        isOptOut: false,
      };
    }

    await prisma.webhookEvent.create({
      data: {
        provider: "MSG91",
        eventType: "inbound_stop_message",
        payload: { provider: "MSG91", command: "stop" },
      },
    });

    const phoneVariants = whatsappPhoneVariants(normalizedPhone);

    const contact = await prisma.contact.findFirst({
      where: { phone: { in: phoneVariants } },
      select: { id: true },
    });

    let lead = null;
    if (!contact) {
      lead = await prisma.lead.findFirst({
        where: { phone: { in: phoneVariants } },
        select: { id: true },
      });
    }

    const optOutService = new OptOutService();
    try {
      await optOutService.addOptOut({
        phone: normalizedPhone,
        source: "inbound_message",
        reason: "User sent an opt-out command",
        metadata: { provider: "MSG91", command: "stop" },
      });

      if (contact || lead) {
        const recentDelivery = await prisma.campaignDelivery.findFirst({
          where: {
            address: normalizedPhone,
            channel: "whatsapp",
          },
          orderBy: { createdAt: "desc" },
          select: { campaignId: true },
        });

        if (recentDelivery) {
          await prisma.analyticsEvent.create({
            data: {
              campaignId: recentDelivery.campaignId,
              contactId: contact?.id || null,
              leadId: lead?.id || null,
              eventType: "whatsapp.opted_out_stop_message",
              eventData: {
                source: "inbound_stop_message",
                reason: "User sent an opt-out command",
                timestamp: new Date().toISOString(),
              },
            },
          });
        }
      }

      return {
        success: true,
        message: "User opted out successfully",
        isOptOut: true,
        userId: contact?.id || lead?.id,
        userType: contact ? "contact" : lead ? "lead" : null,
      };
    } catch (error) {
      logError("whatsapp_opt_out_processing_failed", error);
      return {
        success: false,
        message: "Failed to process opt-out",
      };
    }
  }

  async handleMsg91Event(payload: Msg91WebhookPayload) {
    const eventType = (
      this.getStringValue(payload, "eventName") ||
      this.getStringValue(payload, "event") ||
      this.getStringValue(payload, "status") ||
      this.getStringValue(payload.data, "eventName") ||
      this.getStringValue(payload.data, "status") ||
      "unknown"
    ).toLowerCase();

    const correlationId =
      this.getStringValue(payload, "requestId") ||
      this.getStringValue(payload, "request_id") ||
      this.getStringValue(payload, "campaign_request_id") ||
      this.getStringValue(payload, "uuid") ||
      this.getStringValue(payload, "message_uuid") ||
      this.getStringValue(payload, "id");

    const customerNumber =
      this.getStringValue(payload, "customerNumber") ||
      this.getStringValue(payload, "customer_number") ||
      this.getStringValue(payload, "to") ||
      this.getStringValue(payload, "recipient") ||
      this.getStringValue(payload.data, "customerNumber") ||
      this.getStringValue(payload.data, "customer_number");

    const providerIds = this.extractProviderIds(payload);

    const stored = await prisma.webhookEvent.create({
      data: {
        provider: "MSG91",
        eventType,
        payload: {
          provider: "MSG91",
          eventType,
          providerIds,
          hasRecipient: Boolean(customerNumber),
        },
        correlationId: correlationId || undefined,
      },
    });

    if (!providerIds.length) {
      return { storedId: stored.id, matched: 0 };
    }

    const whereClause: Prisma.CampaignDeliveryWhereInput = {
      providerMessageId: { in: providerIds },
    };

    if (customerNumber) {
      const normalizedPhone = normalizeWhatsAppPhone(customerNumber);
      if (!normalizedPhone) {
        return { storedId: stored.id, matched: 0 };
      }
      whereClause.address = normalizedPhone;
    }

    let deliveries = await prisma.campaignDelivery.findMany({
      where: whereClause,
    });

    if (!deliveries.length && customerNumber) {
      const normalizedPhone = normalizeWhatsAppPhone(customerNumber);
      const phoneVariants = normalizedPhone
        ? whatsappPhoneVariants(normalizedPhone)
        : [];

      deliveries = await prisma.campaignDelivery.findMany({
        where: {
          providerMessageId: { in: providerIds },
          address: { in: phoneVariants },
        },
      });
    }

    if (!deliveries.length) {
      return { storedId: stored.id, matched: 0 };
    }

    const statusUpdate = mapMsg91DeliveryStatus(eventType);
    if (!statusUpdate) {
      return { storedId: stored.id, matched: 0, updated: 0 };
    }
    const sanitizedWebhookPayload = {
      provider: "MSG91",
      eventType,
      providerIds,
    };

    const errorMessage =
      this.getStringValue(payload, "reason") ||
      this.getStringValue(payload, "error") ||
      this.getStringValue(payload, "description") ||
      null;

    const transitionResults = await Promise.all(
      deliveries.map(async delivery => {
        const shouldUpdateStatus = shouldApplyDeliveryStatus(
          delivery.status,
          statusUpdate.status
        );
        if (!shouldUpdateStatus) return null;

        const result = await prisma.campaignDelivery.updateMany({
          where: { id: delivery.id, status: delivery.status },
          data: {
            status: statusUpdate.status,
            processingStartedAt: null,
            deliveredAt:
              statusUpdate.status === CampaignDeliveryStatus.DELIVERED
                ? new Date()
                : delivery.deliveredAt,
            readAt:
              statusUpdate.status === CampaignDeliveryStatus.READ
                ? new Date()
                : delivery.readAt,
            failedAt:
              statusUpdate.status === CampaignDeliveryStatus.FAILED
                ? new Date()
                : delivery.failedAt,
            errorMessage:
              statusUpdate.status === CampaignDeliveryStatus.FAILED
                ? errorMessage
                : delivery.errorMessage,
            webhookPayload: sanitizedWebhookPayload,
          },
        });
        return result.count === 1 ? delivery : null;
      })
    );
    const transitioned = transitionResults.filter(
      (delivery): delivery is (typeof deliveries)[number] => delivery !== null
    );

    if (
      statusUpdate.status === CampaignDeliveryStatus.OPTED_OUT &&
      transitioned.length > 0
    ) {
      const optOutService = new OptOutService();

      await Promise.all(
        transitioned.map(async delivery => {
          const phone = delivery.address;

          if (phone) {
            try {
              await optOutService.addOptOut({
                phone,
                source: "webhook",
                campaignId: delivery.campaignId,
                reason: errorMessage || "User opted out via MSG91 webhook",
                metadata: sanitizedWebhookPayload,
              });
            } catch (error) {
              logError("whatsapp_webhook_opt_out_write_failed", error, {
                campaignId: delivery.campaignId,
              });
            }
          }
        })
      );
    }

    if (transitioned.length === 0) {
      return {
        storedId: stored.id,
        matched: deliveries.length,
        updated: 0,
      };
    }

    const campaignIds = [...new Set(transitioned.map(d => d.campaignId))];
    const campaigns = await prisma.campaign.findMany({
      where: { id: { in: campaignIds } },
      select: { id: true, name: true },
    });
    const campaignNameMap = new Map(campaigns.map(c => [c.id, c.name]));

    const contactIds = transitioned
      .map(d => d.contactId)
      .filter((id): id is number => id !== null);
    const leadsFromContacts =
      contactIds.length > 0
        ? await prisma.lead.findMany({
            where: { convertedToContactId: { in: contactIds } },
            select: { id: true, convertedToContactId: true },
          })
        : [];
    const contactToLeadMap = new Map(
      leadsFromContacts.map(l => [l.convertedToContactId, l.id])
    );

    await prisma.analyticsEvent.createMany({
      data: transitioned.map(delivery => {
        const leadId =
          delivery.leadId ??
          (delivery.contactId
            ? contactToLeadMap.get(delivery.contactId)
            : null) ??
          null;

        return {
          campaignId: delivery.campaignId,
          contactId: delivery.contactId,
          leadId,
          eventType: `whatsapp.${statusUpdate.label}`,
          eventData: {
            campaignName:
              campaignNameMap.get(delivery.campaignId) || "Unknown Campaign",
            status: statusUpdate.label,
            timestamp: new Date().toISOString(),
          },
        };
      }),
    });

    return {
      storedId: stored.id,
      matched: deliveries.length,
      updated: transitioned.length,
    };
  }

  private extractProviderIds(payload: Msg91WebhookPayload): string[] {
    const ids: string[] = [];

    const primaryIds = [
      "requestId",
      "request_id",
      "campaign_request_id",
      "uuid",
      "message_uuid",
      "id",
      "batchId",
    ];
    primaryIds.forEach(key => {
      const value = this.getStringValue(payload, key);
      if (value) ids.push(value);
    });

    const dataRequestId = this.getStringValue(payload.data, "request_id");
    if (dataRequestId) {
      ids.push(dataRequestId);
    }
    const dataUuid = this.getStringValue(payload.data, "uuid");
    if (dataUuid) {
      ids.push(dataUuid);
    }
    return [...new Set(ids.filter(Boolean))];
  }

  private getStringValue(
    source: Record<string, unknown> | undefined,
    key: string
  ): string | null {
    if (!source) return null;
    const value = source[key];
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized && normalized.length <= 512 ? normalized : null;
  }
}
