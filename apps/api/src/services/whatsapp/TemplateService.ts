import { prisma } from "@repo/db";
import { WhatsappAccountService } from "./AccountService.js";
import { getMsg91Credentials } from "../../utils/integration.utils.js";
import { Msg91Client } from "./Msg91Client.js";

type Msg91Template = {
  template_id?: string;
  id?: string;
  templateId?: string;
  template_name?: string;
  name?: string;
  language?: string;
  lang?: string;
  languages?: Array<{
    code: string;
    status: string;
    id: number;
    rejection_reason?: string;
  }>;
  category?: string;
  type?: string;
  status?: string;
  approval_status?: string;
  components?: unknown;
  content?: unknown;
  data?: unknown;
};

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

    // Ensure languages array is exposed at the top level for frontend
    return templates.map(tpl => {
      const componentsData = tpl.components as any;
      return {
        ...tpl,
        // Extract languages array from components if it exists
        languages:
          componentsData?.languages ||
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
    console.log("Account details:", {
      id: account.id,
      displayName: account.displayName,
      phoneNumber: account.phoneNumber,
      senderId: account.senderId,
    });

    const sender = account.senderId || account.phoneNumber;
    if (!sender) {
      throw new Error("Account is missing sender id/phone number");
    }

    console.log("Using sender for template fetch:", sender);

    // Get MSG91 credentials from integration config
    const credentials = await getMsg91Credentials();
    const client = new Msg91Client({
      apiKey: credentials.apiKey,
      baseUrl: credentials.baseUrl,
    });

    try {
      const templates = await client.fetchTemplates(sender);
      return await this.processTemplates(templates, account);
    } catch (error: any) {
      if (error.message?.includes("Inactive integration")) {
        throw new Error(
          `The phone number ${sender} is not an active MSG91 integrated number. ` +
            `Please ensure this number is activated in your MSG91 account, or select a different WhatsApp number that is active.`
        );
      }
      throw error;
    }
  }

  private async processTemplates(templates: any, account: any) {
    const templateRecords: Msg91Template[] = Array.isArray(templates)
      ? templates
      : [];

    // Extract template names from MSG91 response
    const msg91TemplateNames = templateRecords.map(
      tpl => tpl.template_name || tpl.name || tpl.templateId || "unknown"
    );

    console.log("MSG91 template names:", msg91TemplateNames);

    // Get all local templates for this account
    const localTemplates = await prisma.whatsAppTemplate.findMany({
      where: {
        whatsappNumberId: account.id,
      },
      select: {
        id: true,
        name: true,
      },
    });

    console.log(
      "Local template names:",
      localTemplates.map(t => t.name)
    );

    // Find templates to archive: local templates that are not in MSG91
    const templatesToArchive = localTemplates.filter(
      local => !msg91TemplateNames.includes(local.name)
    );

    console.log(
      "Templates to archive:",
      templatesToArchive.map(t => ({ id: t.id, name: t.name }))
    );

    // Archive templates that are not in the MSG91 response (have been deleted from MSG91)
    if (templatesToArchive.length > 0) {
      const archiveResult = await prisma.whatsAppTemplate.updateMany({
        where: {
          id: {
            in: templatesToArchive.map(t => t.id),
          },
        },
        data: {
          isArchived: true,
        },
      });
      console.log(`Archived ${archiveResult.count} templates in database`);
    } else {
      console.log("No templates to archive");
    }

    // Unarchive templates that are back in MSG91 (in case they were re-added)
    const templatesToUnarchive = localTemplates.filter(local =>
      msg91TemplateNames.includes(local.name)
    );

    if (templatesToUnarchive.length > 0) {
      await prisma.whatsAppTemplate.updateMany({
        where: {
          id: {
            in: templatesToUnarchive.map(t => t.id),
          },
          isArchived: true,
        },
        data: {
          isArchived: false,
        },
      });
      console.log(
        `Unarchived ${templatesToUnarchive.length} templates that are back in MSG91`
      );
    }

    // Upsert templates (update if exists, create if not)
    for (const tpl of templateRecords) {
      // Use base template name without language concatenation
      const templateName =
        tpl.template_name || tpl.name || tpl.templateId || "unknown";

      // Get primary language (first one if multiple, or single language)
      const primaryLanguage =
        Array.isArray(tpl.languages) &&
        tpl.languages.length > 0 &&
        tpl.languages[0]
          ? tpl.languages[0].code
          : tpl.language || tpl.lang || "en";

      const providerTemplateId =
        tpl.template_id || tpl.id || tpl.templateId || templateName;

      console.log(
        `Upserting template: ${templateName} with languages: ${
          Array.isArray(tpl.languages)
            ? tpl.languages.map((l: any) => l.code).join(", ")
            : primaryLanguage
        }`
      );

      // Store the complete template data including all languages
      const componentsData: Record<string, any> = {
        ...JSON.parse(JSON.stringify(tpl)),
        // Ensure languages array is preserved
        languages:
          tpl.languages ||
          (primaryLanguage
            ? [
                {
                  code: primaryLanguage,
                  status: tpl.status || "PENDING",
                  id: tpl.id,
                },
              ]
            : []),
        components: tpl.components || tpl.content || tpl.data,
      };

      await prisma.whatsAppTemplate.upsert({
        where: {
          whatsappNumberId_name: {
            whatsappNumberId: account.id,
            name: templateName, // Use base name without language concatenation
          },
        },
        update: {
          providerTemplateId,
          language: primaryLanguage,
          category: tpl.category || tpl.type || null,
          status: tpl.status || tpl.approval_status || "PENDING",
          components: componentsData as any,
          isArchived: false,
          lastSyncedAt: new Date(),
        },
        create: {
          whatsappNumberId: account.id,
          providerTemplateId,
          name: templateName, // Use base name without language concatenation
          language: primaryLanguage,
          category: tpl.category || tpl.type || null,
          status: tpl.status || tpl.approval_status || "PENDING",
          components: componentsData as any,
          isArchived: false,
          lastSyncedAt: new Date(),
        },
      });
    }

    return { count: templateRecords.length || 0 };
  }

  async findTemplateByName(accountId: number, templateName: string) {
    return prisma.whatsAppTemplate.findFirst({
      where: {
        whatsappNumberId: accountId,
        name: templateName,
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
      message_ttl?: number; // TTL in seconds (30-900)
      ttl_in_seconds?: number | null;
      components: any[];
    }
  ) {
    const account = await this.accountService.getAccountOrThrow(accountId);
    const integratedNumber = account.senderId || account.phoneNumber;
    if (!integratedNumber) {
      throw new Error("Account is missing sender id/phone number");
    }

    // Validate TTL if provided
    if (templateData.message_ttl !== undefined) {
      if (templateData.message_ttl < 30 || templateData.message_ttl > 900) {
        throw new Error("TTL must be between 30 and 900 seconds");
      }
    }

    // Get MSG91 credentials from integration config
    const credentials = await getMsg91Credentials();
    const client = new Msg91Client({
      apiKey: credentials.apiKey,
      baseUrl: credentials.baseUrl,
    });
    const result = await client.createTemplate({
      integrated_number: integratedNumber,
      ...templateData,
    });

    await this.syncTemplates(accountId);

    return result;
  }

  /**
   * Upload media for template header (IMAGE, VIDEO, DOCUMENT)
   * Returns the header_handle to be used in the template creation
   */
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

    const credentials = await getMsg91Credentials();
    const client = new Msg91Client({
      apiKey: credentials.apiKey,
      baseUrl: credentials.baseUrl,
    });

    return client.uploadSampleMedia(integratedNumber, mediaBuffer, mimeType);
  }

  async updateTemplate(
    accountId: number,
    templateName: string,
    components: any[]
  ) {
    const account = await this.accountService.getAccountOrThrow(accountId);
    const integratedNumber = account.senderId || account.phoneNumber;
    if (!integratedNumber) {
      throw new Error("Account is missing sender id/phone number");
    }

    // Get MSG91 credentials from integration config
    const credentials = await getMsg91Credentials();
    const client = new Msg91Client({
      apiKey: credentials.apiKey,
      baseUrl: credentials.baseUrl,
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

    // Get MSG91 credentials from integration config
    const credentials = await getMsg91Credentials();
    const client = new Msg91Client({
      apiKey: credentials.apiKey,
      baseUrl: credentials.baseUrl,
    });

    // Delete from MSG91 using base template name (not concatenated with language)
    const result = await client.deleteTemplate(integratedNumber, templateName);

    // Delete from local database using base template name
    await prisma.whatsAppTemplate.deleteMany({
      where: {
        whatsappNumberId: accountId,
        name: templateName, // This will match the base template name
      },
    });

    return result;
  }
}
