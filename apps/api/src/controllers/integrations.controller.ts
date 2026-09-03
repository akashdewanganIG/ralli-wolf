import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { recordAuditLog } from "../utils/audit.utils.js";
import { encryptSecret } from "@repo/db/crypto";
import { normalizeProviderBaseUrl } from "../utils/provider-url.js";

function maskTail(value: string, show: number = 4): string {
  if (!value) return "";
  const tail = value.slice(-show);
  return `****${tail}`;
}

export const integrationsController = {
  getCredentials: async (_req: Request, res: Response) => {
    const [whatsapp, email] = await Promise.all([
      prisma.integrationCredential.findUnique({
        where: { provider: "whatsapp" },
      }),
      prisma.integrationCredential.findUnique({ where: { provider: "email" } }),
    ]);
    res.json({
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
    });
  },

  upsertCredential: async (req: Request, res: Response) => {
    const { provider, apiKey } = req.body as {
      provider?: "whatsapp" | "email";
      apiKey?: string;
    };
    if (!provider || !["whatsapp", "email"].includes(provider)) {
      return res.status(400).json({ error: "Invalid provider" });
    }
    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 8) {
      return res.status(400).json({ error: "Invalid apiKey" });
    }
    const userId = String(req.user?.id ?? "system");
    const cleaned = apiKey.trim();
    const enc = encryptSecret(cleaned);
    const masked = maskTail(cleaned);
    const existing = await prisma.integrationCredential.findUnique({
      where: { provider },
    });

    await prisma.integrationCredential.upsert({
      where: { provider },
      update: {
        encryptedApiKey: enc.cipherText,
        iv: enc.iv,
        authTag: enc.authTag,
        maskedTail: masked,
        updatedByUserId: userId,
      },
      create: {
        provider,
        encryptedApiKey: enc.cipherText,
        iv: enc.iv,
        authTag: enc.authTag,
        maskedTail: masked,
        updatedByUserId: userId,
      },
    });
    await recordAuditLog({
      action: "INTEGRATION_CREDENTIAL_UPDATED",
      changedBy: req.user?.id ?? 0,
      entityType: "INTEGRATION_CREDENTIAL",
      entityId: 0,
      oldValues: existing
        ? {
            provider,
            maskedTail: existing.maskedTail,
            updatedAt: existing.updatedAt,
          }
        : null,
      newValues: {
        provider,
        maskedTail: masked,
      },
    });

    res.status(204).send();
  },

  getConfig: async (_req: Request, res: Response) => {
    const keys = [
      "email.baseUrl",
      "email.webhookSecret",
      "whatsapp.baseUrl",
    ] as const;
    const rows = await prisma.appConfig.findMany({
      where: { key: { in: keys as unknown as string[] } },
    });
    const byKey = Object.fromEntries(rows.map(r => [r.key, r]));
    res.json({
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
        baseUrl: {
          exists: !!byKey["whatsapp.baseUrl"],
          value: byKey["whatsapp.baseUrl"]?.plainValue ?? null,
        },
      },
    });
  },

  upsertConfig: async (req: Request, res: Response) => {
    const body = req.body as Partial<{
      email: { baseUrl?: string; webhookSecret?: string };
      whatsapp: { baseUrl?: string };
    }>;
    const userId = String(req.user?.id ?? "system");

    const changedBy = req.user?.id ?? 0;
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    let emailBaseUrl: string | null | undefined;
    let whatsappBaseUrl: string | null | undefined;
    try {
      emailBaseUrl = body.email?.baseUrl?.trim()
        ? normalizeProviderBaseUrl(body.email.baseUrl, "brevo")
        : body.email?.baseUrl === undefined
          ? undefined
          : null;
      whatsappBaseUrl = body.whatsapp?.baseUrl?.trim()
        ? normalizeProviderBaseUrl(body.whatsapp.baseUrl, "msg91")
        : body.whatsapp?.baseUrl === undefined
          ? undefined
          : null;
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid provider URL",
      });
    }
    if (body.email?.baseUrl !== undefined) {
      const existingBaseUrl = await prisma.appConfig.findUnique({
        where: { key: "email.baseUrl" },
      });
      oldValues["email.baseUrl"] = existingBaseUrl?.plainValue ?? null;
      const nextValue = emailBaseUrl ?? null;
      newValues["email.baseUrl"] = nextValue;

      await prisma.appConfig.upsert({
        where: { key: "email.baseUrl" },
        update: {
          plainValue: nextValue,
          encryptedValue: null,
          iv: null,
          authTag: null,
          maskedTail: null,
          updatedByUserId: userId,
        },
        create: {
          key: "email.baseUrl",
          plainValue: nextValue,
          updatedByUserId: userId,
        },
      });
    }
    if (body.email?.webhookSecret !== undefined) {
      const cleaned = (body.email.webhookSecret || "").trim();
      const existingWebhook = await prisma.appConfig.findUnique({
        where: { key: "email.webhookSecret" },
      });
      oldValues["email.webhookSecret"] = existingWebhook?.maskedTail ?? null;
      if (cleaned) {
        const enc = encryptSecret(cleaned);
        const masked = maskTail(cleaned);
        newValues["email.webhookSecret"] = masked;
        await prisma.appConfig.upsert({
          where: { key: "email.webhookSecret" },
          update: {
            encryptedValue: enc.cipherText,
            iv: enc.iv,
            authTag: enc.authTag,
            maskedTail: masked,
            plainValue: null,
            updatedByUserId: userId,
          },
          create: {
            key: "email.webhookSecret",
            encryptedValue: enc.cipherText,
            iv: enc.iv,
            authTag: enc.authTag,
            maskedTail: masked,
            updatedByUserId: userId,
          },
        });
      } else {
        newValues["email.webhookSecret"] = null;
        await prisma.appConfig.upsert({
          where: { key: "email.webhookSecret" },
          update: {
            encryptedValue: null,
            iv: null,
            authTag: null,
            maskedTail: null,
            plainValue: null,
            updatedByUserId: userId,
          },
          create: {
            key: "email.webhookSecret",
            plainValue: null,
            updatedByUserId: userId,
          },
        });
      }
    }
    if (body.whatsapp?.baseUrl !== undefined) {
      const existingBaseUrl = await prisma.appConfig.findUnique({
        where: { key: "whatsapp.baseUrl" },
      });
      oldValues["whatsapp.baseUrl"] = existingBaseUrl?.plainValue ?? null;
      const nextBaseUrl = whatsappBaseUrl ?? null;
      newValues["whatsapp.baseUrl"] = nextBaseUrl;
      await prisma.appConfig.upsert({
        where: { key: "whatsapp.baseUrl" },
        update: {
          plainValue: nextBaseUrl,
          encryptedValue: null,
          iv: null,
          authTag: null,
          maskedTail: null,
          updatedByUserId: userId,
        },
        create: {
          key: "whatsapp.baseUrl",
          plainValue: nextBaseUrl,
          updatedByUserId: userId,
        },
      });
    }

    const hasChanges = Object.keys(newValues).length > 0;

    if (hasChanges) {
      await recordAuditLog({
        action: "INTEGRATION_CONFIG_UPDATED",
        changedBy,
        entityType: "APP_CONFIG",
        entityId: 0,
        oldValues,
        newValues,
      });
    }

    res.status(204).send();
  },
};
