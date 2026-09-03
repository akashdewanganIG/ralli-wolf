import { Prisma } from "@prisma/client";
import { prisma } from "@repo/db";
import { isValidEmail, normalizeEmail } from "../utils/validators.js";

type JsonRecord = Record<string, unknown>;

export type BrevoEngagementEvent =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "unsubscribed"
  | "spam";

export interface ParsedBrevoWebhookEvent {
  event: BrevoEngagementEvent | null;
  rawEvent: string;
  email: string | null;
  campaignExternalId: number | null;
  providerEventId: string | null;
  occurredAt: Date;
  suppressEmail: boolean;
}

export interface BrevoWebhookIngestionResult {
  received: number;
  recognized: number;
  matchedLeads: number;
  analyticsCreated: number;
}

export class BrevoWebhookPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrevoWebhookPayloadError";
  }
}

const SCORE_CHANGES: Readonly<Record<BrevoEngagementEvent, number>> = {
  sent: 0,
  delivered: 2,
  opened: 5,
  clicked: 10,
  bounced: -5,
  unsubscribed: -10,
  spam: -15,
};

const SUPPRESSING_EVENTS = new Set([
  "hard_bounce",
  "hard_bounced",
  "blocked",
  "invalid",
  "unsubscribe",
  "unsubscribed",
  "spam",
  "complaint",
]);

function isPlainRecord(value: unknown): value is JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalEvent(rawEvent: string): BrevoEngagementEvent | null {
  const normalized = rawEvent
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  switch (normalized) {
    case "request":
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "opened":
    case "unique_opened":
    case "proxy_open":
    case "unique_proxy_open":
      return "opened";
    case "click":
    case "clicked":
      return "clicked";
    case "hard_bounce":
    case "hard_bounced":
    case "soft_bounce":
    case "soft_bounced":
    case "bounced":
    case "blocked":
    case "invalid":
    case "deferred":
    case "error":
      return "bounced";
    case "unsubscribe":
    case "unsubscribed":
      return "unsubscribed";
    case "spam":
    case "complaint":
      return "spam";
    default:
      return null;
  }
}

