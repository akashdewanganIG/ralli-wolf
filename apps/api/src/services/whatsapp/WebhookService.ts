import { prisma } from "@repo/db";
import { CampaignDeliveryStatus, Prisma } from "@prisma/client";
import { OptOutService } from "./OptOutService.js";

type Msg91WebhookPayload = {
  [key: string]: unknown;
  data?: Record<string, unknown>;
};

export class WhatsappWebhookService {
  /**
   * Handle inbound messages from MSG91 (e.g., STOP messages for opt-outs)
   */
  async handleMsg91InboundMessage(payload: Msg91WebhookPayload) {
    console.log("=== MSG91 Inbound Message Received ===");
    console.log("Full payload:", JSON.stringify(payload, null, 2));

    // Extract phone number - MSG91 sends this as 'customerNumber' for inbound messages
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

    // Extract message text
    const messageText =
      this.getStringValue(payload, "text") ||
      this.getStringValue(payload, "message") ||
      this.getStringValue(payload, "body") ||
      this.getStringValue(payload.data, "text") ||
      this.getStringValue(payload.data, "message") ||
      this.getStringValue(payload.data, "body") ||
      "";

    console.log("Phone Number:", phoneNumber);
    console.log("Message Text:", messageText);

    if (!phoneNumber) {
      console.warn("⚠️ No phone number found in inbound message payload");
      return { success: false, message: "No phone number found in payload" };
    }

    const normalizedPhone = this.normalizePhone(phoneNumber);
    console.log("Normalized Phone:", normalizedPhone);

    // Check if message is a STOP command (case-insensitive)
    const stopKeywords = [
      "stop",
      "unsubscribe",
      "optout",
      "opt-out",
      "opt out",
      "cancel",
    ];
    const isStopMessage = stopKeywords.some(
      keyword =>
        messageText.toLowerCase().trim() === keyword ||
        messageText.toLowerCase().includes(keyword)
    );

    if (!isStopMessage) {
      console.log("ℹ️ Message is not a STOP command. Ignoring.");
      return {
        success: true,
        message: "Message is not a STOP command",
        isOptOut: false,
      };
    }

    console.log("🛑 STOP message detected. Processing opt-out...");

    // Store webhook event
    await prisma.webhookEvent.create({
      data: {
        provider: "MSG91",
        eventType: "inbound_stop_message",
        payload: payload as Prisma.InputJsonValue,
        correlationId: normalizedPhone,
      },
    });

    // Find contact or lead by phone number
    console.log("🔍 Searching for contact/lead with phone:", normalizedPhone);

    // Try different phone number formats
    const phoneVariants = [
      normalizedPhone,
      normalizedPhone.replace(/^91/, ""), // Without country code
      `91${normalizedPhone.replace(/^91/, "")}`, // With 91 prefix
      `+91${normalizedPhone.replace(/^91/, "")}`, // With +91 prefix
    ].filter(Boolean);

    console.log("🔍 Trying phone variants:", phoneVariants);

    // Try to find contact first
    const contact = await prisma.contact.findFirst({
      where: { phone: { in: phoneVariants as string[] } },
      select: { id: true, name: true, email: true, phone: true },
    });

    // If no contact, try to find lead
    let lead = null;
    if (!contact) {
      lead = await prisma.lead.findFirst({
        where: { phone: { in: phoneVariants as string[] } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      });
    }

    const userName =
      contact?.name ||
      (lead ? `${lead.firstName} ${lead.lastName || ""}`.trim() : null);
    console.log("👤 Found user:", {
      contactId: contact?.id,
      contactPhone: contact?.phone,
      leadId: lead?.id,
      leadPhone: lead?.phone,
      name: userName,
    });

    // Add to opt-out list
    const optOutService = new OptOutService();
    try {
      await optOutService.addOptOut({
        phone: normalizedPhone,
        channel: "whatsapp",
        source: "inbound_message",
        reason: `User sent STOP message: "${messageText}"`,
        metadata: payload as Prisma.InputJsonValue,
      });

      console.log(`✅ Successfully opted out phone: ${normalizedPhone}`);

      // Create analytics event linked to the user's timeline
      // This will make it appear in the Lead/Contact detail page activity section
      if (contact || lead) {
        console.log("📊 Creating analytics event for user timeline...");

        // We need a campaignId for analytics events, but for STOP messages we don't have one
        // So we'll create a special "system" campaign or find the most recent campaign they were in
        let campaignId: number | null = null;

        // Try to find the most recent campaign delivery for this user
        const recentDelivery = await prisma.campaignDelivery.findFirst({
          where: {
            address: normalizedPhone,
            channel: "whatsapp",
          },
          orderBy: { createdAt: "desc" },
          select: { campaignId: true, campaign: { select: { name: true } } },
        });

        if (recentDelivery) {
          campaignId = recentDelivery.campaignId;
          console.log(
            `📧 Found recent campaign: ${recentDelivery.campaign?.name} (ID: ${campaignId})`
          );
        } else {
          // If no campaign found, we need to create a dummy campaign for system events
          // Check if we already have a system campaign
          let systemCampaign = await prisma.campaign.findFirst({
            where: { name: "System Events" },
            select: { id: true },
          });

          if (!systemCampaign) {
            console.log("🔧 Creating system campaign for opt-out events...");
            systemCampaign = await prisma.campaign.create({
              data: {
                name: "System Events",
                description:
                  "System-generated events (opt-outs, unsubscribes, etc.)",
                createdBy: 1, // System user ID - adjust if needed
                startDate: new Date(),
                campaignChannels: {
                  create: {
                    channelType: "whatsapp",
                    externalId: "system",
                  },
                },
              },
              select: { id: true },
            });
          }

          campaignId = systemCampaign.id;
          console.log(`🔧 Using system campaign ID: ${campaignId}`);
        }

        // Create the analytics event that will appear in the activity timeline
        const analyticsEvent = await prisma.analyticsEvent.create({
          data: {
            campaignId: campaignId,
            contactId: contact?.id || null,
            leadId: lead?.id || null,
            eventType: "whatsapp.opted_out_stop_message",
            eventData: {
              source: "inbound_stop_message",
              reason: `User sent STOP message: "${messageText}"`,
              phone: normalizedPhone,
              userName: userName || "Unknown User",
              timestamp: new Date().toISOString(),
              messageText: messageText,
            },
          },
        });

        console.log(
          `✅ Created analytics event for ${contact ? "contact" : "lead"} ID: ${contact?.id || lead?.id}`
        );
        console.log("📊 Analytics event details:", {
          id: analyticsEvent.id,
          campaignId: analyticsEvent.campaignId,
          contactId: analyticsEvent.contactId,
          leadId: analyticsEvent.leadId,
          eventType: analyticsEvent.eventType,
          occurredAt: analyticsEvent.occurredAt,
        });
      } else {
        console.log(
          "⚠️  No contact or lead found for phone number. Opt-out recorded but no activity timeline entry created."
        );
      }

      return {
        success: true,
        message: "User opted out successfully",
        isOptOut: true,
        phone: normalizedPhone,
        userId: contact?.id || lead?.id,
        userType: contact ? "contact" : lead ? "lead" : null,
        userName: userName,
      };
    } catch (error) {
      console.error("❌ Failed to opt out user:", error);
      return {
        success: false,
        message: "Failed to process opt-out",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async handleMsg91Event(payload: Msg91WebhookPayload) {
    // MSG91 uses 'eventName' for status (sent, delivered, read, failed)
    const eventType = String(
      payload?.eventName || payload?.event || payload?.status || "unknown"
    ).toLowerCase();

    const correlationId =
      this.getStringValue(payload, "requestId") ||
      this.getStringValue(payload, "request_id") ||
      this.getStringValue(payload, "campaign_request_id") ||
      this.getStringValue(payload, "uuid") ||
      this.getStringValue(payload, "message_uuid") ||
      this.getStringValue(payload, "id");

    // Extract customer phone number - MSG91 sends this to identify which recipient
    const customerNumber =
      this.getStringValue(payload, "customerNumber") ||
      this.getStringValue(payload, "customer_number") ||
      this.getStringValue(payload, "to") ||
      this.getStringValue(payload, "recipient") ||
      this.getStringValue(payload.data, "customerNumber") ||
      this.getStringValue(payload.data, "customer_number");

    console.log("=== MSG91 Webhook Received ===");
    console.log("Event type:", eventType);
    console.log("Correlation ID:", correlationId);
    console.log("Customer Number:", customerNumber);
    console.log("Full payload:", JSON.stringify(payload, null, 2));

    const stored = await prisma.webhookEvent.create({
      data: {
        provider: "MSG91",
        eventType,
        payload: payload as Prisma.InputJsonValue,
        correlationId: correlationId || undefined,
      },
    });

    const providerIds = this.extractProviderIds(payload);
    console.log("Extracted provider IDs:", providerIds);

    if (!providerIds.length) {
      console.log("No provider IDs found in payload");
      return { storedId: stored.id, matched: 0 };
    }

    // Build query - match by providerMessageId AND phone number if available
    const whereClause: Prisma.CampaignDeliveryWhereInput = {
      providerMessageId: { in: providerIds },
    };

    // If we have a customer number, match by that too to avoid updating all deliveries in a batch
    if (customerNumber) {
      const normalizedPhone = this.normalizePhone(customerNumber);
      console.log("Normalized phone for matching:", normalizedPhone);
      whereClause.address = normalizedPhone;
    }

    // First try exact match
    let deliveries = await prisma.campaignDelivery.findMany({
      where: whereClause,
    });

    // If no exact match and we have a phone number, try partial matching
    if (!deliveries.length && customerNumber) {
      const normalizedPhone = this.normalizePhone(customerNumber);
      // Try matching with different phone formats
      const phoneVariants = [
        normalizedPhone,
        normalizedPhone?.replace(/^91/, ""), // Without country code
        `91${normalizedPhone?.replace(/^91/, "")}`, // With 91 prefix
        `+91${normalizedPhone?.replace(/^91/, "")}`, // With +91 prefix
      ].filter(Boolean);

      console.log("Trying phone variants:", phoneVariants);

      deliveries = await prisma.campaignDelivery.findMany({
        where: {
          providerMessageId: { in: providerIds },
          address: { in: phoneVariants as string[] },
        },
      });
    }

    console.log("Found deliveries:", deliveries.length);
    if (deliveries.length > 0) {
      console.log(
        "First delivery contactId:",
        deliveries[0]?.contactId,
        "leadId:",
        deliveries[0]?.leadId
      );
    }

    if (!deliveries.length) {
      console.log(
        "No matching deliveries found for provider IDs:",
        providerIds,
        "and phone:",
        customerNumber
      );
      return { storedId: stored.id, matched: 0 };
    }

    const statusUpdate = this.mapStatus(eventType);
    console.log("Status update:", statusUpdate);

    // MSG91 uses 'reason' for failure details
    const errorMessage =
      this.getStringValue(payload, "reason") ||
      this.getStringValue(payload, "error") ||
      this.getStringValue(payload, "description") ||
      null;

    await Promise.all(
      deliveries.map(delivery => {
        // Only update status if new status is "higher" in progression
        // Progression: PENDING(0) → QUEUED(1) → SENT(2) → DELIVERED(3) → READ(4), FAILED(-1), OPTED_OUT(-2)
        const currentRank = this.getStatusRank(delivery.status);
        const newRank = this.getStatusRank(statusUpdate.status);

        // Don't downgrade status (except FAILED and OPTED_OUT can override anything)
        const shouldUpdateStatus =
          statusUpdate.status === CampaignDeliveryStatus.FAILED ||
          statusUpdate.status === CampaignDeliveryStatus.OPTED_OUT ||
          newRank > currentRank;

        console.log(
          `Delivery ${delivery.id}: current=${delivery.status}(${currentRank}), new=${statusUpdate.status}(${newRank}), shouldUpdate=${shouldUpdateStatus}`
        );

        return prisma.campaignDelivery.update({
          where: { id: delivery.id },
          data: {
            // Only update status if it's a progression forward (or FAILED/OPTED_OUT)
            ...(shouldUpdateStatus && { status: statusUpdate.status }),
            // Always update timestamps when we receive them
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
            webhookPayload: payload as Prisma.InputJsonValue,
          },
        });
      })
    );

    // Handle opt-outs by creating OptOut records
    if (statusUpdate.status === CampaignDeliveryStatus.OPTED_OUT) {
      const optOutService = new OptOutService();

      await Promise.all(
        deliveries.map(async delivery => {
          const phone = delivery.address;

          if (phone) {
            try {
              await optOutService.addOptOut({
                phone,
                channel: "whatsapp",
                source: "webhook",
                campaignId: delivery.campaignId,
                reason: errorMessage || "User opted out via MSG91 webhook",
                metadata: payload as Prisma.InputJsonValue,
              });

              console.log(
                `✓ Added opt-out for phone: ${phone} from campaign: ${delivery.campaignId}`
              );
            } catch (error) {
              console.error(
                `✗ Failed to add opt-out for phone: ${phone}`,
                error
              );
            }
          }
        })
      );
    }

    // Fetch campaign names for activity logging
    const campaignIds = [...new Set(deliveries.map(d => d.campaignId))];
    const campaigns = await prisma.campaign.findMany({
      where: { id: { in: campaignIds } },
      select: { id: true, name: true },
    });
    const campaignNameMap = new Map(campaigns.map(c => [c.id, c.name]));

    // Fetch leads that were converted to these contacts (to also log activity on leads)
    const contactIds = deliveries
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

    await Promise.all(
      deliveries.map(delivery => {
        // Get leadId either from delivery or from the converted contact
        const leadId =
          delivery.leadId ||
          (delivery.contactId
            ? contactToLeadMap.get(delivery.contactId)
            : null) ||
          null;

        return prisma.analyticsEvent.create({
          data: {
            campaignId: delivery.campaignId,
            contactId: delivery.contactId,
            leadId: leadId,
            eventType: `whatsapp.${statusUpdate.label}`,
            eventData: {
              campaignName:
                campaignNameMap.get(delivery.campaignId) || "Unknown Campaign",
              status: statusUpdate.label,
              address: delivery.address,
              timestamp: new Date().toISOString(),
              ...(payload as Record<string, unknown>),
            },
          },
        });
      })
    );

    return { storedId: stored.id, matched: deliveries.length };
  }

  // Normalize phone number to match what's stored in the database
  private normalizePhone(phone: string): string {
    // Remove all non-digit characters except leading +
    let normalized = phone.replace(/[^\d+]/g, "");
    // Ensure it starts with country code (assume 91 for India if not present)
    if (normalized.startsWith("+")) {
      normalized = normalized.substring(1);
    }
    // If it's 10 digits, assume it's Indian and add 91
    if (normalized.length === 10) {
      normalized = "91" + normalized;
    }
    return normalized;
  }

  private extractProviderIds(payload: Msg91WebhookPayload): string[] {
    const ids: string[] = [];
    // MSG91 may send various ID fields - check all of them
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
    // Also check nested data object
    const dataRequestId = this.getStringValue(payload.data, "request_id");
    if (dataRequestId) {
      ids.push(dataRequestId);
    }
    const dataUuid = this.getStringValue(payload.data, "uuid");
    if (dataUuid) {
      ids.push(dataUuid);
    }
    return [...new Set(ids.filter(Boolean))]; // Remove duplicates
  }

  private mapStatus(eventType: string) {
    switch (eventType) {
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
        return { status: CampaignDeliveryStatus.QUEUED, label: "queued" };
    }
  }

  // Get numeric rank for status progression comparison
  // Higher rank = further along in the delivery lifecycle
  private getStatusRank(status: CampaignDeliveryStatus): number {
    switch (status) {
      case CampaignDeliveryStatus.PENDING:
        return 0;
      case CampaignDeliveryStatus.QUEUED:
        return 1;
      case CampaignDeliveryStatus.SENT:
        return 2;
      case CampaignDeliveryStatus.DELIVERED:
        return 3;
      case CampaignDeliveryStatus.READ:
        return 4;
      case CampaignDeliveryStatus.FAILED:
        return -1; // Special case - handled separately
      case CampaignDeliveryStatus.OPTED_OUT:
        return -2; // Special case
      default:
        return 0;
    }
  }
  private getStringValue(
    source: Record<string, unknown> | undefined,
    key: string
  ): string | null {
    if (!source) return null;
    const value = source[key];
    return typeof value === "string" && value ? value : null;
  }
}
