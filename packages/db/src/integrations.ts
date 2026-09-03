import { prisma } from "./client.js";
import { decryptSecret, encryptSecret } from "./crypto.js";

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
    return decryptSecret(row.encryptedApiKey, row.iv, row.authTag);
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
