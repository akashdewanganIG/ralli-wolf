import { Prisma } from "@prisma/client";
import { LeadSource, LeadStatus, prisma } from "@repo/db";
import {
  isValidEmail,
  isValidName,
  isValidPhone,
  isValidPincode,
  normalizeEmail,
} from "../utils/validators.js";
import { logWarn } from "../utils/logger.js";

type JsonRecord = Record<string, unknown>;
type StoredJsonValue = Prisma.InputJsonValue | null;

const MAX_TOP_LEVEL_KEYS = 100;
const MAX_STORED_JSON_NODES = 1_000;
const MAX_STORED_PAYLOAD_BYTES = 64 * 1024;
const FORBIDDEN_OBJECT_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

const CONTACT_FIELD_KEYS = new Set(
  [
    "firstName",
    "first_name",
    "lastName",
    "last_name",
    "name",
    "email",
    "phone",
    "phone_number",
    "telephone",
    "company",
    "company_name",
    "organization",
    "business_name",
    "city",
    "state",
    "pincode",
    "pin_code",
    "zipcode",
    "zip_code",
    "campaign_id",
    "campaignId",
    "landing_page_campaign_id",
    "landingPageCampaignId",
    "lpCampaignId",
  ].map(key => key.toLowerCase())
);

const ENVELOPE_KEYS = new Set([
  "form_submission",
  "custom_fields",
  "lead",
  "campaign",
  "landing_page",
]);

export class LandingiPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LandingiPayloadError";
  }
}

