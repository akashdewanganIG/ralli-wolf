import { prisma } from "./client.js";
import type { AppConfig } from "@prisma/client";
import { decryptSecret, encryptSecret } from "./crypto.js";

function maskTail(value: string, show: number = 4): string {
  if (!value) return "";
  const tail = value.slice(-show);
  return `****${tail}`;
}

export type ConfigKey =
  | "email.baseUrl"
  | "email.webhookSecret"
  | "whatsapp.source"
  | "whatsapp.appName";

export async function setConfigValue(params: {
  key: ConfigKey;
  value: string;
  updatedByUserId: string;
  encrypt?: boolean;
}): Promise<void> {
  const { key, value, updatedByUserId, encrypt = false } = params;
  if (encrypt) {
    const enc = encryptSecret(value.trim());
    const masked = maskTail(value.trim());
    await prisma.appConfig.upsert({
      where: { key },
      update: {
        encryptedValue: enc.cipherText,
        iv: enc.iv,
        authTag: enc.authTag,
        maskedTail: masked,
        plainValue: null,
        updatedByUserId,
      },
      create: {
        key,
        encryptedValue: enc.cipherText,
        iv: enc.iv,
        authTag: enc.authTag,
        maskedTail: masked,
        updatedByUserId,
      },
    });
  } else {
    await prisma.appConfig.upsert({
      where: { key },
      update: {
        plainValue: value.trim(),
        encryptedValue: null,
        iv: null,
        authTag: null,
        maskedTail: null,
        updatedByUserId,
      },
      create: {
        key,
        plainValue: value.trim(),
        updatedByUserId,
      },
    });
  }
}

export async function getConfigValue(key: ConfigKey): Promise<string | null> {
  const row = await prisma.appConfig.findUnique({ where: { key } });
  if (!row) return null;
  if (row.encryptedValue && row.iv && row.authTag) {
    return decryptSecret(row.encryptedValue, row.iv, row.authTag);
  }
  return row.plainValue ?? null;
}

export async function getConfigMeta() {
  const keys: ConfigKey[] = [
    "email.baseUrl",
    "email.webhookSecret",
    "whatsapp.source",
    "whatsapp.appName",
  ];
  const rows = await prisma.appConfig.findMany({
    where: { key: { in: keys } },
  });
  const byKey = Object.fromEntries(rows.map((r: AppConfig) => [r.key, r]));
  return {
    email: {
      baseUrl: {
        exists: !!byKey["email.baseUrl"],
        value: byKey["email.baseUrl"]?.plainValue ?? null,
      },
      webhookSecret: {
        exists: !!byKey["email.webhookSecret"],
        masked: byKey["email.webhookSecret"]?.maskedTail ?? null,
      },
    },
    whatsapp: {
      source: {
        exists: !!byKey["whatsapp.source"],
        value: byKey["whatsapp.source"]?.plainValue ?? null,
      },
      appName: {
        exists: !!byKey["whatsapp.appName"],
        value: byKey["whatsapp.appName"]?.plainValue ?? null,
      },
    },
  } as const;
}
