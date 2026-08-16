import { prisma } from "@repo/db";
import { WhatsAppNumber } from "@prisma/client";
import { encryptSecret, decryptSecret } from "../../utils/crypto.utils.js";
import { getMsg91Credentials } from "../../utils/integration.utils.js";
import { Msg91Client } from "./Msg91Client.js";

export interface CreateWhatsappAccountInput {
  displayName: string;
  phoneNumber: string;
  apiKey: string;
  senderId?: string | null;
  businessId?: string | null;
  appName?: string | null;
}

export class WhatsappAccountService {
  async listAccounts() {
    const accounts = await prisma.whatsAppNumber.findMany({
      orderBy: { createdAt: "desc" },
      select: {
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
      },
    });

    console.log("Accounts returned from listAccounts:", accounts);
    return accounts;
  }

  async createAccount(input: CreateWhatsappAccountInput, userId: number) {
    const normalizedPhone = this.normalizePhone(input.phoneNumber);
    if (!normalizedPhone) {
      throw new Error("Invalid phone number");
    }

    const encrypted = encryptSecret(input.apiKey.trim());
    const maskedTail = input.apiKey.trim().slice(-4);

    const record = await prisma.whatsAppNumber.create({
      data: {
        displayName: input.displayName.trim(),
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
      select: {
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
      },
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

    const apiKey = decryptSecret(
      record.encryptedApiKey,
      record.iv,
      record.authTag
    );
    return { ...record, apiKey };
  }

  async updateAccount(
    id: number,
    data: { displayName: string; status: string },
    userId: number
  ): Promise<WhatsAppNumber> {
    const existing = await prisma.whatsAppNumber.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("WhatsApp account not found");
    }

    const updated = await prisma.whatsAppNumber.update({
      where: { id },
      data: {
        displayName: data.displayName.trim(),
        status: data.status,
        updatedBy: userId,
      },
    });

    return updated;
  }

  async syncNumbers(userId: number) {
    // Get MSG91 credentials from integration config
    const credentials = await getMsg91Credentials();
    console.log("MSG91 Credentials fetched:", {
      hasApiKey: !!credentials.apiKey,
      apiKeyLength: credentials.apiKey?.length || 0,
      baseUrl: credentials.baseUrl,
    });

    const client = new Msg91Client({
      apiKey: credentials.apiKey,
      baseUrl: credentials.baseUrl,
    });

    const numbers = await client.fetchNumbers();
    console.log("Numbers fetched from MSG91:", numbers);

    const synced: any[] = [];
    const errors: any[] = [];

    for (const number of numbers) {
      try {
        console.log("Processing number:", number);
        const phoneNumber = this.normalizePhone(
          number.phone_number ||
            number.phoneNumber ||
            number.integrated_number ||
            ""
        );

        console.log("Normalized phone number:", phoneNumber);

        if (!phoneNumber) {
          errors.push({ number, error: "Invalid phone number" });
          continue;
        }

        const existing = await prisma.whatsAppNumber.findFirst({
          where: { phoneNumber },
        });

        if (existing) {
          // Update existing record if provider or status is missing
          if (!existing.provider || !existing.status) {
            const updated = await prisma.whatsAppNumber.update({
              where: { id: existing.id },
              data: {
                provider: existing.provider || "msg91",
                status: existing.status || "ACTIVE",
                displayName: existing.displayName || phoneNumber,
                senderId: existing.senderId || phoneNumber,
                updatedBy: userId,
              },
            });
            console.log("Updated existing WhatsApp number:", updated);
            synced.push({ ...updated, action: "updated" });
          } else {
            synced.push({ ...existing, action: "existing" });
          }
          continue;
        }

        const encrypted = encryptSecret(credentials.apiKey.trim());
        const maskedTail = credentials.apiKey.trim().slice(-4);

        const created = await prisma.whatsAppNumber.create({
          data: {
            displayName: number.name || number.display_name || phoneNumber,
            phoneNumber,
            senderId: number.sender_id || number.senderId || phoneNumber,
            businessId: number.business_id || number.businessId || null,
            provider: "msg91",
            status: "ACTIVE",
            metadata: number.metadata || {},
            encryptedApiKey: encrypted.cipherText,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            maskedTail,
            createdBy: userId,
            updatedBy: userId,
          },
        });

        console.log("Created WhatsApp number:", created);

        synced.push({ ...created, action: "created" });
      } catch (error: any) {
        errors.push({ number, error: error.message });
      }
    }

    return {
      synced: synced.length,
      errors: errors.length,
      details: { synced, errors },
    };
  }

  private normalizePhone(phone: string) {
    if (!phone) return null;
    const digits = phone.replace(/[^\d]/g, "");
    if (!digits) return null;
    if (digits.startsWith("0") && digits.length > 1) {
      return digits.slice(1);
    }
    if (digits.length === 10) {
      return `91${digits}`;
    }
    return digits;
  }
}
