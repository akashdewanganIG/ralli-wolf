import type { BrevoUpdateCampaignRequest } from "../utils/brevo.types.js";
import {
  isValidEmail,
  parseIsoDate,
  parseUniquePositiveIntegerArray,
} from "../utils/validators.js";

type JsonRecord = Record<string, unknown>;

export const BREVO_CAMPAIGN_STATUSES = [
  "draft",
  "sent",
  "archive",
  "queued",
  "suspended",
  "in_process",
] as const;

export const BREVO_STATUS_ACTIONS = [
  "suspended",
  "archive",
  "darchive",
  "sent",
  "queued",
  "replicate",
  "replicateTemplate",
  "cancel",
  "draft",
] as const;

export type BrevoCampaignStatus = (typeof BREVO_CAMPAIGN_STATUSES)[number];
export type BrevoCampaignStatusAction = (typeof BREVO_STATUS_ACTIONS)[number];

export class BrevoRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrevoRequestError";
  }
}

function isPlainRecord(value: unknown): value is JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function parseBrevoCampaignFilterStatus(
  value: unknown
): BrevoCampaignStatus | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new BrevoRequestError("status must be a single string value");
  }
  const status = value.trim().toLowerCase();
  if (!BREVO_CAMPAIGN_STATUSES.some(candidate => candidate === status)) {
    throw new BrevoRequestError(
      `status must be one of: ${BREVO_CAMPAIGN_STATUSES.join(", ")}`
    );
  }
  return status as BrevoCampaignStatus;
}

export function parseBrevoCampaignStatusAction(
  value: unknown
): BrevoCampaignStatusAction {
  if (!isPlainRecord(value)) {
    throw new BrevoRequestError("Request body must be an object");
  }
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "status") {
    throw new BrevoRequestError(
      'Request body must contain only the "status" field'
    );
  }
  if (
    typeof value.status !== "string" ||
    !BREVO_STATUS_ACTIONS.some(candidate => candidate === value.status)
  ) {
    throw new BrevoRequestError(
      `status must be one of: ${BREVO_STATUS_ACTIONS.join(", ")}`
    );
  }
  return value.status as BrevoCampaignStatusAction;
}

function optionalText(
  record: JsonRecord,
  key: string,
  maximumLength: number
): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(record, key)) return undefined;
  const value = record[key];
  if (typeof value !== "string") {
    throw new BrevoRequestError(`${key} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maximumLength) {
    throw new BrevoRequestError(
      `${key} must contain 1 to ${maximumLength} characters`
    );
  }
  return trimmed;
}

export function parseBrevoCampaignUpdate(
  value: unknown
): BrevoUpdateCampaignRequest {
  if (!isPlainRecord(value)) {
    throw new BrevoRequestError("Request body must be an object");
  }
  const allowedKeys = new Set([
    "name",
    "subject",
    "sender",
    "recipients",
    "replyTo",
    "previewText",
    "htmlContent",
    "textContent",
    "scheduledAt",
    "type",
  ]);
  const unknownKey = Object.keys(value).find(key => !allowedKeys.has(key));
  if (unknownKey) {
    throw new BrevoRequestError(`Unsupported campaign field: ${unknownKey}`);
  }

  const update: BrevoUpdateCampaignRequest = {};
  const name = optionalText(value, "name", 255);
  const subject = optionalText(value, "subject", 998);
  const replyTo = optionalText(value, "replyTo", 254);
  const previewText = optionalText(value, "previewText", 255);
  const htmlContent = optionalText(value, "htmlContent", 800_000);
  const textContent = optionalText(value, "textContent", 200_000);
  if (name) update.name = name;
  if (subject) update.subject = subject;
  if (replyTo) {
    if (!isValidEmail(replyTo)) {
      throw new BrevoRequestError("replyTo must be a valid email address");
    }
    update.replyTo = replyTo.toLowerCase();
  }
  if (previewText) update.previewText = previewText;
  if (htmlContent) update.htmlContent = htmlContent;
  if (textContent) update.textContent = textContent;

  if (Object.prototype.hasOwnProperty.call(value, "type")) {
    if (value.type !== "classic" && value.type !== "trigger") {
      throw new BrevoRequestError("type must be classic or trigger");
    }
    update.type = value.type;
  }
  if (Object.prototype.hasOwnProperty.call(value, "scheduledAt")) {
    const scheduledAt = parseIsoDate(value.scheduledAt);
    if (
      !scheduledAt ||
      typeof value.scheduledAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/i.test(value.scheduledAt)
    ) {
      throw new BrevoRequestError(
        "scheduledAt must be a timezone-qualified ISO timestamp"
      );
    }
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BrevoRequestError("scheduledAt must be in the future");
    }
    update.scheduledAt = scheduledAt.toISOString();
  }
  if (Object.prototype.hasOwnProperty.call(value, "sender")) {
    if (!isPlainRecord(value.sender)) {
      throw new BrevoRequestError("sender must be an object");
    }
    const senderKeys = Object.keys(value.sender);
    if (senderKeys.some(key => key !== "name" && key !== "email")) {
      throw new BrevoRequestError("sender contains unsupported fields");
    }
    const senderName = optionalText(value.sender, "name", 255);
    const senderEmail = optionalText(value.sender, "email", 254);
    if (!senderName || !senderEmail || !isValidEmail(senderEmail)) {
      throw new BrevoRequestError(
        "sender requires a valid name and email address"
      );
    }
    update.sender = { name: senderName, email: senderEmail.toLowerCase() };
  }
  if (Object.prototype.hasOwnProperty.call(value, "recipients")) {
    if (!isPlainRecord(value.recipients)) {
      throw new BrevoRequestError("recipients must be an object");
    }
    if (Object.keys(value.recipients).some(key => key !== "listIds")) {
      throw new BrevoRequestError("recipients contains unsupported fields");
    }
    const listIds = parseUniquePositiveIntegerArray(
      value.recipients.listIds,
      100
    );
    if (!listIds) {
      throw new BrevoRequestError(
        "recipients.listIds must contain 1 to 100 unique positive IDs"
      );
    }
    update.recipients = { listIds };
  }

  if (!Object.keys(update).length) {
    throw new BrevoRequestError("At least one campaign field is required");
  }
  return update;
}
