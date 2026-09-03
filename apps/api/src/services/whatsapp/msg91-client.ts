import {
  assertProviderUrl,
  normalizeProviderBaseUrl,
} from "../../utils/provider-url.js";

const MSG91_API_BASE_URL = "https://api.msg91.com/api/v5";

interface Msg91ClientOptions {
  apiKey: string;
  baseUrl?: string;
}

type JsonRecord = Record<string, unknown>;

export interface Msg91FetchedNumber extends JsonRecord {
  phone_number?: string;
  phoneNumber?: string;
  integrated_number?: string;
  name?: string;
  display_name?: string;
  sender_id?: string;
  senderId?: string;
  business_id?: string;
  businessId?: string;
  metadata?: JsonRecord;
}

export interface Msg91FetchedTemplate extends JsonRecord {
  id?: string;
  name: string;
  template_name: string;
  language: string;
  category?: string;
  namespace?: string;
  status?: string;
  rejection_reason?: string;
  variables?: unknown;
  variable_type?: unknown;
  components?: unknown;
  is_disabled?: boolean;
  languages: Array<{
    code: string;
    status: string;
    id: string;
    rejection_reason?: string;
  }>;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function recordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

interface Msg91RecipientPayload {
  phone: string;
  variables?: Record<string, unknown>;
}

interface Msg91TemplateSendPayload {
  templateName: string;
  templateLanguage?: string;
  templatePolicy?: string;
  templateNamespace?: string;
  sender: string;
  campaignName?: string;
  recipients: Msg91RecipientPayload[];
}

export type Msg91TemplateComponent = JsonRecord;

interface Msg91CreateTemplatePayload {
  integrated_number: string;
  template_name: string;
  language: string;
  category: string;
  button_url?: string | boolean;
  message_ttl?: number;
  ttl_in_seconds?: number | null;
  components: Msg91TemplateComponent[];
}

interface Msg91EditTemplatePayload {
  integrated_number: string;
  template_name: string;
  components: Msg91TemplateComponent[];
}

export class Msg91Client {
  private apiKey: string;

  private baseUrl: string;

  constructor(options: Msg91ClientOptions) {
    this.apiKey = options.apiKey.trim();
    if (!this.apiKey) throw new Error("MSG91 API key is required");
    this.baseUrl = normalizeProviderBaseUrl(
      options.baseUrl || MSG91_API_BASE_URL,
      "msg91"
    );
  }

  async fetchTemplates(sender: string) {
    const url = new URL(
      `${this.baseUrl}/whatsapp/get-template-client/${sender}`
    );
    url.searchParams.set("template_name", "");
    url.searchParams.set("template_status", "");
    url.searchParams.set("template_language", "");

    const response = await this.request(url.toString(), {
      method: "GET",
      headers: { accept: "application/json" },
    });

    const responseRecord = isRecord(response) ? response : {};
    const rawTemplates = Array.isArray(response)
      ? response
      : (responseRecord.data ?? responseRecord.templates);
    if (!Array.isArray(rawTemplates)) {
      throw new Error("MSG91 template response has an invalid shape");
    }
    const templatesData = recordArray(rawTemplates);
    if (templatesData.length !== rawTemplates.length) {
      throw new Error("MSG91 template response contains an invalid record");
    }
    const groupedTemplates: Msg91FetchedTemplate[] = [];

    for (const template of templatesData) {
      const name =
        stringValue(template.name) || stringValue(template.template_name);
      const languages = recordArray(template.languages);
      if (!name || languages.length === 0) {
        throw new Error("MSG91 template response is missing name or languages");
      }

      const languageInfo = languages.flatMap(language => {
        const code = stringValue(language.language);
        const status = stringValue(language.status);
        const id =
          stringValue(language.id) ||
          (typeof language.id === "number" ? String(language.id) : undefined);
        if (!code || !status || !id) return [];
        return [
          {
            code,
            status: status.toUpperCase(),
            id,
            ...(stringValue(language.rejection_reason) && {
              rejection_reason: stringValue(language.rejection_reason),
            }),
          },
        ];
      });
      const primaryLang = languages[0];
      const primary = languageInfo[0];
      if (
        languageInfo.length !== languages.length ||
        !primaryLang ||
        !primary
      ) {
        throw new Error("MSG91 template language response is invalid");
      }

      groupedTemplates.push({
        id: primary.id,
        name,
        template_name: name,
        languages: languageInfo,
        language: languageInfo.map(language => language.code).join(", "),
        category: stringValue(template.category)?.toUpperCase(),
        namespace: stringValue(template.namespace),
        status: primary.status.toUpperCase(),
        rejection_reason: stringValue(primaryLang.rejection_reason),
        variables: primaryLang.variables,
        variable_type: primaryLang.variable_type,
        components: primaryLang.code,
        is_disabled:
          typeof primaryLang.is_disabled === "boolean"
            ? primaryLang.is_disabled
            : undefined,
      });
    }

    return groupedTemplates;
  }