function optionalPositiveInteger(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (
    typeof value !== "number" &&
    !(typeof value === "string" && /^\d+$/.test(value.trim()))
  ) {
    throw new BrevoWebhookPayloadError(`${label} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new BrevoWebhookPayloadError(`${label} must be a positive integer`);
  }
  return parsed;
}

function optionalIdentifier(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") {
    throw new BrevoWebhookPayloadError(
      "Webhook event ID must be text or a number"
    );
  }
  const normalized = String(value).trim();
  if (!normalized || normalized.length > 200) {
    throw new BrevoWebhookPayloadError(
      "Webhook event ID cannot exceed 200 characters"
    );
  }
  return normalized;
}

function eventDate(record: JsonRecord, receivedAt: Date): Date {
  const rawTimestamp = record.ts_event ?? record.ts;
  if (typeof rawTimestamp === "number" && Number.isFinite(rawTimestamp)) {
    const milliseconds =
      rawTimestamp > 10_000_000_000 ? rawTimestamp : rawTimestamp * 1_000;
    const parsed = new Date(milliseconds);
    const earliest = Date.UTC(2000, 0, 1);
    const latest = receivedAt.getTime() + 24 * 60 * 60 * 1_000;
    if (parsed.getTime() >= earliest && parsed.getTime() <= latest) {
      return parsed;
    }
  }
  return receivedAt;
}

function parseEvent(
  value: unknown,
  receivedAt: Date,
  index: number
): ParsedBrevoWebhookEvent {
  if (!isPlainRecord(value)) {
    throw new BrevoWebhookPayloadError(`Event ${index + 1} must be an object`);
  }
  if (Object.keys(value).length > 100) {
    throw new BrevoWebhookPayloadError(
      `Event ${index + 1} cannot exceed 100 fields`
    );
  }
  if (typeof value.event !== "string" || !value.event.trim()) {
    throw new BrevoWebhookPayloadError(
      `Event ${index + 1} must include an event name`
    );
  }
  const rawEvent = value.event
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (rawEvent.length > 80) {
    throw new BrevoWebhookPayloadError("Event name is too long");
  }
  const event = canonicalEvent(rawEvent);

  let email: string | null = null;
  if (event) {
    if (typeof value.email !== "string") {
      throw new BrevoWebhookPayloadError(
        `Event ${index + 1} must include an email address`
      );
    }
    email = normalizeEmail(value.email);
    if (!email || !isValidEmail(email)) {
      throw new BrevoWebhookPayloadError(
        `Event ${index + 1} has an invalid email address`
      );
    }
  }

  const campaignExternalId = optionalPositiveInteger(
    value.camp_id ?? value.campaign_id,
    "Campaign ID"
  );
  const bounceType =
    typeof value.bounce_type === "string"
      ? value.bounce_type.trim().toLowerCase()
      : null;

  return {
    event,
    rawEvent,
    email,
    campaignExternalId,
    providerEventId: optionalIdentifier(value.id),
    occurredAt: eventDate(value, receivedAt),
    suppressEmail:
      SUPPRESSING_EVENTS.has(rawEvent) ||
      (rawEvent === "bounced" && bounceType === "hard"),
  };
}

export function parseBrevoWebhookPayload(
  payload: unknown,
  receivedAt = new Date()
): ParsedBrevoWebhookEvent[] {
  const values = Array.isArray(payload) ? payload : [payload];
  if (!values.length || values.length > 500) {
    throw new BrevoWebhookPayloadError(
      "Webhook must contain between 1 and 500 events"
    );
  }
  return values.map((value, index) => parseEvent(value, receivedAt, index));
}

export function brevoEngagementScore(event: BrevoEngagementEvent): number {
  return SCORE_CHANGES[event];
}

export async function ingestBrevoWebhookEvents(
  events: readonly ParsedBrevoWebhookEvent[]
): Promise<BrevoWebhookIngestionResult> {
  const recognized = events.filter(
    (
      event
    ): event is ParsedBrevoWebhookEvent & {
      event: BrevoEngagementEvent;
      email: string;
    } => event.event !== null && event.email !== null
  );
  if (!recognized.length) {
    return {
      received: events.length,
      recognized: 0,
      matchedLeads: 0,
      analyticsCreated: 0,
    };
  }

  const emails = [...new Set(recognized.map(event => event.email))];
  const externalIds = [
    ...new Set(
      recognized
        .map(event => event.campaignExternalId)
        .filter((id): id is number => id !== null)
        .map(String)
    ),
  ];

  const campaignChannels = externalIds.length
    ? await prisma.campaignChannel.findMany({
        where: { channelType: "brevo", externalId: { in: externalIds } },
        select: { externalId: true, campaignId: true },
      })
    : [];
  const campaignByExternalId = new Map(
    campaignChannels.map(channel => [channel.externalId, channel.campaignId])
  );

  return prisma.$transaction(async tx => {
    await tx.$queryRaw`
      SELECT id
      FROM leads
      WHERE email IN (${Prisma.join(emails)})
        AND deleted_at IS NULL
      FOR UPDATE
    `;
    const leads = await tx.lead.findMany({
      where: { email: { in: emails }, deletedAt: null },
      select: {
        id: true,
        email: true,
        score: true,
        emailOptOut: true,
      },
      orderBy: { id: "asc" },
    });
    const leadsByEmail = new Map<string, typeof leads>();
    for (const lead of leads) {
      const normalized = normalizeEmail(lead.email);
      if (!normalized) continue;
      const matches = leadsByEmail.get(normalized) ?? [];
      matches.push(lead);
      leadsByEmail.set(normalized, matches);
    }

    let matchedLeads = 0;
    const analyticsData: Prisma.AnalyticsEventCreateManyInput[] = [];
    for (const [email, matched] of leadsByEmail) {
      const emailEvents = recognized.filter(event => event.email === email);
      const scoreDelta = emailEvents.reduce(
        (total, event) => total + brevoEngagementScore(event.event),
        0
      );
      const suppressingEvents = emailEvents.filter(
        event => event.suppressEmail
      );
      const latestSuppression = suppressingEvents.reduce<Date | null>(
        (latest, event) =>
          !latest || event.occurredAt > latest ? event.occurredAt : latest,
        null
      );

      for (const lead of matched) {
        matchedLeads += 1;
        const nextScore = Math.max(0, Math.min(100, lead.score + scoreDelta));
        if (
          nextScore !== lead.score ||
          (latestSuppression && !lead.emailOptOut)
        ) {
          await tx.lead.update({
            where: { id: lead.id },
            data: {
              score: nextScore,
              ...(latestSuppression
                ? { emailOptOut: true, optOutDate: latestSuppression }
                : {}),
            },
          });
        }

        for (const event of emailEvents) {
          if (event.campaignExternalId === null) continue;
          const campaignId = campaignByExternalId.get(
            String(event.campaignExternalId)
          );
          if (!campaignId) continue;
          analyticsData.push({
            campaignId,
            leadId: lead.id,
            eventType: `brevo_${event.event}`,
            occurredAt: event.occurredAt,
            eventData: {
              providerEvent: event.rawEvent,
              providerEventId: event.providerEventId,
              externalCampaignId: event.campaignExternalId,
              timestamp: event.occurredAt.toISOString(),
            },
          });
        }
      }
    }

    if (analyticsData.length > 5_000) {
      throw new Error("Brevo webhook expands beyond the safe analytics limit");
    }
    if (analyticsData.length) {
      await tx.analyticsEvent.createMany({ data: analyticsData });
    }

    return {
      received: events.length,
      recognized: recognized.length,
      matchedLeads,
      analyticsCreated: analyticsData.length,
    };
  });
}
