"use client";

import { useState, useRef, useEffect } from "react";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { whatsappService } from "@/lib/api/services";
import { Button, SelectField } from "@repo/ui";
import { toast } from "@/lib/toast";
import {
  X,
  Plus,
  Trash2,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Image,
  Video,
  FileText,
  MapPin,
  AlertCircle,
} from "@repo/ui/icons";
import { WhatsAppPreview } from "./whatsapp-preview";

type HeaderFormat =
  | "NONE"
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "DOCUMENT"
  | "LOCATION";
type ButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE" | "OTP";

type TemplateButton = {
  type: ButtonType;
  text?: string;
  url?: string;
  phone_number?: string;
  otp_type?: "copy_code";
  example?: string[];
};

type TemplateComponent = {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: string;
  text?: string;
  add_security_recommendation?: boolean | null;
  code_expiration_minutes?: number | null;
  example?: {
    header_text?: string[];
    header_handle?: string[];
    body_text?: string[][];
  };
  buttons?: TemplateButton[];
};

interface CreateTemplateModalProps {
  accountId: number;
  onClose: () => void;
  onSuccess: () => void;
}

type TemplateFormError = {
  title: string;
  details?: string[];
};

const AUTH_TEMPLATE_DEFAULT_BODY =
  "{{1}} is your verification code. Pls do not share this with anyone.";
const AUTH_TEMPLATE_SAMPLE_VALUE = "123456";

const ALLOW_AUTH_TEMPLATES =
  process.env.NEXT_PUBLIC_ALLOW_AUTH_TEMPLATES === "true";
const WHATSAPP_TEXT_ONLY_MVP =
  process.env.NEXT_PUBLIC_WHATSAPP_TEXT_ONLY_MVP === "true";
const ALLOW_UTILITY_TEMPLATES =
  process.env.NEXT_PUBLIC_ALLOW_UTILITY_TEMPLATES === "true";