export interface LandingiLeadInput {
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  companyName: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export interface ParsedLandingiPayload {
  lead: LandingiLeadInput;
  campaignUniqueId: string | null;
  customFields: Prisma.InputJsonObject | null;
  storedPayload: Prisma.InputJsonObject;
  receivedKeys: string[];
}

export interface LandingiIngestionResult {
  leadId: number;
  leadCreated: boolean;
  enquiryId: number;
  formSubmissionId: number;
  receivedKeys: string[];
}

function isPlainRecord(value: unknown): value is JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function nestedRecord(payload: JsonRecord, key: string): JsonRecord | null {
  if (!hasOwn(payload, key) || payload[key] == null) return null;
  if (!isPlainRecord(payload[key])) {
    throw new LandingiPayloadError(`${key} must be a JSON object`);
  }
  return payload[key];
}

function optionalText(
  sources: readonly JsonRecord[],
  keys: readonly string[],
  label: string,
  maximumLength: number
): string | null {
  for (const source of sources) {
    for (const key of keys) {
      if (!hasOwn(source, key) || source[key] == null) continue;
      const value = source[key];
      if (typeof value !== "string") {
        throw new LandingiPayloadError(`${label} must be a string`);
      }
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (trimmed.length > maximumLength) {
        throw new LandingiPayloadError(
          `${label} cannot exceed ${maximumLength} characters`
        );
      }
      return trimmed;
    }
  }
  return null;
}

function optionalIdentifier(
  sources: readonly JsonRecord[],
  keys: readonly string[]
): string | null {
  for (const source of sources) {
    for (const key of keys) {
      if (!hasOwn(source, key) || source[key] == null) continue;
      const value = source[key];
      if (
        typeof value !== "string" &&
        !(typeof value === "number" && Number.isSafeInteger(value))
      ) {
        throw new LandingiPayloadError(
          "Landing-page campaign ID must be a string or integer"
        );
      }
      const normalized = String(value).trim();
      if (!normalized) continue;
      if (normalized.length > 191) {
        throw new LandingiPayloadError(
          "Landing-page campaign ID cannot exceed 191 characters"
        );
      }
      return normalized;
    }
  }
  return null;
}

function optionalPincode(sources: readonly JsonRecord[]): string | null {
  for (const source of sources) {
    for (const key of ["pincode", "pin_code", "zipcode", "zip_code"]) {
      if (!hasOwn(source, key) || source[key] == null) continue;
      const value = source[key];
      if (
        typeof value !== "string" &&
        !(typeof value === "number" && Number.isSafeInteger(value))
      ) {
        throw new LandingiPayloadError("Pincode must be a string or integer");
      }
      const normalized = String(value).trim();
      if (!normalized) continue;
      return normalized;
    }
  }
  return null;
}

function normalizeLocalPhone(phone: string | null): string | null {
  if (!phone) return null;
  if (!/^\+?[\d\s().-]+$/.test(phone)) {
    throw new LandingiPayloadError("Phone contains unsupported characters");
  }
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (!isValidPhone(digits) || /^0+$/.test(digits)) {
    throw new LandingiPayloadError("Phone must resolve to exactly 10 digits");
  }
  return digits;
}

function maskEmail(email: string): string {
  const separator = email.lastIndexOf("@");
  if (separator <= 0) return "***";
  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

function maskPhone(phone: string | null): string | null {
  return phone ? `***${phone.slice(-4)}` : null;
}

function sanitizeJsonValue(
  value: unknown,
  budget: { remaining: number },
  depth = 0
): StoredJsonValue {
  if (budget.remaining <= 0) return "[truncated]";
  budget.remaining -= 1;

  if (value === null) return null;
  if (typeof value === "string") {
    return value.length > 2_000
      ? `${value.slice(0, 2_000)}... [truncated]`
      : value;
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : "[invalid number]";
  }
  if (depth >= 6) return "[maximum depth reached]";
  if (Array.isArray(value)) {
    return value
      .slice(0, 100)
      .map(item => sanitizeJsonValue(item, budget, depth + 1));
  }
  if (!isPlainRecord(value)) return String(value);

  const sanitized: Record<string, StoredJsonValue> = {};
  for (const [key, child] of Object.entries(value).slice(0, 100)) {
    if (FORBIDDEN_OBJECT_KEYS.has(key)) continue;
    const safeKey = key.length > 100 ? key.slice(0, 100) : key;
    sanitized[safeKey] = sanitizeJsonValue(child, budget, depth + 1);
    if (budget.remaining <= 0) break;
  }
  return sanitized as Prisma.InputJsonObject;
}

export function sanitizeLandingiPayload(
  payload: JsonRecord
): Prisma.InputJsonObject {
  const sanitized = sanitizeJsonValue(payload, {
    remaining: MAX_STORED_JSON_NODES,
  });
  const safeObject = isPlainRecord(sanitized) ? sanitized : {};
  const encoded = JSON.stringify(safeObject);
  if (Buffer.byteLength(encoded, "utf8") <= MAX_STORED_PAYLOAD_BYTES) {
    return safeObject as Prisma.InputJsonObject;
  }
  return {
    _truncated: true,
    originalBytes: Buffer.byteLength(JSON.stringify(payload), "utf8"),
    keys: Object.keys(payload).slice(0, MAX_TOP_LEVEL_KEYS),
    preview: encoded.slice(0, MAX_STORED_PAYLOAD_BYTES - 1_024),
  };
}

function extractCustomFields(
  payload: JsonRecord,
  formSubmission: JsonRecord | null,
  customFieldEnvelope: JsonRecord | null
): Prisma.InputJsonObject | null {
  const customFields: Record<string, StoredJsonValue> = {};
  const budget = { remaining: 500 };

  const extractFrom = (source: JsonRecord | null) => {
    if (!source) return;
    for (const [key, value] of Object.entries(source)) {
      if (
        FORBIDDEN_OBJECT_KEYS.has(key) ||
        CONTACT_FIELD_KEYS.has(key.toLowerCase())
      ) {
        continue;
      }
      customFields[key.slice(0, 100)] = sanitizeJsonValue(value, budget);
      if (budget.remaining <= 0) break;
    }
  };

  extractFrom(formSubmission);
  extractFrom(customFieldEnvelope);
  for (const [key, value] of Object.entries(payload)) {
    if (
      FORBIDDEN_OBJECT_KEYS.has(key) ||
      ENVELOPE_KEYS.has(key) ||
      CONTACT_FIELD_KEYS.has(key.toLowerCase())
    ) {
      continue;
    }
    customFields[key.slice(0, 100)] = sanitizeJsonValue(value, budget);
    if (budget.remaining <= 0) break;
  }

  return Object.keys(customFields).length
    ? (customFields as Prisma.InputJsonObject)
    : null;
}

export function parseLandingiPayload(payload: unknown): ParsedLandingiPayload {
  if (!isPlainRecord(payload)) {
    throw new LandingiPayloadError("Webhook body must be a JSON object");
  }
  const receivedKeys = Object.keys(payload);
  if (!receivedKeys.length) {
    throw new LandingiPayloadError("Webhook body cannot be empty");
  }
  if (receivedKeys.length > MAX_TOP_LEVEL_KEYS) {
    throw new LandingiPayloadError(
      `Webhook body cannot exceed ${MAX_TOP_LEVEL_KEYS} top-level fields`
    );
  }

  const formSubmission = nestedRecord(payload, "form_submission");
  const leadEnvelope = nestedRecord(payload, "lead");
  const customFieldEnvelope = nestedRecord(payload, "custom_fields");
  const sources = [
    formSubmission,
    leadEnvelope,
    customFieldEnvelope,
    payload,
  ].filter((source): source is JsonRecord => source !== null);

  const explicitFirstName = optionalText(
    sources,
    ["firstName", "first_name"],
    "First name",
    255
  );
  const fullName = optionalText(sources, ["name"], "Name", 510);
  let firstName = explicitFirstName;
  let inferredLastName: string | null = null;
  if (!firstName && fullName) {
    const [first, ...remaining] = fullName.split(/\s+/);
    firstName = first || null;
    inferredLastName = remaining.join(" ") || null;
  }
  const lastName =
    optionalText(sources, ["lastName", "last_name"], "Last name", 255) ??
    inferredLastName;

  const rawEmail = optionalText(sources, ["email"], "Email", 254);
  const email = normalizeEmail(rawEmail);
  const rawPhone = optionalText(
    sources,
    ["phone", "phone_number", "telephone"],
    "Phone",
    40
  );
  const phone = normalizeLocalPhone(rawPhone);
  const companyName = optionalText(
    sources,
    ["company", "company_name", "organization", "business_name"],
    "Company name",
    255
  );
  const city = optionalText(sources, ["city"], "City", 100);
  const state = optionalText(sources, ["state"], "State", 100);
  const pincode = optionalPincode(sources);

  if (!firstName || !isValidName(firstName)) {
    throw new LandingiPayloadError("A valid first name is required");
  }
  if (!email || !isValidEmail(email)) {
    throw new LandingiPayloadError("A valid email is required");
  }
  if (lastName && !isValidName(lastName)) {
    throw new LandingiPayloadError("Last name is invalid");
  }
  if (pincode && !isValidPincode(pincode)) {
    throw new LandingiPayloadError("Pincode must be exactly 6 digits");
  }

  const campaignUniqueId = optionalIdentifier(
    [payload, formSubmission ?? {}, customFieldEnvelope ?? {}],
    [
      "landing_page_campaign_id",
      "campaign_id",
      "campaignId",
      "landingPageCampaignId",
      "lpCampaignId",
    ]
  );
  const customFields = extractCustomFields(
    payload,
    formSubmission,
    customFieldEnvelope
  );
  const storedPayload = sanitizeLandingiPayload(payload);

  return {
    lead: {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      city,
      state,
      pincode,
    },
    campaignUniqueId,
    customFields,
    storedPayload,
    receivedKeys,
  };
}

export async function ingestLandingiPayload(
  payload: unknown,
  now = new Date()
): Promise<LandingiIngestionResult> {
  const parsed = parseLandingiPayload(payload);

  return prisma.$transaction(async tx => {
    const lockKey = `landingi-lead:${parsed.lead.email}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

    const landingPageCampaign = parsed.campaignUniqueId
      ? await tx.landingPageCampaign.findUnique({
          where: { uniqueId: parsed.campaignUniqueId },
          select: { id: true },
        })
      : null;
    if (parsed.campaignUniqueId && !landingPageCampaign) {
      logWarn("landingi_campaign_not_found", {
        campaignUniqueId: parsed.campaignUniqueId,
      });
    }

    let lead = await tx.lead.findFirst({
      where: { email: parsed.lead.email, deletedAt: null },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (!lead && parsed.lead.phone) {
      lead = await tx.lead.findFirst({
        where: { phone: parsed.lead.phone, deletedAt: null },
        orderBy: { id: "asc" },
        select: { id: true },
      });
    }

    const leadCreated = !lead;
    if (!lead) {
      lead = await tx.lead.create({
        data: {
          ...parsed.lead,
          source: LeadSource.LANDING_PAGE,
          status: LeadStatus.OPEN,
          score: 0,
        },
        select: { id: true },
      });
    }

    const enquiry = await tx.enquiry.create({
      data: {
        leadId: lead.id,
        landingPageCampaignId: landingPageCampaign?.id ?? null,
        customFields: parsed.customFields ?? Prisma.DbNull,
        status: "UNRESOLVED",
      },
      select: { id: true },
    });

    const formSubmission = await tx.formSubmission.create({
      data: {
        leadId: lead.id,
        contactId: null,
        submittedAt: now,
        formData: {
          webhookSummary: {
            keys: parsed.receivedKeys,
            sample: {
              email: maskEmail(parsed.lead.email),
              phone: maskPhone(parsed.lead.phone),
            },
          },
          webhookData: parsed.storedPayload,
          extractedAt: now.toISOString(),
          source: "Landingi Webhook",
        },
      },
      select: { id: true },
    });

    return {
      leadId: lead.id,
      leadCreated,
      enquiryId: enquiry.id,
      formSubmissionId: formSubmission.id,
      receivedKeys: parsed.receivedKeys,
    };
  });
}
