import { prisma } from "@repo/db";
import { Prisma, WhatsAppNumber } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@repo/db/crypto";
import { getMsg91Credentials } from "../../utils/integration.utils.js";
import { Msg91Client, Msg91FetchedNumber } from "./msg91-client.js";
import { normalizeWhatsAppPhone } from "./phone.js";

export interface CreateWhatsappAccountInput {
  displayName: string;
  phoneNumber: string;
  apiKey: string;
  senderId?: string | null;
  businessId?: string | null;
  appName?: string | null;
}

type WhatsappAccountStatus = "ACTIVE" | "INACTIVE";

export const WHATSAPP_ACCOUNT_PUBLIC_SELECT = {
  id: true,
  displayName: true,
  phoneNumber: true,
  senderId: true,
  businessId: true,
  provider: true,
  status: true,
  maskedTail: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WhatsAppNumberSelect;

type PublicWhatsappAccount = Prisma.WhatsAppNumberGetPayload<{
  select: typeof WHATSAPP_ACCOUNT_PUBLIC_SELECT;
}>;

type SyncedAccount = PublicWhatsappAccount & {
  action: "created" | "updated" | "existing";
};

function providerText(
  number: Msg91FetchedNumber,
  ...keys: Array<keyof Msg91FetchedNumber>
): string | undefined {
  for (const key of keys) {
    const value = number[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export class WhatsappAccountService {
  async listAccounts() {
    const accounts = await prisma.whatsAppNumber.findMany({
      orderBy: { createdAt: "desc" },
      select: WHATSAPP_ACCOUNT_PUBLIC_SELECT,
    });

    return accounts;
  }

  async createAccount(input: CreateWhatsappAccountInput, userId: number) {
    const displayName = input.displayName.trim();
    const apiKey = input.apiKey.trim();
    if (!displayName || displayName.length > 120) {
      throw new Error(
        "Display name is required and cannot exceed 120 characters"
      );
    }
    if (!apiKey || apiKey.length > 2_048) {
      throw new Error("API key is required and cannot exceed 2048 characters");
    }
    const normalizedPhone = normalizeWhatsAppPhone(input.phoneNumber);
    if (!normalizedPhone) {
      throw new Error("Invalid phone number");
    }

    const encrypted = encryptSecret(apiKey);
    const maskedTail = apiKey.slice(-4);

    const record = await prisma.whatsAppNumber.create({
      data: {
        displayName,
        phoneNumber: normalizedPhone,
        senderId: input.senderId?.trim() || null,
        businessId: input.businessId?.trim() || null,
        metadata: input.appName ? { appName: input.appName } : undefined,
        encryptedApiKey: encrypted.cipherText,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        maskedTail,
        createdBy: userId,
        updatedBy: userId,
      },
      select: WHATSAPP_ACCOUNT_PUBLIC_SELECT,
    });

    return record;
  }

  async getAccountOrThrow(
    id: number
  ): Promise<WhatsAppNumber & { apiKey: string }> {
    const record = await prisma.whatsAppNumber.findUnique({ where: { id } });
    if (!record) {
      throw new Error("WhatsApp account not found");
    }
    if (record.status !== "ACTIVE") {
      throw new Error("WhatsApp account is inactive");
    }

    const apiKey = decryptSecret(
      record.encryptedApiKey,
      record.iv,
      record.authTag
    );
    return { ...record, apiKey };
  }

  async updateAccount(
    id: number,
    data: {
      displayName: string;
      status: WhatsappAccountStatus;
      apiKey?: string | null;
    },
    userId: number
  ): Promise<PublicWhatsappAccount> {
    const existing = await prisma.whatsAppNumber.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("WhatsApp account not found");
    }
    const displayName = data.displayName.trim();
    if (!displayName || displayName.length > 120) {
      throw new Error(
        "Display name is required and cannot exceed 120 characters"
      );
    }
    const rotatedApiKey = data.apiKey?.trim() || null;
    const rotatedSecret = rotatedApiKey ? encryptSecret(rotatedApiKey) : null;

    const updated = await prisma.whatsAppNumber.update({
      where: { id },
      data: {
        displayName,
        status: data.status,
        updatedBy: userId,
        ...(rotatedSecret &&
          rotatedApiKey && {
            encryptedApiKey: rotatedSecret.cipherText,
            iv: rotatedSecret.iv,
            authTag: rotatedSecret.authTag,
            maskedTail: rotatedApiKey.slice(-4),
          }),
      },
      select: WHATSAPP_ACCOUNT_PUBLIC_SELECT,
    });

    return updated;
  }

  async syncNumbers(userId: number) {
    const credentials = await getMsg91Credentials();

    const client = new Msg91Client({
      apiKey: credentials.apiKey,
      baseUrl: credentials.baseUrl,
    });

    const numbers = await client.fetchNumbers();

    const synced: SyncedAccount[] = [];
    const errors: Array<{ phoneNumber?: string; error: string }> = [];

    for (const number of numbers) {
      try {
        const phoneNumber = normalizeWhatsAppPhone(
          providerText(
            number,
            "phone_number",
            "phoneNumber",
            "integrated_number"
          ) || ""
        );

        if (!phoneNumber) {
          errors.push({ error: "Provider returned an invalid phone number" });
          continue;
        }

        const existing = await prisma.whatsAppNumber.findFirst({
          where: { phoneNumber },
        });

        if (existing) {
          if (existing.provider !== "MSG91") {
            const updated = await prisma.whatsAppNumber.update({
              where: { id: existing.id },
              data: {
                provider: "MSG91",
                updatedBy: userId,
              },
              select: WHATSAPP_ACCOUNT_PUBLIC_SELECT,
            });

            synced.push({ ...updated, action: "updated" });
          } else {
            const publicExisting =
              await prisma.whatsAppNumber.findUniqueOrThrow({
                where: { id: existing.id },
                select: WHATSAPP_ACCOUNT_PUBLIC_SELECT,
              });
            synced.push({ ...publicExisting, action: "existing" });
          }
          continue;
        }

        const encrypted = encryptSecret(credentials.apiKey.trim());
        const maskedTail = credentials.apiKey.trim().slice(-4);

        const displayName =
          providerText(number, "name", "display_name") || phoneNumber;
        if (displayName.length > 120) {
          errors.push({
            phoneNumber,
            error: "Provider display name exceeds 120 characters",
          });
          continue;
        }
        const senderId =
          providerText(number, "sender_id", "senderId") || phoneNumber;
        const businessId =
          providerText(number, "business_id", "businessId") || null;
        const created = await prisma.whatsAppNumber.create({
          data: {
            displayName,
            phoneNumber,
            senderId,
            businessId,
            provider: "MSG91",
            status: "ACTIVE",
            metadata: (number.metadata || {}) as Prisma.InputJsonValue,
            encryptedApiKey: encrypted.cipherText,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            maskedTail,
            createdBy: userId,
            updatedBy: userId,
          },
          select: WHATSAPP_ACCOUNT_PUBLIC_SELECT,
        });

        synced.push({ ...created, action: "created" });
      } catch (error: unknown) {
        errors.push({
          phoneNumber: providerText(
            number,
            "phone_number",
            "phoneNumber",
            "integrated_number"
          ),
          error:
            error instanceof Error
              ? error.message
              : "WhatsApp number sync failed",
        });
      }
    }

    return {
      synced: synced.length,
      errors: errors.length,
      details: { synced, errors },
    };
  }
}