// Comprehensive language list with codes
const LANGUAGES = [
  { code: "af", name: "Afrikaans" },
  { code: "sq", name: "Albanian" },
  { code: "ar", name: "Arabic" },
  { code: "az", name: "Azerbaijani" },
  { code: "bn", name: "Bengali" },
  { code: "bg", name: "Bulgarian" },
  { code: "ca", name: "Catalan" },
  { code: "zh_CN", name: "Chinese (CHN)" },
  { code: "zh_HK", name: "Chinese (HKG)" },
  { code: "zh_TW", name: "Chinese (TAI)" },
  { code: "hr", name: "Croatian" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "nl", name: "Dutch" },
  { code: "en", name: "English" },
  { code: "en_GB", name: "English (UK)" },
  { code: "en_US", name: "English (US)" },
  { code: "et", name: "Estonian" },
  { code: "fil", name: "Filipino" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "ka", name: "Georgian" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "gu", name: "Gujarati" },
  { code: "ha", name: "Hausa" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hu", name: "Hungarian" },
  { code: "id", name: "Indonesian" },
  { code: "ga", name: "Irish" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "kn", name: "Kannada" },
  { code: "kk", name: "Kazakh" },
  { code: "rw_RW", name: "Kinyarwanda" },
  { code: "ko", name: "Korean" },
  { code: "ky_KG", name: "Kyrgyz (Kyrgyzstan)" },
  { code: "lo", name: "Lao" },
  { code: "lv", name: "Latvian" },
  { code: "lt", name: "Lithuanian" },
  { code: "mk", name: "Macedonian" },
  { code: "ms", name: "Malay" },
  { code: "ml", name: "Malayalam" },
  { code: "mr", name: "Marathi" },
  { code: "nb", name: "Norwegian" },
  { code: "fa", name: "Persian" },
  { code: "pl", name: "Polish" },
  { code: "pt_BR", name: "Portuguese (BR)" },
  { code: "pt_PT", name: "Portuguese (POR)" },
  { code: "pa", name: "Punjabi" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sr", name: "Serbian" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "es", name: "Spanish" },
  { code: "es_AR", name: "Spanish (ARG)" },
  { code: "es_ES", name: "Spanish (SPA)" },
  { code: "es_MX", name: "Spanish (MEX)" },
  { code: "sw", name: "Swahili" },
  { code: "sv", name: "Swedish" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
  { code: "uz", name: "Uzbek" },
  { code: "vi", name: "Vietnamese" },
  { code: "zu", name: "Zulu" },
];

export function CreateTemplateModal({
  accountId,
  onClose,
  onSuccess,
}: CreateTemplateModalProps) {
  const [templateName, setTemplateName] = useState("");
  const [language, setLanguage] = useState("en");
  const [category, setCategory] = useState<
    "MARKETING" | "UTILITY" | "AUTHENTICATION"
  >("MARKETING");
  const [ttl, setTtl] = useState<number | undefined>(undefined);

  // Handle category change
  const handleCategoryChange = (
    newCategory: "MARKETING" | "UTILITY" | "AUTHENTICATION"
  ) => {
    if (newCategory === "AUTHENTICATION" && !ALLOW_AUTH_TEMPLATES) {
      toast.error(
        "Authentication templates are disabled. Please choose Marketing or Utility."
      );
      return;
    }
    setCategory(newCategory);

    // Auto-configure for AUTHENTICATION
    if (newCategory === "AUTHENTICATION") {
      handleBodyTextChange(AUTH_TEMPLATE_DEFAULT_BODY);
      setHeaderFormat("NONE");
      setHeaderText("");
      setHeaderMediaHandle("");
      setHeaderMediaFileName("");
      setHeaderSampleText("");
      setBodySamples([AUTH_TEMPLATE_SAMPLE_VALUE]);
      setFooterText("");
      setButtons([]);
      setCodeExpirationMinutes(undefined);
      setSecurityRecommendation(false);
      return;
    }
    setButtons([]);
  };

  useEffect(() => {
    if (!ALLOW_AUTH_TEMPLATES && category === "AUTHENTICATION") {
      setCategory("MARKETING");
    }
  }, [category]);
  const [loading, setLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [formError, setFormError] = useState<TemplateFormError | null>(null);

  // Header state
  const [headerFormat, setHeaderFormat] = useState<HeaderFormat>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerMediaHandle, setHeaderMediaHandle] = useState("");
  const [headerMediaFileName, setHeaderMediaFileName] = useState("");
  const [headerSampleText, setHeaderSampleText] = useState("");
  const [headerVariableCount, setHeaderVariableCount] = useState(0);

  // Body state
  const [bodyText, setBodyText] = useState("");
  const [bodySamples, setBodySamples] = useState<string[]>([]);
  const [bodyVariableCount, setBodyVariableCount] = useState(0);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Footer state
  const [footerText, setFooterText] = useState("");

  // Buttons state
  const [buttons, setButtons] = useState<TemplateButton[]>([]);
  const [codeExpirationMinutes, setCodeExpirationMinutes] = useState<
    number | undefined
  >(undefined);
  const [securityRecommendation, setSecurityRecommendation] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Count variables in text
  const countVariables = (text: string): number => {
    const matches = text.match(/\{\{\d+\}\}/g);
    return matches ? matches.length : 0;
  };

  // Update variable counts when text changes
  const handleHeaderTextChange = (text: string) => {
    setHeaderText(text);
    const count = countVariables(text);
    setHeaderVariableCount(count);
    if (count > 0 && !headerSampleText) {
      setHeaderSampleText("");
    }
  };

  const handleBodyTextChange = (text: string) => {
    setBodyText(text);
    const count = countVariables(text);
    setBodyVariableCount(count);
    // Adjust samples array
    const newSamples = [...bodySamples];
    while (newSamples.length < count) newSamples.push("");
    while (newSamples.length > count) newSamples.pop();
    setBodySamples(newSamples);
  };

  // Insert formatting at cursor
  const insertFormatting = (format: string) => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = bodyText.substring(start, end);

    let newText = "";
    let cursorOffset = 0;

    switch (format) {
      case "bold":
        newText = `*${selectedText}*`;
        cursorOffset = selectedText ? newText.length : 1;
        break;
      case "italic":
        newText = `_${selectedText}_`;
        cursorOffset = selectedText ? newText.length : 1;
        break;
      case "strike":
        newText = `~${selectedText}~`;
        cursorOffset = selectedText ? newText.length : 1;
        break;
      case "code":
        newText = `\`\`\`${selectedText}\`\`\``;
        cursorOffset = selectedText ? newText.length : 3;
        break;
      case "variable": {
        const varNum = bodyVariableCount + 1;
        newText = `{{${varNum}}}`;
        cursorOffset = newText.length;
        break;
      }
    }

    const updatedText =
      bodyText.substring(0, start) + newText + bodyText.substring(end);
    handleBodyTextChange(updatedText);

    // Set cursor position after update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }, 0);
  };

  // Add variable to header
  const addHeaderVariable = () => {
    const varNum = headerVariableCount + 1;
    handleHeaderTextChange(headerText + `{{${varNum}}}`);
  };

  // Handle media upload for sample (required for template approval)
  const handleMediaUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type based on header format
    const validTypes: Record<string, string[]> = {
      IMAGE: ["image/jpeg", "image/png", "image/webp"],
      VIDEO: ["video/mp4", "video/3gpp"],
      DOCUMENT: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
    };

    if (!validTypes[headerFormat]?.includes(file.type)) {
      toast.error(
        `Invalid file type. Allowed: ${validTypes[headerFormat]?.join(", ")}`
      );
      return;
    }

    setUploadingMedia(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          if (!base64) {
            toast.error("Failed to read file");
            setUploadingMedia(false);
            return;
          }
          const uploadResult = await whatsappService.uploadTemplateMedia({
            accountId,
            mediaBase64: base64,
            mimeType: file.type,
          });
          setHeaderMediaHandle(uploadResult.headerHandle);
          setHeaderMediaFileName(file.name);
          toast.success("Sample media uploaded for approval");
        } catch (error: any) {
          toast.error("Failed to upload: " + error.message);
        } finally {
          setUploadingMedia(false);
        }
      };
      reader.onerror = () => {
        toast.error("Failed to read file");
        setUploadingMedia(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error("Failed to upload: " + error.message);
      setUploadingMedia(false);
    }
  };

  // Button management
  const addButton = (type: ButtonType) => {
    // Check limits
    const phoneCount = buttons.filter(b => b.type === "PHONE_NUMBER").length;
    const urlCount = buttons.filter(b => b.type === "URL").length;

    if (type === "PHONE_NUMBER" && phoneCount >= 1) {
      toast.error("Maximum 1 phone number button allowed");
      return;
    }
    if (type === "URL" && urlCount >= 2) {
      toast.error("Maximum 2 URL buttons allowed");
      return;
    }

    const newButton: TemplateButton = {
      type,
      text: type === "COPY_CODE" ? "Copy Code" : "",
      ...(type === "URL" && { url: "" }),
      ...(type === "PHONE_NUMBER" && { phone_number: "" }),
      ...(type === "COPY_CODE" && { example: [AUTH_TEMPLATE_SAMPLE_VALUE] }),
    };
    setButtons(prev => [...prev, newButton]);
  };

  const updateButton = (index: number, updates: Partial<TemplateButton>) => {
    const updated = [...buttons];
    if (updated[index]) {
      updated[index] = { ...updated[index], ...updates };
      setButtons(updated);
    }
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  // Build components for API
  const buildComponents = (): TemplateComponent[] => {
    if (category === "AUTHENTICATION") {
      const components: TemplateComponent[] = [
        {
          type: "BODY",
          add_security_recommendation: securityRecommendation || null,
        },
        {
          type: "FOOTER",
          code_expiration_minutes: codeExpirationMinutes ?? null,
        },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "OTP",
              otp_type: "copy_code",
            },
          ],
        },
      ];
      return components;
    }

    const components: TemplateComponent[] = [];

    // Header
    if (headerFormat !== "NONE") {
      const headerComponent: TemplateComponent = {
        type: "HEADER",
        format: headerFormat,
      };

      if (headerFormat === "TEXT") {
        headerComponent.text = headerText;
        if (headerVariableCount > 0 && headerSampleText) {
          headerComponent.example = {
            header_text: [headerSampleText],
          };
        }
      } else if (
        ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat) &&
        headerMediaHandle
      ) {
        // For media headers, include the uploaded sample's header_handle
        headerComponent.example = {
          header_handle: [headerMediaHandle],
        };
      }
      // LOCATION doesn't need additional fields

      components.push(headerComponent);
    }

    const bodyComponent: TemplateComponent = {
      type: "BODY",
      text: bodyText,
    };
    if (bodyVariableCount > 0) {
      const normalizedSamples = bodySamples.map(sample => {
        const trimmed = sample?.trim() || "";
        if (trimmed) {
          return trimmed;
        }
        return "";
      });
      if (normalizedSamples.some(sample => sample)) {
        bodyComponent.example = {
          body_text: [normalizedSamples],
        };
      }
    }
    components.push(bodyComponent);

    // Footer
    if (footerText.trim()) {
      components.push({
        type: "FOOTER",
        text: footerText,
      });
    }

    // Buttons
    if (buttons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: buttons.map(btn => {
          const button: any = {
            type: btn.type,
            text: btn.text,
          };
          if (btn.type === "URL") {
            button.url = btn.url;
            // Add example if URL has variables
            if (btn.url?.includes("{{")) {
              button.example = [btn.url.replace(/\{\{\d+\}\}/g, "example")];
            }
          }
          if (btn.type === "PHONE_NUMBER") {
            button.phone_number = btn.phone_number;
          }
          const sanitizedExample = btn.example
            ?.map(value => value.trim())
            .filter(Boolean);
          if (!button.example && sanitizedExample?.length) {
            button.example = sanitizedExample;
          }
          return button;
        }),
      });
    }

    return components;
  };

  // Build preview components (simplified for preview)
  const buildPreviewComponents = () => {
    const components: any[] = [];

    if (category === "AUTHENTICATION") {
      components.push({
        type: "BODY",
        text: "XXXXXX is your verification code.",
      });
      components.push({
        type: "BUTTONS",
        buttons: [{ type: "OTP", text: "Copy code" }],
      });
      return components;
    }

    if (headerFormat === "TEXT" && headerText) {
      components.push({ type: "HEADER", format: "TEXT", text: headerText });
    } else if (headerFormat === "LOCATION") {
      components.push({ type: "HEADER", format: "LOCATION" });
    } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat)) {
      components.push({ type: "HEADER", format: headerFormat });
    }

    if (bodyText) {
      components.push({ type: "BODY", text: bodyText });
    }

    if (footerText) {
      components.push({ type: "FOOTER", text: footerText });
    }

    if (buttons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: buttons.map(b => ({ type: b.type, text: b.text || "Button" })),
      });
    }

    return components;
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!templateName.trim()) {
      const errorState = { title: "Template name is required" };
      setFormError(errorState);
      toast.error(errorState.title);
      return;
    }

    if (category !== "AUTHENTICATION" && !bodyText.trim()) {
      const errorState = { title: "Body text is required" };
      setFormError(errorState);
      toast.error(errorState.title);
      return;
    }

    // Validate TTL
    if (ttl !== undefined && (ttl < 30 || ttl > 900)) {
      const errorState = { title: "TTL must be between 30 and 900 seconds" };
      setFormError(errorState);
      toast.error(errorState.title);
      return;
    }

    if (category !== "AUTHENTICATION" && bodyVariableCount > 0) {
      const missingIndex = bodySamples.findIndex(sample => !sample?.trim());
      if (missingIndex !== -1) {
        const errorState = {
          title: "Sample values are required for all variables",
          details: [
            `Please provide a sample value for {{${missingIndex + 1}}}`,
          ],
        };
        setFormError(errorState);
        toast.error(errorState.title);
        return;
      }
    }

    // Check if media header requires sample upload
    if (
      ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat) &&
      !headerMediaHandle
    ) {
      const errorState = {
        title: "Please upload a sample media file for template approval",
      };
      setFormError(errorState);
      toast.error(errorState.title);
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        accountId,
        template_name: templateName,
        language,
        category,
        components: buildComponents(),
      };

      if (category === "AUTHENTICATION") {
        payload.ttl_in_seconds = ttl ?? null;
      } else {
        payload.button_url = buttons.some(b => b.type === "URL");
        payload.message_ttl = ttl;
      }

      await whatsappService.createTemplate(payload);

      toast.success("Template created successfully");
      setFormError(null);
      onSuccess();
    } catch (error: any) {
      const structuredError = buildTemplateFormError(error);
      setFormError(structuredError);
      toast.error(structuredError.title);
    } finally {
      setLoading(false);
    }
  };

  // Get button counts for display
  const phoneButtonCount = buttons.filter(
    b => b.type === "PHONE_NUMBER"
  ).length;
  const urlButtonCount = buttons.filter(b => b.type === "URL").length;

  const handleClose = () => {
    if (
      confirm(
        "Are you sure you want to close? Any unsaved changes will be lost."
      )
    ) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-overlay p-4 backdrop-blur-[1px]"
      onClick={e => {
        // Prevent closing when clicking on the overlay
        e.stopPropagation();
      }}
    >
      <div
        className="flex max-h-[calc(100svh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl shadow-slate-950/10"
        onClick={e => {
          // Prevent clicks inside the modal from propagating to overlay
          e.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-4 sm:px-6">
          <h2 className="text-xl font-bold">Create WhatsApp Template</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground hover:text-text-secondary"
            aria-label="Close create template dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Form Section */}
          <form
            onSubmit={handleCreateTemplate}
            className="flex-1 p-4 space-y-4 overflow-y-auto"
          >
            {formError && (
              <div className="border border-error-border bg-error-surface text-error-foreground rounded p-4 text-sm space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <AlertCircle className="h-4 w-4" />
                  <span>{formError.title}</span>
                </div>
                {formError.details && formError.details.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1">
                    {formError.details.map(detail => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Template Name *
                </label>
                <Input
                  type="text"
                  value={templateName}
                  onChange={e =>
                    setTemplateName(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_")
                    )
                  }
                  placeholder="e.g., welcome_message"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use lowercase letters, numbers, and underscores only
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Category *
                  </label>
                  <SelectField
                    value={category}
                    onChange={e => handleCategoryChange(e.target.value as any)}
                  >
                    <option value="MARKETING">Marketing</option>
                    {ALLOW_UTILITY_TEMPLATES && (
                      <option value="UTILITY">Utility</option>
                    )}
                    {ALLOW_AUTH_TEMPLATES && (
                      <option value="AUTHENTICATION">Authentication</option>
                    )}
                  </SelectField>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Language *
                  </label>
                  <SelectField
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </SelectField>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    TTL (seconds)
                  </label>
                  <Input
                    type="number"
                    value={ttl || ""}
                    onChange={e =>
                      setTtl(
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    placeholder="30-900"
                    min={30}
                    max={900}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    How long Meta retries sending if undelivered (Default: 30
                    Days)
                  </p>
                </div>
              </div>
            </div>

            {/* Header */}
            {category !== "AUTHENTICATION" && (
              <div className="border rounded p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Header</h3>
                  <SelectField
                    className="w-full sm:w-40"
                    value={headerFormat}
                    onChange={e => {
                      const value = e.target.value as HeaderFormat;
                      // MVP flag check: only allow text headers when flag is true
                      if (
                        WHATSAPP_TEXT_ONLY_MVP &&
                        value !== "NONE" &&
                        value !== "TEXT"
                      ) {
                        toast.error(
                          "Only text headers are supported in MVP mode. Media and location headers will be available when MVP mode is disabled."
                        );
                        return;
                      }
                      setHeaderFormat(value);
                      setHeaderText("");
                      setHeaderMediaHandle("");
                      setHeaderMediaFileName("");
                      setHeaderSampleText("");
                      setHeaderVariableCount(0);
                    }}
                  >
                    <option value="NONE">None</option>
                    <option value="TEXT">Text</option>
                    {!WHATSAPP_TEXT_ONLY_MVP && (
                      <>
                        <option value="IMAGE">Image</option>
                        <option value="VIDEO">Video</option>
                        <option value="DOCUMENT">Document</option>
                        <option value="LOCATION">Location</option>
                      </>
                    )}
                  </SelectField>
                </div>

                {headerFormat === "TEXT" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        className="flex-1"
                        value={headerText}
                        onChange={e => handleHeaderTextChange(e.target.value)}
                        placeholder="Header text (max 60 characters)"
                        maxLength={60}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addHeaderVariable}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Variable
                      </Button>
                    </div>
                    {headerVariableCount > 0 && (
                      <Input
                        type="text"
                        className="bg-surface-elevated"
                        value={headerSampleText}
                        onChange={e => setHeaderSampleText(e.target.value)}
                        placeholder="Sample value for header variable"
                      />
                    )}
                  </div>
                )}

                {["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat) && (
                  <div className="space-y-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept={
                        headerFormat === "IMAGE"
                          ? "image/jpeg,image/png,image/webp"
                          : headerFormat === "VIDEO"
                            ? "video/mp4,video/3gpp"
                            : "application/pdf,.doc,.docx"
                      }
                      onChange={handleMediaUpload}
                    />

                    <div
                      className={`p-3 rounded ${
                        headerFormat === "IMAGE"
                          ? "bg-info-surface"
                          : headerFormat === "VIDEO"
                            ? "bg-surface-secondary"
                            : "bg-warning-surface"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {headerFormat === "IMAGE" && (
                          <Image className="h-5 w-5 text-info" />
                        )}
                        {headerFormat === "VIDEO" && (
                          <Video className="h-5 w-5 text-muted-foreground" />
                        )}
                        {headerFormat === "DOCUMENT" && (
                          <FileText className="h-5 w-5 text-warning" />
                        )}
                        <span className="text-sm font-medium">
                          {headerFormat.charAt(0) +
                            headerFormat.slice(1).toLowerCase()}{" "}
                          Header
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mb-3">
                        Upload a sample {headerFormat.toLowerCase()} for Meta to
                        review during approval. The actual{" "}
                        {headerFormat.toLowerCase()} will be provided when
                        sending messages.
                      </p>

                      {headerMediaHandle ? (
                        <div className="flex items-center justify-between bg-surface p-2 rounded border">
                          <span className="text-sm text-success-foreground truncate">
                            {headerMediaFileName}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingMedia}
                          >
                            Change
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingMedia}
                          className="w-full"
                        >
                          {uploadingMedia
                            ? "Uploading..."
                            : `Upload Sample ${headerFormat.charAt(0) + headerFormat.slice(1).toLowerCase()}`}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {headerFormat === "LOCATION" && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary bg-success-surface p-3 rounded">
                    <MapPin className="h-5 w-5 text-success" />
                    <span>
                      Location header - coordinates will be provided when
                      sending messages
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Body / Authentication settings */}
            {category === "AUTHENTICATION" ? (
              <div className="border rounded p-4 space-y-3">
                <h3 className="font-medium">Authentication Settings</h3>
                <p className="text-sm text-text-secondary">
                  WhatsApp automatically formats the OTP message body. Configure
                  additional requirements below.
                </p>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Code Expiration (minutes)
                  </label>
                  <Input
                    type="number"
                    placeholder="Optional"
                    min={1}
                    max={90}
                    value={codeExpirationMinutes ?? ""}
                    onChange={e =>
                      setCodeExpirationMinutes(
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Optional expiry hint shown to customers.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={securityRecommendation}
                    onCheckedChange={setSecurityRecommendation}
                  />
                  Add security recommendation
                </label>
              </div>
            ) : (
              <div className="border rounded p-4 space-y-3">
                <h3 className="font-medium">Body *</h3>
                <div className="flex gap-1 mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting("bold")}
                    title="Bold"
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting("italic")}
                    title="Italic"
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting("strike")}
                    title="Strikethrough"
                  >
                    <Strikethrough className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting("code")}
                    title="Code"
                  >
                    <Code className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertFormatting("variable")}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Variable
                  </Button>
                </div>
                <Textarea
                  ref={bodyTextareaRef}
                  rows={4}
                  value={bodyText}
                  onChange={e => handleBodyTextChange(e.target.value)}
                  placeholder="Enter message body. Use *bold*, _italic_, ~strike~, ```code```"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{{1}}"}, {"{{2}}"} for variables. Format: *bold*,
                  _italic_, ~strike~, ```code```
                </p>
                {bodyVariableCount > 0 && (
                  <div className="space-y-2 bg-surface-elevated p-3 rounded">
                    <p className="text-xs font-medium text-text-secondary">
                      Sample values for variables:
                    </p>
                    {bodySamples.map((sample, idx) => (
                      <Input
                        key={idx}
                        type="text"
                        value={sample}
                        onChange={e => {
                          const updated = [...bodySamples];
                          updated[idx] = e.target.value;
                          setBodySamples(updated);
                        }}
                        placeholder={`Sample for {{${idx + 1}}}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            {category !== "AUTHENTICATION" && (
              <div className="border rounded p-4 space-y-3">
                <h3 className="font-medium">Footer</h3>
                <Input
                  type="text"
                  value={footerText}
                  onChange={e => setFooterText(e.target.value)}
                  placeholder="Footer text (optional, max 60 characters)"
                  maxLength={60}
                />
              </div>
            )}

            {/* Buttons */}
            {category === "AUTHENTICATION" ? (
              <div className="border rounded p-4 space-y-3">
                <h3 className="font-medium">Buttons</h3>
                <p className="text-sm text-text-secondary">
                  The Copy Code button is included automatically for
                  authentication templates.
                </p>
              </div>
            ) : (
              <div className="border rounded p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Buttons</h3>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addButton("QUICK_REPLY")}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Quick Reply
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addButton("PHONE_NUMBER")}
                      disabled={phoneButtonCount >= 1}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Phone {phoneButtonCount >= 1 && "(max 1)"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addButton("URL")}
                      disabled={urlButtonCount >= 2}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      URL {urlButtonCount >= 2 && "(max 2)"}
                    </Button>
                  </div>
                </div>

                {buttons.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No buttons added. Click above to add buttons.
                  </p>
                )}

                {buttons.map((button, index) => (
                  <div key={index} className="border rounded p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium capitalize">
                        {button.type.replace("_", " ").toLowerCase()}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeButton(index)}
                        className="text-destructive hover:text-error-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <Input
                      type="text"
                      placeholder="Button text"
                      value={button.text || ""}
                      onChange={e =>
                        updateButton(index, { text: e.target.value })
                      }
                    />

                    {button.type === "URL" && (
                      <Input
                        type="text"
                        placeholder="https://example.com or https://example.com/{{1}}"
                        value={button.url || ""}
                        onChange={e =>
                          updateButton(index, { url: e.target.value })
                        }
                      />
                    )}

                    {button.type === "PHONE_NUMBER" && (
                      <Input
                        type="text"
                        placeholder="+1234567890 (with country code)"
                        value={button.phone_number || ""}
                        onChange={e =>
                          updateButton(index, { phone_number: e.target.value })
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Template"}
              </Button>
            </div>
          </form>

          {/* Preview Section */}
          <div className="w-80 border-l bg-surface-elevated p-4 overflow-y-auto hidden lg:block">
            <WhatsAppPreview
              components={buildPreviewComponents()}
              templateName={templateName || "new_template"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function buildTemplateFormError(error: any): TemplateFormError {
  const defaultTitle =
    typeof error?.message === "string" && error.message.trim().length
      ? error.message.trim()
      : "Failed to create template";

  const details = new Set<string>();
  if (error?.details && Array.isArray(error.details)) {
    error.details.forEach((detail: string) => {
      if (detail) details.add(detail);
    });
  }

  const message = typeof error?.message === "string" ? error.message : "";
  extractMsg91ErrorDetails(message).forEach(detail => details.add(detail));

  if (!details.size && error?.status === 400) {
    details.add(
      "Double-check template fields for Meta/MSG91 validation requirements and try again."
    );
  }

  return {
    title: defaultTitle,
    details: details.size ? Array.from(details) : undefined,
  };
}

function extractMsg91ErrorDetails(rawMessage: string): string[] {
  if (!rawMessage) return [];
  const details = new Set<string>();

  const payload = parseTrailingJson(rawMessage);
  if (payload) {
    normalizeErrorPayload(payload).forEach(detail => details.add(detail));
  }

  const lowerMessage = rawMessage.toLowerCase();
  if (lowerMessage.includes("phone number")) {
    details.add(
      "Call buttons must use a valid E.164 phone number (e.g. +911234567890) with digits only."
    );
  }
  if (lowerMessage.includes("variables can't be at the start or end")) {
    details.add(
      "Add fixed text before and after each {{variable}} in header and body copy."
    );
  }

  return Array.from(details);
}

function parseTrailingJson(raw: string): any | null {
  const match = raw.match(/\{[\s\S]+\}\s*$/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeErrorPayload(payload: any): string[] {
  if (!payload) return [];
  const details: string[] = [];
  const candidates = [
    payload.errors,
    payload.error,
    payload.data?.errors,
    payload.message,
  ];

  candidates.forEach(candidate => {
    if (!candidate) return;
    if (typeof candidate === "string") {
      details.push(candidate);
      return;
    }
    if (Array.isArray(candidate)) {
      candidate.forEach(item => {
        if (item) {
          details.push(typeof item === "string" ? item : JSON.stringify(item));
        }
      });
      return;
    }
    if (typeof candidate === "object") {
      Object.values(candidate).forEach(value => {
        if (!value) return;
        if (typeof value === "string") {
          details.push(value);
        } else if (Array.isArray(value)) {
          value.forEach(entry => {
            if (entry) {
              details.push(
                typeof entry === "string" ? entry : JSON.stringify(entry)
              );
            }
          });
        } else {
          details.push(JSON.stringify(value));
        }
      });
    }
  });

  return details;
}
