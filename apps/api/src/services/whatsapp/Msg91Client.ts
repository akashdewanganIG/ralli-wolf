interface Msg91ClientOptions {
  apiKey: string;
  baseUrl?: string;
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

interface Msg91TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: string; // TEXT, IMAGE, VIDEO, DOCUMENT, LOCATION
  text?: string;
  example?: {
    header_text?: string[];
    header_handle?: string[]; // For media headers (image/video/document)
    body_text?: string[][];
  };
  buttons?: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE" | "OTP";
    text?: string;
    url?: string;
    phone_number?: string;
    example?: string[];
    otp_type?: "copy_code";
  }>;
}

interface Msg91CreateTemplatePayload {
  integrated_number: string;
  template_name: string;
  language: string;
  category: string; // UTILITY, MARKETING, AUTHENTICATION
  button_url?: string | boolean; // MSG91 expects string "true"/"false"
  message_ttl?: number; // TTL in seconds (30-900) - may not be supported by MSG91
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
    this.apiKey = options.apiKey;
    this.baseUrl =
      options.baseUrl ||
      process.env.MSG91_BASE_URL ||
      "https://api.msg91.com/api/v5";
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

    console.log(
      "MSG91 fetchTemplates raw response:",
      JSON.stringify(response, null, 2)
    );

    // MSG91 returns nested structure: { data: [{ name, category, languages: [...] }] }
    // Group by template name and collect all languages
    const templatesData = Array.isArray(response?.data)
      ? response.data
      : (response?.templates ?? []);
    const groupedTemplates: any[] = [];

    for (const template of templatesData) {
      const { category, name, namespace, languages } = template;

      if (Array.isArray(languages) && languages.length > 0) {
        // Collect all language info
        const languageInfo = languages.map(lang => ({
          code: lang.language,
          status: lang.status,
          id: lang.id,
          rejection_reason: lang.rejection_reason,
        }));

        // Use the first language's data as the primary template data
        const primaryLang = languages[0];

        groupedTemplates.push({
          id: primaryLang.id, // Use first language's ID as primary
          name, // Use base template name (not concatenated with language)
          template_name: name,
          languages: languageInfo, // Array of all languages with their statuses
          language: languageInfo.map(l => l.code).join(", "), // Comma-separated for display
          category,
          namespace,
          status: primaryLang.status, // Use primary status (or could be most approved one)
          rejection_reason: primaryLang.rejection_reason,
          variables: primaryLang.variables,
          variable_type: primaryLang.variable_type,
          components: primaryLang.code, // 'code' in MSG91 is the components array
          is_disabled: primaryLang.is_disabled,
        });
      }
    }