  async sendTemplateMessage(payload: Msg91TemplateSendPayload) {
    const url = `${this.baseUrl}/whatsapp/whatsapp-outbound-message/bulk/`;

    const templateObj: JsonRecord = {
      name: payload.templateName,
      language: {
        code: payload.templateLanguage || "en",
        policy: payload.templatePolicy || "deterministic",
      },
      to_and_components: payload.recipients.map(recipient => {
        const components = this.buildComponents(recipient.variables);

        return {
          to: [recipient.phone],
          components: components || {},
        };
      }),
    };

    if (payload.templateNamespace) {
      templateObj.namespace = payload.templateNamespace;
    }

    const requestBody: JsonRecord = {
      integrated_number: payload.sender,
      content_type: "template",
      payload: {
        type: "template",
        template: templateObj,
        messaging_product: "whatsapp",
      },
    };

    if (payload.campaignName) {
      requestBody.campaign_name = payload.campaignName;
    }

    const response = await this.request(url, {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    const responseRecord = isRecord(response) ? response : {};
    const responseData = isRecord(responseRecord.data)
      ? responseRecord.data
      : {};
    return {
      requestId:
        stringValue(responseRecord.request_id) ||
        stringValue(responseRecord.requestId) ||
        stringValue(responseData.request_id) ||
        null,
    };
  }

  async createTemplate(payload: Msg91CreateTemplatePayload) {
    const url = `${this.baseUrl}/whatsapp/client-panel-template/`;

    const apiPayload: Record<string, unknown> = {
      integrated_number: payload.integrated_number,
      template_name: payload.template_name,
      language: payload.language,
      category: payload.category,
      components: payload.components,
    };

    if (payload.button_url !== undefined) {
      apiPayload.button_url = payload.button_url ? "true" : "false";
    }

    if (payload.message_ttl !== undefined) {
      apiPayload.message_ttl = payload.message_ttl;
    }
    if (payload.ttl_in_seconds !== undefined) {
      apiPayload.ttl_in_seconds = payload.ttl_in_seconds;
    }

    return this.request(url, {
      method: "POST",
      body: JSON.stringify(apiPayload),
    });
  }

  async editTemplate(payload: Msg91EditTemplatePayload) {
    const url = `${this.baseUrl}/whatsapp/client-panel-template/`;

    return this.request(url, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteTemplate(integratedNumber: string, templateName: string) {
    const url = new URL(`${this.baseUrl}/whatsapp/client-panel-template/`);
    url.searchParams.set("integrated_number", integratedNumber);
    url.searchParams.set("template_name", templateName);

    return this.request(url.toString(), {
      method: "DELETE",
    });
  }

  async uploadSampleMedia(
    integratedNumber: string,
    mediaBuffer: Buffer,
    mimeType: string
  ): Promise<string> {
    const url = `${this.baseUrl}/whatsapp/sample-media-upload/`;
    assertProviderUrl(url, "msg91");

    const formData = new FormData();
    formData.append("whatsapp_number", integratedNumber);

    const uint8Array = new Uint8Array(mediaBuffer);
    const blob = new Blob([uint8Array], { type: mimeType });
    formData.append(
      "media",
      blob,
      `media.${this.getExtensionFromMimeType(mimeType)}`
    );

    const response = await fetch(url, {
      method: "POST",
      headers: {
        authkey: this.apiKey,
      },
      body: formData,
      redirect: "error",
    });

    if (!response.ok) {
      throw new Error(`MSG91 media upload failed (${response.status})`);
    }

    const result: unknown = await response.json();
    const resultRecord = isRecord(result) ? result : {};
    const data = isRecord(resultRecord.data) ? resultRecord.data : {};
    const mediaUrl = stringValue(data.url);
    if (resultRecord.status !== "success" || !mediaUrl) {
      throw new Error("MSG91 did not accept the sample media upload");
    }

    return mediaUrl;
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "video/mp4": "mp4",
      "video/3gpp": "3gp",
      "application/pdf": "pdf",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
    };
    return mimeToExt[mimeType] || "bin";
  }

  async fetchNumbers() {
    const url = `${this.baseUrl}/whatsapp/whatsapp-activation/`;

    const response = await this.request(url, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    const responseRecord = isRecord(response) ? response : null;
    const value = responseRecord?.data ?? response;
    if (!Array.isArray(value)) {
      throw new Error("MSG91 number response has an invalid shape");
    }
    const numbers = recordArray(value);
    if (numbers.length !== value.length) {
      throw new Error("MSG91 number response contains an invalid record");
    }
    return numbers as Msg91FetchedNumber[];
  }

  private buildComponents(variables?: Record<string, unknown>) {
    if (!variables) {
      return {};
    }

    const result = Object.entries(variables).reduce<
      Record<string, Record<string, unknown>>
    >((acc, [key, value]) => {
      if (value && typeof value === "object") {
        const objValue = value as Record<string, unknown>;

        if (objValue.type === "image" && objValue.image) {
          const imageData = isRecord(objValue.image) ? objValue.image : {};
          const mediaValue =
            stringValue(imageData.id) || stringValue(imageData.link);
          if (!mediaValue) throw new Error("Image variable is missing media");

          acc[key] = {
            type: "image",
            value: mediaValue,
          };
        } else if (objValue.type === "video" && objValue.video) {
          const videoData = isRecord(objValue.video) ? objValue.video : {};
          const mediaValue =
            stringValue(videoData.id) || stringValue(videoData.link);
          if (!mediaValue) throw new Error("Video variable is missing media");

          acc[key] = {
            type: "video",
            value: mediaValue,
          };
        } else if (objValue.type === "document" && objValue.document) {
          const documentData = isRecord(objValue.document)
            ? objValue.document
            : {};
          const mediaValue =
            stringValue(documentData.id) || stringValue(documentData.link);
          if (!mediaValue)
            throw new Error("Document variable is missing media");

          acc[key] = {
            type: "document",
            value: mediaValue,
          };
        } else {
          acc[key] = objValue;
        }
      } else {
        acc[key] = {
          type: "text",
          value: value ?? "",
        };
      }
      return acc;
    }, {});

    return result;
  }

  private async request(url: string, init: RequestInit): Promise<unknown> {
    assertProviderUrl(url, "msg91");
    const headers = new Headers(init.headers);
    headers.set("authkey", this.apiKey);
    if (!(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(url, {
      ...init,
      headers,
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000),
      redirect: "error",
    });

    if (!response.ok) {
      throw new Error(`MSG91 request failed (${response.status})`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as unknown;
    }
    return response.text();
  }
}
