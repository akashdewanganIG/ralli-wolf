import { prisma } from "@repo/db";
import { Prisma } from "@prisma/client";
import { WhatsappAccountService } from "./account-service.js";
import { getMsg91BaseUrl } from "../../utils/integration.utils.js";
import {
  Msg91Client,
  Msg91FetchedTemplate,
  Msg91TemplateComponent,
} from "./msg91-client.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export class WhatsappTemplateService {
  private accountService: WhatsappAccountService;

  constructor() {
    this.accountService = new WhatsappAccountService();
  }

  async listTemplates(accountId: number) {
    const templates = await prisma.whatsAppTemplate.findMany({
      where: {
        whatsappNumberId: accountId,
        isArchived: false,
      },
      orderBy: { updatedAt: "desc" },
    });

    return templates.map(tpl => {
      const componentsData = isRecord(tpl.components) ? tpl.components : null;
      const storedLanguages = Array.isArray(componentsData?.languages)
        ? componentsData.languages
        : null;
      return {
        ...tpl,

        languages:
          storedLanguages ||
          (tpl.language
            ? [
                {
                  code: tpl.language,
                  status: tpl.status,
                  id: tpl.id,
                },
              ]
            : []),
      };
    });
  }

  async syncTemplates(accountId: number) {
    const account = await this.accountService.getAccountOrThrow(accountId);

    const sender = account.senderId || account.phoneNumber;
    if (!sender) {
      throw new Error("Account is missing sender id/phone number");
    }

    const client = new Msg91Client({
      apiKey: account.apiKey,
      baseUrl: await getMsg91BaseUrl(),
    });

    const templates = await client.fetchTemplates(sender);
    return this.processTemplates(templates, account.id);
  }

  private async processTemplates(
    templates: Msg91FetchedTemplate[],
    accountId: number
  ) {
    const providerNames = [
      ...new Set(templates.map(template => template.name)),
    ];
    const syncedAt = new Date();

    return prisma.$transaction(async tx => {
      await tx.whatsAppTemplate.updateMany({
        where: {
          whatsappNumberId: accountId,
          ...(providerNames.length > 0 && { name: { notIn: providerNames } }),
        },
        data: { isArchived: true },
      });

      for (const template of templates) {
        const primaryLanguage =
          template.languages[0]?.code || template.language || "en";
        const providerTemplateId = template.id || template.name;
        const status =
          template.status || template.languages[0]?.status || "PENDING";
        const componentsData = JSON.parse(
          JSON.stringify(template)
        ) as Prisma.InputJsonValue;

        await tx.whatsAppTemplate.upsert({
          where: {
            whatsappNumberId_name: {
              whatsappNumberId: accountId,
              name: template.name,
            },
          },
          update: {
            providerTemplateId,
            language: primaryLanguage,
            category: template.category || null,
            status,
            components: componentsData,
            isArchived: false,
            lastSyncedAt: syncedAt,
          },
          create: {
            whatsappNumberId: accountId,
            providerTemplateId,
            name: template.name,
            language: primaryLanguage,
            category: template.category || null,
            status,
            components: componentsData,
            isArchived: false,
            lastSyncedAt: syncedAt,
          },
        });
      }

      return { count: templates.length };
    });
  }

  async findTemplateByName(accountId: number, templateName: string) {
    return prisma.whatsAppTemplate.findFirst({
      where: {
        whatsappNumberId: accountId,
        name: templateName,
        isArchived: false,
        status: "APPROVED",
      },
    });
  }

  async createTemplate(
    accountId: number,
    templateData: {
      template_name: string;
      language: string;
      category: string;
      button_url?: boolean;
      message_ttl?: number;
      ttl_in_seconds?: number | null;
      components: Msg91TemplateComponent[];
    }
  ) {
    const account = await this.accountService.getAccountOrThrow(accountId);
    const integratedNumber = account.senderId || account.phoneNumber;
    if (!integratedNumber) {
      throw new Error("Account is missing sender id/phone number");
    }

    if (templateData.message_ttl !== undefined) {
      if (templateData.message_ttl < 30 || templateData.message_ttl > 900) {
        throw new Error("TTL must be between 30 and 900 seconds");
      }
    }

    const client = new Msg91Client({
      apiKey: account.apiKey,
      baseUrl: await getMsg91BaseUrl(),
    });
    const result = await client.createTemplate({
      integrated_number: integratedNumber,
      ...templateData,
    });

    await this.syncTemplates(accountId);

    return result;
  }

  async uploadMedia(
    accountId: number,
    mediaBuffer: Buffer,
    mimeType: string
  ): Promise<string> {
    const account = await this.accountService.getAccountOrThrow(accountId);
    const integratedNumber = account.senderId || account.phoneNumber;
    if (!integratedNumber) {
      throw new Error("Account is missing sender id/phone number");
    }

    const client = new Msg91Client({
      apiKey: account.apiKey,
      baseUrl: await getMsg91BaseUrl(),
    });

    return client.uploadSampleMedia(integratedNumber, mediaBuffer, mimeType);
  }

  async updateTemplate(
    accountId: number,
    templateName: string,
    components: Msg91TemplateComponent[]
  ) {
    const account = await this.accountService.getAccountOrThrow(accountId);
    const integratedNumber = account.senderId || account.phoneNumber;
    if (!integratedNumber) {
      throw new Error("Account is missing sender id/phone number");
    }

    const client = new Msg91Client({
      apiKey: account.apiKey,
      baseUrl: await getMsg91BaseUrl(),
    });
    const result = await client.editTemplate({
      integrated_number: integratedNumber,
      template_name: templateName,
      components,
    });

    await this.syncTemplates(accountId);

    return result;
  }

  async deleteTemplate(accountId: number, templateName: string) {
    const account = await this.accountService.getAccountOrThrow(accountId);
    const integratedNumber = account.senderId || account.phoneNumber;
    if (!integratedNumber) {
      throw new Error("Account is missing sender id/phone number");
    }

    const client = new Msg91Client({
      apiKey: account.apiKey,
      baseUrl: await getMsg91BaseUrl(),
    });

    const result = await client.deleteTemplate(integratedNumber, templateName);

    await prisma.whatsAppTemplate.updateMany({
      where: {
        whatsappNumberId: accountId,
        name: templateName,
      },
      data: { isArchived: true },
    });

    return result;
  }
}
