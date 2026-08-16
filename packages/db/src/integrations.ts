import { prisma } from "./client.js";
import * as nodeCrypto from "node:crypto";

function deriveKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || "";
  const raw = key.startsWith("base64:")
    ? Buffer.from(key.slice(7), "base64")
    : key.startsWith("hex:")
      ? Buffer.from(key.slice(4), "hex")
      : Buffer.from(key, "utf8");
  return raw.length === 32
    ? raw
    : nodeCrypto.createHash("sha256").update(raw).digest();
}

function encryptSecret(plainText: string): {
  cipherText: string;
  iv: string;
  authTag: string;
} {
  const key = deriveKey();
  const iv = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    cipherText: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

function decryptSecret(payload: {
  cipherText: string;
  iv: string;
  authTag: string;
}): string {
  const key = deriveKey();
  const ivBuf = Buffer.from(payload.iv, "base64");
  const tagBuf = Buffer.from(payload.authTag, "base64");
  const decipher = nodeCrypto.createDecipheriv("aes-256-gcm", key, ivBuf);
  decipher.setAuthTag(tagBuf);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.cipherText, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function maskTail(value: string, show: number = 4): string {
  if (!value) return "";
  const tail = value.slice(-show);
  return `****${tail}`;
}

type Provider = "whatsapp" | "email";

export async function upsertEncryptedCredential(params: {
  provider: Provider;
  apiKey: string;
  updatedByUserId: string;
}): Promise<void> {
  const cleaned = params.apiKey.trim();
  const enc = encryptSecret(cleaned);
  const maskedTail = maskTail(cleaned);
  await prisma.integrationCredential.upsert({
    where: { provider: params.provider },
    update: {
      encryptedApiKey: enc.cipherText,
      iv: enc.iv,
      authTag: enc.authTag,
      maskedTail,
      updatedByUserId: params.updatedByUserId,
    },
    create: {
      provider: params.provider,
      encryptedApiKey: enc.cipherText,
      iv: enc.iv,
      authTag: enc.authTag,
      maskedTail,
      updatedByUserId: params.updatedByUserId,
    },
  });
}

export async function getDecryptedCredential(
  provider: Provider
): Promise<string | null> {
  const row = await prisma.integrationCredential.findUnique({
    where: { provider },
  });
  if (!row) return null;
  try {
    return decryptSecret({
      cipherText: row.encryptedApiKey,
      iv: row.iv,
      authTag: row.authTag,
    });
  } catch {
    return null;
  }
}

export async function getCredentialMeta() {
  const [whatsapp, email] = await Promise.all([
    prisma.integrationCredential.findUnique({
      where: { provider: "whatsapp" },
    }),
    prisma.integrationCredential.findUnique({ where: { provider: "email" } }),
  ]);
  return {
    whatsapp: {
      exists: !!whatsapp,
      masked: whatsapp?.maskedTail ?? null,
      updatedAt: whatsapp?.updatedAt ?? null,
    },
    email: {
      exists: !!email,
      masked: email?.maskedTail ?? null,
      updatedAt: email?.updatedAt ?? null,
    },
  } as const;
}
