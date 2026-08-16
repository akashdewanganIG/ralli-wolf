import { prisma } from "@repo/db";
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

function decryptGCM(cipherText: string, iv: string, authTag: string): string {
  const key = deriveKey();
  const ivBuf = Buffer.from(iv, "base64");
  const tagBuf = Buffer.from(authTag, "base64");
  const decipher = nodeCrypto.createDecipheriv("aes-256-gcm", key, ivBuf);
  decipher.setAuthTag(tagBuf);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherText, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export async function getGupshupApiKey(): Promise<string> {
  const row = await prisma.integrationCredential.findUnique({
    where: { provider: "whatsapp" },
  });
  const key =
    row?.encryptedApiKey && row.iv && row.authTag
      ? decryptGCM(row.encryptedApiKey, row.iv, row.authTag)
      : null;
  if (!key)
    throw new Error(
      "Gupshup API key not set. Configure in Integration Manager."
    );
  return key;
}

export async function getGupshupSource(): Promise<string | null> {
  const row = await prisma.appConfig.findUnique({
    where: { key: "whatsapp.source" },
  });
  return row?.plainValue ?? null;
}

export async function getGupshupAppName(): Promise<string | null> {
  const row = await prisma.appConfig.findUnique({
    where: { key: "whatsapp.appName" },
  });
  return row?.plainValue ?? null;
}