    console.log(
      `Grouped ${groupedTemplates.length} templates from ${templatesData.length} base templates`
    );
    return groupedTemplates;
  }

  async sendTemplateMessage(payload: Msg91TemplateSendPayload) {
    const url = `${this.baseUrl}/whatsapp/whatsapp-outbound-message/bulk/`;

    const templateObj: Record<string, any> = {
      name: payload.templateName,
      language: {
        code: payload.templateLanguage || "en",
        policy: payload.templatePolicy || "deterministic",
      },
      to_and_components: payload.recipients.map(recipient => {
        const components = this.buildComponents(recipient.variables);
        // MSG91 uses flat object format, not WhatsApp Business API array
        return {
          to: [recipient.phone],
          components: components || {},
        };
      }),
    };

    // Add namespace if provided (required by MSG91)
    if (payload.templateNamespace) {
      templateObj.namespace = payload.templateNamespace;
    }

    const requestBody: Record<string, any> = {
      integrated_number: payload.sender,
      content_type: "template",
      payload: {
        type: "template",
        template: templateObj,
        messaging_product: "whatsapp",
      },
    };

    // campaign_name goes at the root level, not inside template
    if (payload.campaignName) {
      requestBody.campaign_name = payload.campaignName;
    }

    console.log("=== MSG91 Send Template Request ===");
    console.log("URL:", url);
    console.log("Payload:", JSON.stringify(requestBody, null, 2));

    return this.request(url, {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
  }

  async createTemplate(payload: Msg91CreateTemplatePayload) {
    const url = `${this.baseUrl}/whatsapp/client-panel-template/`;

    // Convert button_url to string as MSG91 expects "true"/"false" string
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

    // Note: message_ttl may not be supported by MSG91 - include if provided
    if (payload.message_ttl !== undefined) {
      apiPayload.message_ttl = payload.message_ttl;
    }
    if (payload.ttl_in_seconds !== undefined) {
      apiPayload.ttl_in_seconds = payload.ttl_in_seconds;
    }

    console.log("=== MSG91 Create Template Request ===");
    console.log("URL:", url);
    console.log("Payload:", JSON.stringify(apiPayload, null, 2));
    const bodyComponent = Array.isArray(apiPayload.components)
      ? apiPayload.components.find(
          (component: any) => component?.type === "BODY"
        )
      : null;
    if (bodyComponent) {
      console.log(
        "BODY component being sent to MSG91:",
        JSON.stringify(bodyComponent, null, 2)
      );
    } else {
      console.log("No BODY component found in payload.");
    }

    try {
      const result = await this.request(url, {
        method: "POST",
        body: JSON.stringify(apiPayload),
      });
      console.log("=== MSG91 Create Template Response ===");
      console.log("Response:", JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error("=== MSG91 Create Template Error ===");
      console.error("Error:", error);
      throw error;
    }
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

  /**
   * Upload media for template header (IMAGE, VIDEO, DOCUMENT)
   * Returns the header_handle to be used in the template creation
   */
  async uploadSampleMedia(
    integratedNumber: string,
    mediaBuffer: Buffer,
    mimeType: string
  ): Promise<string> {
    const url = `${this.baseUrl}/whatsapp/sample-media-upload/`;

    console.log("=== MSG91 Media Upload Request ===");
    console.log("URL:", url);
    console.log("WhatsApp Number:", integratedNumber);
    console.log("MIME Type:", mimeType);
    console.log("Buffer Size:", mediaBuffer.length, "bytes");

    const formData = new FormData();
    formData.append("whatsapp_number", integratedNumber);

    // Create a blob from the buffer - convert Buffer to Uint8Array for proper typing
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
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("=== MSG91 Media Upload Error ===");
      console.error("Status:", response.status);
      console.error("Response:", text);
      throw new Error(
        `MSG91 media upload failed (${response.status}): ${text}`
      );
    }

    const result = await response.json();
    console.log("=== MSG91 Media Upload Response ===");
    console.log("Response:", JSON.stringify(result, null, 2));

    if (result.status !== "success" || !result.data?.url) {
      throw new Error(
        "Failed to upload media: " + (result.errors || "Unknown error")
      );
    }

    console.log("Header Handle:", result.data.url);
    return result.data.url; // This is the header_handle
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
    console.log("Fetching numbers from URL:", url);

    const response = await this.request(url, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    console.log("MSG91 fetchNumbers response:", response);
    return response?.data || response || [];
  }

  /**
   * Builds WhatsApp Business API standard components array format
   * Converts flat key-value pairs to array of component objects
   */
  private buildComponentsArray(variables?: Record<string, unknown>): any[] {
    if (!variables) {
      return [];
    }

    console.log(
      "🔧 buildComponentsArray INPUT:",
      JSON.stringify(variables, null, 2)
    );

    const components: any[] = [];
    const headerParams: any[] = [];
    const bodyParams: any[] = [];
    const buttonParams: Record<number, any> = {};

    // Group variables by component type
    Object.entries(variables).forEach(([key, value]) => {
      if (value && typeof value === "object") {
        const objValue = value as Record<string, unknown>;

        // Header media (header_1)
        if (key.startsWith("header_")) {
          if (objValue.type === "image" && objValue.image) {
            const imageData = objValue.image as Record<string, unknown>;
            const mediaValue = imageData.id || imageData.link;
            const isUrl =
              typeof mediaValue === "string" &&
              (mediaValue.startsWith("http://") ||
                mediaValue.startsWith("https://"));

            console.log(`📸 Header image:`, { mediaValue, isUrl });

            headerParams.push({
              type: "image",
              image: isUrl ? { link: mediaValue } : { id: mediaValue },
            });
          } else if (objValue.type === "video" && objValue.video) {
            const videoData = objValue.video as Record<string, unknown>;
            const mediaValue = videoData.id || videoData.link;
            const isUrl =
              typeof mediaValue === "string" &&
              (mediaValue.startsWith("http://") ||
                mediaValue.startsWith("https://"));

            headerParams.push({
              type: "video",
              video: isUrl ? { link: mediaValue } : { id: mediaValue },
            });
          } else if (objValue.type === "document" && objValue.document) {
            const documentData = objValue.document as Record<string, unknown>;
            const mediaValue = documentData.id || documentData.link;
            const isUrl =
              typeof mediaValue === "string" &&
              (mediaValue.startsWith("http://") ||
                mediaValue.startsWith("https://"));

            headerParams.push({
              type: "document",
              document: {
                ...(isUrl ? { link: mediaValue } : { id: mediaValue }),
                filename: documentData.filename || "document.pdf",
              },
            });
          } else if (objValue.type === "text") {
            headerParams.push({
              type: "text",
              text: objValue.value || "",
            });
          }
        }
        // Body parameters (body_1, body_2, etc.)
        else if (key.startsWith("body_")) {
          const match = key.match(/body_(\d+)/);
          if (match && match[1]) {
            const index = parseInt(match[1]) - 1; // Convert to 0-based index
            bodyParams[index] = {
              type: "text",
              text: String(objValue.value || objValue.text || ""),
            };
          }
        }
        // Button parameters (button_0, button_1, etc.)
        else if (key.startsWith("button_")) {
          const match = key.match(/button_(\d+)/);
          if (match && match[1]) {
            const index = parseInt(match[1]);
            if (objValue.type === "text" && objValue.subtype === "url") {
              buttonParams[index] = {
                type: "text",
                text: String(objValue.value || ""),
              };
            } else {
              buttonParams[index] = objValue;
            }
          }
        }
      } else if (typeof value === "string" && value.trim()) {
        // Handle simple string values
        if (key.startsWith("body_")) {
          const match = key.match(/body_(\d+)/);
          if (match && match[1]) {
            const index = parseInt(match[1]) - 1;
            bodyParams[index] = {
              type: "text",
              text: value,
            };
          }
        } else if (key.startsWith("button_")) {
          const match = key.match(/button_(\d+)/);
          if (match && match[1]) {
            const index = parseInt(match[1]);
            buttonParams[index] = {
              type: "text",
              text: value,
            };
          }
        }
      }
    });

    // Build components array in order
    if (headerParams.length > 0) {
      components.push({
        type: "header",
        parameters: headerParams,
      });
    }

    // Body params must be in order (fill gaps with empty strings if needed)
    const bodyParamsOrdered = [];
    const maxBodyIndex = Math.max(...Object.keys(bodyParams).map(Number), -1);
    for (let i = 0; i <= maxBodyIndex; i++) {
      bodyParamsOrdered.push(bodyParams[i] || { type: "text", text: "" });
    }
    if (bodyParamsOrdered.length > 0) {
      components.push({
        type: "body",
        parameters: bodyParamsOrdered,
      });
    }

    // Add button parameters if any
    Object.entries(buttonParams).forEach(([index, param]) => {
      components.push({
        type: "button",
        sub_type: "url",
        index: parseInt(index),
        parameters: [param],
      });
    });

    console.log(
      "🔧 buildComponentsArray OUTPUT:",
      JSON.stringify(components, null, 2)
    );
    return components;
  }

  private buildComponents(variables?: Record<string, unknown>) {
    if (!variables) {
      return {};
    }

    console.log(
      "🔧 buildComponents INPUT:",
      JSON.stringify(variables, null, 2)
    );

    const result = Object.entries(variables).reduce<
      Record<string, Record<string, unknown>>
    >((acc, [key, value]) => {
      if (value && typeof value === "object") {
        const objValue = value as Record<string, unknown>;

        // Handle media types
        // MSG91 expects simple format: { type: "image", value: "url" }
        if (objValue.type === "image" && objValue.image) {
          const imageData = objValue.image as Record<string, unknown>;
          const mediaValue = imageData.id || imageData.link;

          console.log(`📸 Image field "${key}":`, {
            mediaValue,
            format: "MSG91 simple format (type + value)",
          });

          acc[key] = {
            type: "image",
            value: String(mediaValue),
          };
        } else if (objValue.type === "video" && objValue.video) {
          const videoData = objValue.video as Record<string, unknown>;
          const mediaValue = videoData.id || videoData.link;

          console.log(`🎥 Video field "${key}":`, {
            mediaValue,
            format: "MSG91 simple format (type + value)",
          });

          acc[key] = {
            type: "video",
            value: String(mediaValue),
          };
        } else if (objValue.type === "document" && objValue.document) {
          const documentData = objValue.document as Record<string, unknown>;
          const mediaValue = documentData.id || documentData.link;

          console.log(`📄 Document field "${key}":`, {
            mediaValue,
            format: "MSG91 simple format (type + value)",
          });

          acc[key] = {
            type: "document",
            value: String(mediaValue),
          };
        } else {
          // Pass through as-is for other object types
          console.log(`📝 Non-media field "${key}":`, objValue);
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

    console.log("🔧 buildComponents OUTPUT:", JSON.stringify(result, null, 2));
    return result;
  }

  private async request(url: string, init: RequestInit) {
    const headers: Record<string, string> = {
      authkey: this.apiKey,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string>),
    };
    const response = await fetch(url, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`MSG91 request failed (${response.status}): ${text}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    return response.text();
  }
}
