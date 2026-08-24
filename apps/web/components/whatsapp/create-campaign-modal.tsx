"use client";

import { useSegments } from "@/hooks/useSegments";
import { segmentService, whatsappService } from "@/lib/api/services";
import type { MessageTemplate } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import { Badge, Button, Card, Input, Label } from "@repo/ui";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Database,
  FileSpreadsheet,
  Search,
  UploadCloud,
  X,
} from "@repo/ui/icons";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { WhatsAppPreview } from "./whatsapp-preview";
import { CategorySwitcher } from "@repo/ui/components/ui/category-switcher";

interface CreateCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editCampaignId?: number; // If provided, the modal will be in edit mode
}

const TOTAL_STEPS = 7;

type CampaignAction = "draft" | "send" | "schedule";

const ALLOW_AUTH_TEMPLATES =
  process.env.NEXT_PUBLIC_ALLOW_AUTH_TEMPLATES === "true";
const WHATSAPP_TEXT_ONLY_MVP =
  process.env.NEXT_PUBLIC_WHATSAPP_TEXT_ONLY_MVP === "true";

// Available database fields for dynamic values
const AVAILABLE_FIELDS = [
  { value: "{{name}}", label: "Name", description: "Contact name" },
  {
    value: "{{firstName}}",
    label: "First Name",
    description: "Lead first name",
  },
  { value: "{{lastName}}", label: "Last Name", description: "Lead last name" },
  { value: "{{email}}", label: "Email", description: "Email address" },
  { value: "{{phone}}", label: "Phone", description: "Phone number" },
  {
    value: "{{countryCode}}",
    label: "Country Code",
    description: "Country code",
  },
  { value: "{{city}}", label: "City", description: "City" },
  { value: "{{state}}", label: "State", description: "State" },
  { value: "{{pincode}}", label: "Pincode", description: "Pincode" },
  { value: "{{position}}", label: "Position", description: "Contact position" },
  {
    value: "{{companyName}}",
    label: "Company Name",
    description: "Lead company name",
  },
];

// Field input component with database field dropdown
interface FieldInputWithDropdownProps {
  fieldKey: string;
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  csvColumns?: string[];
}

function FieldInputWithDropdown({
  fieldKey,
  label,
  type,
  placeholder,
  value,
  onChange,
  csvColumns,
}: FieldInputWithDropdownProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const insertField = (fieldValue: string) => {
    const input = inputRef.current;
    if (input) {
      const cursorPos = input.selectionStart || 0;
      const textBefore = value.substring(0, cursorPos);
      const textAfter = value.substring(cursorPos);
      const newValue = textBefore + fieldValue + textAfter;
      onChange(newValue);

      // Focus back on input and set cursor position
      setTimeout(() => {
        input.focus();
        const newCursorPos = cursorPos + fieldValue.length;
        input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      onChange(value + fieldValue);
    }
  };

  const hasCsvColumns = csvColumns && csvColumns.length > 0;

  return (
    <div className="grid gap-2">
      <Label htmlFor={fieldKey}>{label}</Label>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          id={fieldKey}
          type={type === "url" ? "url" : "text"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="px-3"
              type="button"
              title={
                hasCsvColumns
                  ? "Insert CSV column or database field"
                  : "Insert database field"
              }
            >
              <Database className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[17.5rem] max-h-[18.75rem] overflow-y-auto"
            align="end"
          >
            {hasCsvColumns && (
              <>
                <DropdownMenuLabel>CSV Columns</DropdownMenuLabel>
                {csvColumns.map(col => (
                  <DropdownMenuItem
                    key={col}
                    onClick={() => insertField(`{{${col}}}`)}
                    className="flex flex-col items-start py-2"
                  >
                    <span className="font-medium">{col}</span>
                    <span className="text-xs text-muted-foreground font-mono bg-muted px-1 rounded mt-1">
                      {`{{${col}}}`}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel>Database Fields</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {AVAILABLE_FIELDS.map(field => (
              <DropdownMenuItem
                key={field.value}
                onClick={() => insertField(field.value)}
                className="flex flex-col items-start py-2"
              >
                <span className="font-medium">{field.label}</span>
                <span className="text-xs text-muted-foreground">
                  {field.description}
                </span>
                <span className="text-xs text-muted-foreground font-mono bg-muted px-1 rounded mt-1">
                  {field.value}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface MediaUploadFieldProps {
  fieldKey: string;
  label: string;
  mediaType: string;
  uploading: boolean;
  disabled?: boolean;
  onUpload: (file: File) => void;
  onUrlChange: (url: string) => void;
  urlValue: string;
}

function MediaUploadField({
  fieldKey,
  label,
  mediaType,
  uploading,
  disabled,
  onUpload,
  onUrlChange,
  urlValue,
}: MediaUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "url">("upload");

  const acceptMap: Record<string, string> = {
    IMAGE: "image/jpeg,image/png,image/webp",
    VIDEO: "video/mp4,video/3gpp",
    DOCUMENT: "application/pdf,.doc,.docx",
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={fieldKey}>{label}</Label>

      <CategorySwitcher
        className="mb-2"
        label={`${label} source`}
        value={mode}
        onValueChange={setMode}
        items={[
          { value: "upload", label: "Upload to S3" },
          { value: "url", label: "Use URL" },
        ]}
      />

      {mode === "url" ? (
        <div className="space-y-2">
          <Input
            type="url"
            value={urlValue}
            onChange={e => onUrlChange(e.target.value)}
            placeholder={`https://example.com/${mediaType.toLowerCase()}.${mediaType === "IMAGE" ? "jpg" : mediaType === "VIDEO" ? "mp4" : "pdf"}`}
            disabled={disabled}
          />
          {urlValue &&
            (urlValue.startsWith("http://") ||
              urlValue.startsWith("https://")) && (
              <p className="text-xs text-success-foreground flex items-center gap-1">
                <span>✓</span> Valid URL provided
              </p>
            )}
          <p className="text-xs text-muted-foreground">
            Enter a publicly accessible URL or upload a file below (max 10MB)
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              <UploadCloud className="h-4 w-4" />
              {uploading
                ? "Uploading to S3..."
                : urlValue
                  ? "Replace File"
                  : "Upload File"}
            </Button>
            {urlValue && (
              <span
                className="text-sm text-success-foreground truncate max-w-[13.75rem]"
                title={urlValue}
              >
                ✓ Uploaded to S3
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Upload file to S3 (max 10MB). Files are stored in whatsapp-campaign
            folder.
          </p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={acceptMap[mediaType] || "*"}
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) {
                onUpload(file);
              }
              event.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}

export function CreateCampaignModal({
  open,
  onOpenChange,
  onSuccess,
  editCampaignId,
}: CreateCampaignModalProps) {
  const isEditMode = Boolean(editCampaignId);
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState<number | undefined>(undefined);
  const [templateName, setTemplateName] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [toAudience, setToAudience] = useState("all");
  const [segmentId, setSegmentId] = useState<number | undefined>(undefined);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [mediaParams, setMediaParams] = useState<
    Record<string, { handle: string; mediaType: string; fileName?: string }>
  >({});
  const [mediaUploadStatus, setMediaUploadStatus] = useState<
    Record<string, boolean>
  >({});
  const mediaFieldKeysRef = useRef<string[]>([]);
  const mediaFieldTypesRef = useRef<Record<string, string>>({});
  const [campaignAction, setCampaignAction] = useState<CampaignAction>("send");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  // CSV upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvContacts, setCsvContacts] = useState<Record<string, string>[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [phoneColumnName, setPhoneColumnName] = useState<string>("");
  const [csvLoading, setCsvLoading] = useState(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [segmentPreview, setSegmentPreview] = useState<{
    total: number;
    sample: number;
  }>({ total: 0, sample: 0 });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const templateDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: segments = [], isLoading: segmentsLoading } = useSegments();

  const filteredTemplates = useMemo(() => {
    const base = templates.filter((t: MessageTemplate) => {
      if (ALLOW_AUTH_TEMPLATES) return true;
      return (t.category || "").toUpperCase() !== "AUTHENTICATION";
    });
    if (!templateSearchQuery.trim()) return base;
    const query = templateSearchQuery.toLowerCase();
    return base.filter(
      (t: MessageTemplate) =>
        t.name.toLowerCase().includes(query) ||
        (t.category && t.category.toLowerCase().includes(query))
    );
  }, [templates, templateSearchQuery]);

  const selectedTemplate = useMemo<MessageTemplate | undefined>(
    () => templates.find((tpl: MessageTemplate) => tpl.name === templateName),
    [templates, templateName]
  );

  const templateInsights = useMemo(
    () => buildTemplateInsights(selectedTemplate),
    [selectedTemplate]
  );

  // Get available languages from selected template
  const availableLanguages = useMemo(() => {
    if (!selectedTemplate) return [];

    if (
      selectedTemplate.languages &&
      Array.isArray(selectedTemplate.languages) &&
      selectedTemplate.languages.length > 0
    ) {
      return selectedTemplate.languages;
    }

    // Fallback to single language
    if (selectedTemplate.language) {
      return [
        {
          code: selectedTemplate.language,
          status: selectedTemplate.status || "APPROVED",
        },
      ];
    }

    return [];
  }, [selectedTemplate]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setName("");
      setAccountId(undefined);
      setTemplateName("");
      setSelectedLanguage("");
      setToAudience("all");
      setSegmentId(undefined);
      setParamValues({});
      setMediaParams({});
      setMediaUploadStatus({});
      setCampaignAction("send");
      setScheduleDate("");
      setScheduleTime("");
      setCsvFile(null);
      setCsvContacts([]);
      setCsvColumns([]);
      setPhoneColumnName("");
      setCsvLoading(false);
      setError(null);
      setSegmentPreview({ total: 0, sample: 0 });
      setTemplateSearchQuery("");
      setIsTemplateDropdownOpen(false);
    }
  }, [open]);

  // Load accounts on mount
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const acc = await whatsappService.listAccounts();
        const activeAccounts = acc.filter(a => a.status === "ACTIVE");
        setAccounts(activeAccounts);
      } catch {
        setError("Failed to load accounts");
      }
    };
    load();
  }, [open]);

  // Load campaign config when editing
  useEffect(() => {
    if (!open || !editCampaignId) return;
    const loadConfig = async () => {
      try {
        const config = await whatsappService.getCampaignConfig(editCampaignId);

        // Set form values from config
        setName(config.name);
        setAccountId(config.accountId);
        setTemplateName(config.templateName);
        setSelectedLanguage(config.language || "");
        setToAudience(config.audience);
        setSegmentId(config.segmentId);

        // Parse message params into paramValues
        if (config.messageParams && typeof config.messageParams === "object") {
          const parsedParams: Record<string, string> = {};
          Object.entries(config.messageParams).forEach(([key, value]) => {
            if (typeof value === "string") {
              parsedParams[key] = value;
            } else if (
              value &&
              typeof value === "object" &&
              "value" in (value as Record<string, unknown>)
            ) {
              parsedParams[key] = String(
                (value as Record<string, unknown>).value
              );
            }
          });
          setParamValues(parsedParams);
        }

        // Default to draft action for editing
        setCampaignAction("draft");
      } catch {
        setError("Failed to load campaign configuration");
      }
    };
    loadConfig();
  }, [open, editCampaignId]);

  // Load templates when account is selected
  useEffect(() => {
    if (!accountId || !open) return;
    const loadTemplates = async () => {
      try {
        const t = await whatsappService.listTemplates(accountId);
        let filtered = (t || []).filter((tpl: MessageTemplate) => {
          if (ALLOW_AUTH_TEMPLATES) {
            return true;
          }
          return (tpl.category || "").toUpperCase() !== "AUTHENTICATION";
        });
        // MVP flag: only show text-only templates when flag is true
        if (WHATSAPP_TEXT_ONLY_MVP) {
          filtered = filtered.filter((tpl: MessageTemplate) =>
            isTextOnlyTemplate(tpl)
          );
        }
        setTemplates(filtered);
        setTemplateName(prev => {
          if (!prev) return prev;
          const exists = filtered.some(
            (tpl: MessageTemplate) => tpl.name === prev
          );
          if (!exists) {
            setSelectedLanguage("");
            return "";
          }
          return prev;
        });
      } catch {
        setError("Failed to load templates");
      }
    };
    loadTemplates();
  }, [accountId, open]);

  // Reset template selection when account changes
  useEffect(() => {
    if (accountId) {
      setTemplateName("");
      setSelectedLanguage("");
    }
  }, [accountId]);

  // Reset language when template changes
  useEffect(() => {
    if (templateName) {
      setSelectedLanguage("");
    }
  }, [templateName]);

  // Reset segment when audience changes
  useEffect(() => {
    if (toAudience !== "segment") {
      setSegmentId(undefined);
      setSegmentPreview({ total: 0, sample: 0 });
    }
  }, [toAudience]);

  // Close template dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        templateDropdownRef.current &&
        !templateDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTemplateDropdownOpen(false);
        setTemplateSearchQuery("");
      }
    };

    if (isTemplateDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTemplateDropdownOpen]);

  const handlePreviewSegment = async () => {
    if (!segmentId) return;
    try {
      setPreviewLoading(true);
      const result = await segmentService.resolve(segmentId, 20);
      setSegmentPreview({
        total: result.total,
        sample: result.contacts.length,
      });
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to preview segment");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCsvUpload = async (file: File) => {
    // Validate file size (max 8MB)
    const maxSizeBytes = 8 * 1024 * 1024; // 8MB
    if (file.size > maxSizeBytes) {
      toast.error("File size exceeds maximum allowed size of 8MB");
      return;
    }

    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    // Validate file type
    if (!["csv", "xlsx", "xls"].includes(fileExtension || "")) {
      toast.error(
        "Unsupported file format. Please upload CSV or Excel (.xlsx, .xls) file"
      );
      return;
    }

    // Set loading state
    setCsvLoading(true);
    setError(null);

    // Show loading toast for large files
    const loadingToast =
      file.size > 1024 * 1024 ? toast.loading("Parsing file...") : null;

    try {
      // Use xlsx library to parse both CSV and Excel files
      const reader = new FileReader();

      reader.onload = async e => {
        try {
          // Spreadsheet parsing is only needed after a user selects a file.
          // Loading it here keeps the large parser out of the initial route bundle.
          const XLSX = await import("xlsx");
          const data = new Uint8Array(e.target?.result as ArrayBuffer);

          // xlsx library handles both CSV and Excel formats automatically
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            if (loadingToast) toast.dismiss(loadingToast);
            toast.error("File is empty or invalid");
            setCsvLoading(false);
            return;
          }
          const firstSheet = workbook.Sheets[firstSheetName];

          if (!firstSheet) {
            if (loadingToast) toast.dismiss(loadingToast);
            toast.error("File is empty or invalid");
            setCsvLoading(false);
            return;
          }

          // Convert to JSON with header row
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
            header: 1,
          }) as any[][];

          if (jsonData.length < 2) {
            if (loadingToast) toast.dismiss(loadingToast);
            toast.error(
              "File must have at least a header row and one data row"
            );
            setCsvLoading(false);
            return;
          }

          // First row is headers
          const firstRow = jsonData[0];
          if (!firstRow) {
            if (loadingToast) toast.dismiss(loadingToast);
            toast.error("No header row found in file");
            setCsvLoading(false);
            return;
          }
          const headers = firstRow.map(h => String(h).trim()).filter(h => h);

          if (headers.length === 0) {
            if (loadingToast) toast.dismiss(loadingToast);
            toast.error("No column headers found in file");
            setCsvLoading(false);
            return;
          }

          const contacts = jsonData
            .slice(1)
            .map(row => {
              const contact: Record<string, string> = {};
              headers.forEach((header, index) => {
                contact[header] =
                  row[index] != null ? String(row[index]).trim() : "";
              });
              return contact;
            })
            .filter(contact => Object.values(contact).some(v => v));

          if (contacts.length === 0) {
            if (loadingToast) toast.dismiss(loadingToast);
            toast.error("No valid data found in file");
            setCsvLoading(false);
            return;
          }

          setCsvFile(file);
          setCsvContacts(contacts);
          setCsvColumns(headers);

          // Try to auto-detect phone column
          const phoneCol = headers.find(
            col =>
              col.toLowerCase().includes("phone") ||
              col.toLowerCase().includes("mobile") ||
              col.toLowerCase().includes("number")
          );
          if (phoneCol) {
            setPhoneColumnName(phoneCol);
          }

          const fileType = fileExtension === "csv" ? "CSV" : "Excel";
          if (loadingToast) toast.dismiss(loadingToast);
          toast.success(
            `Successfully loaded ${contacts.length} contact${contacts.length > 1 ? "s" : ""} from ${fileType} file`
          );
          setError(null);
          setCsvLoading(false);
        } catch (error: any) {
          console.error("File parsing error:", error);
          if (loadingToast) toast.dismiss(loadingToast);
          toast.error(
            `Failed to parse file: ${error.message || "Invalid file format"}`
          );
          setCsvLoading(false);
          setError(
            `File parsing failed: ${error.message || "Invalid file format"}`
          );
        }
      };

      reader.onerror = error => {
        console.error("FileReader error:", error);
        if (loadingToast) toast.dismiss(loadingToast);
        toast.error("Failed to read file. Please try again.");
        setCsvLoading(false);
        setError("Failed to read file. Please check the file and try again.");
      };

      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      console.error("File upload error:", error);
      if (loadingToast) toast.dismiss(loadingToast);
      toast.error(
        `Failed to process file: ${error.message || "Unknown error"}`
      );
      setCsvLoading(false);
      setError(`File processing failed: ${error.message || "Unknown error"}`);
    }
  };

  const handleRemoveCsv = () => {
    setCsvFile(null);
    setCsvContacts([]);
    setCsvColumns([]);
    setPhoneColumnName("");
    setCsvLoading(false);
    setError(null);
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!name.trim();
      case 2:
        return accountId !== undefined;
      case 3:
        return !!templateName;
      case 4:
        return !!selectedLanguage;
      case 5:
        if (toAudience === "segment") {
          return segmentId !== undefined;
        }
        if (toAudience === "upload") {
          if (!csvFile || csvContacts.length === 0) {
            setError("Please upload a CSV/Excel file with contacts");
            return false;
          }
          if (!phoneColumnName) {
            setError("Please select the phone number column");
            return false;
          }
          return true;
        }
        return true;
      case 6:
        // Parameters are now handled with individual fields
        return true;
      case 7:
        if (campaignAction === "schedule") {
          if (!scheduleDate || !scheduleTime) {
            setError("Please select a date and time for scheduling");
            return false;
          }
          const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
          if (scheduledDateTime <= new Date()) {
            setError("Scheduled time must be in the future");
            return false;
          }
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setError(null);
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleMediaUpload = async (fieldKey: string, file: File) => {
    // Validate file size (max 10MB)
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeBytes) {
      toast.error("File size exceeds maximum allowed size of 10MB");
      return;
    }

    setMediaUploadStatus(prev => ({ ...prev, [fieldKey]: true }));
    try {
      const base64 = await fileToBase64(file);
      const base64Payload = base64.split(",")[1] || base64;

      // Upload to S3 via backend
      const response = await whatsappService.uploadCampaignMedia({
        mediaBase64: base64Payload,
        mimeType: file.type,
        filename: file.name,
      });

      // Store the S3 URL directly in paramValues for use in campaign
      setParamValues(prev => ({
        ...prev,
        [fieldKey]: response.url,
      }));

      toast.success("Media uploaded successfully to S3");
    } catch (error: any) {
      console.error("Failed to upload media", error);
      toast.error(error?.message || "Failed to upload media");
    } finally {
      setMediaUploadStatus(prev => ({ ...prev, [fieldKey]: false }));
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(7)) return;

    setIsSubmitting(true);
    setError(null);
    try {
      // Build params from individual field values
      const params: Record<string, any> = {};

      // First, handle all media fields (both URL and uploaded)
      mediaFieldKeysRef.current.forEach(key => {
        const urlValue = paramValues[key];
        const uploadedMedia = mediaParams[key];

        // Get media type from the mediaFieldTypesRef (set during field rendering)
        const mediaTypeFromTemplate =
          mediaFieldTypesRef.current[key] || "IMAGE";

        // Check if user entered a URL
        if (
          urlValue &&
          urlValue.trim() &&
          (urlValue.startsWith("http://") || urlValue.startsWith("https://"))
        ) {
          // Use media type from template hints
          const mediaType = mediaTypeFromTemplate;
          const lowerType = mediaType.toLowerCase();

          const payload: Record<string, any> = { type: lowerType };
          if (lowerType === "image") {
            payload.image = { link: urlValue };
          } else if (lowerType === "video") {
            payload.video = { link: urlValue };
          } else if (lowerType === "document") {
            payload.document = {
              link: urlValue,
              filename: "document.pdf",
            };
          }
          params[key] = payload;
        }
        // Check if user uploaded media (fallback - not recommended for campaigns)
        else if (uploadedMedia?.handle) {
          const lowerType = uploadedMedia.mediaType.toLowerCase();
          const payload: Record<string, any> = { type: lowerType };

          if (lowerType === "image") {
            payload.image = { id: uploadedMedia.handle };
          } else if (lowerType === "video") {
            payload.video = { id: uploadedMedia.handle };
          } else if (lowerType === "document") {
            payload.document = {
              id: uploadedMedia.handle,
              filename: uploadedMedia.fileName || "attachment.pdf",
            };
          }
          params[key] = payload;
        } else {
          throw new Error(
            `Please provide a URL for ${key}. Media must be publicly accessible.`
          );
        }
      });

      // Then handle regular text/button fields
      Object.entries(paramValues).forEach(([key, value]) => {
        // Skip if already handled as media field
        if (mediaFieldKeysRef.current.includes(key)) {
          return;
        }

        if (value.trim()) {
          // Check if it's a button URL field
          if (key.includes("button") && value.startsWith("http")) {
            params[key] = { type: "text", subtype: "url", value: value };
          } else {
            params[key] = { type: "text", value: value };
          }
        }
      });

      const payload = {
        name,
        channel: "whatsapp",
        accountId,
        templateName,
        language: selectedLanguage,
        toAudience,
        params,
        segmentId: toAudience === "segment" ? segmentId : undefined,
        csvContacts: toAudience === "upload" ? csvContacts : undefined,
        phoneColumnName: toAudience === "upload" ? phoneColumnName : undefined,
        scheduledAt:
          campaignAction === "schedule"
            ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
            : undefined,
        // Mark as draft so backend skips generating deliveries; this keeps deliveryStats.total === 0,
        // which the UI interprets as "Draft".
        isDraft: campaignAction === "draft",
      };

      let campaignId: number;

      if (isEditMode && editCampaignId) {
        // Update existing campaign
        await whatsappService.updateCampaign(editCampaignId, payload);
        campaignId = editCampaignId;
      } else {
        // Create new campaign
        const result = (await whatsappService.createCampaign(payload)) as any;
        campaignId = result.campaign?.id;

        if (!campaignId) {
          throw new Error("Campaign created but no ID returned");
        }
      }

      // Handle the action
      if (campaignAction === "send") {
        // Send immediately
        await whatsappService.sendCampaign(campaignId);
      } else if (campaignAction === "schedule") {
        // Schedule for later - the scheduledAt is already set in payload
        // Backend will handle scheduling with the scheduledAt timestamp
        await whatsappService.scheduleCampaign(
          campaignId,
          new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
        );
      }
      // "draft" action: just save, don't send

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(
        err?.message ||
          (isEditMode
            ? "Failed to update campaign"
            : "Failed to create campaign")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Campaign name</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Spring Promo"
                autoFocus
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="account">WhatsApp Account</Label>
              <Select
                value={accountId !== undefined ? String(accountId) : ""}
                onValueChange={v => setAccountId(v ? Number(v) : undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account…" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.displayName} ({a.phoneNumber || a.sourceHandle})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="template">Template</Label>
              <div className="relative" ref={templateDropdownRef}>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={isTemplateDropdownOpen}
                  className="w-full justify-between"
                  onClick={() =>
                    setIsTemplateDropdownOpen(!isTemplateDropdownOpen)
                  }
                >
                  {selectedTemplate
                    ? `${selectedTemplate.name}${selectedTemplate.category ? ` (${selectedTemplate.category})` : ""}`
                    : "Select template..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
                {isTemplateDropdownOpen && (
                  <div className="relative z-50 w-full mt-1 bg-popover border rounded-md shadow-md">
                    <div className="p-2 border-b">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search templates..."
                          value={templateSearchQuery}
                          onChange={e => setTemplateSearchQuery(e.target.value)}
                          className="pl-8"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="max-h-[12.5rem] overflow-y-auto p-1">
                      {filteredTemplates.length > 0 ? (
                        filteredTemplates.map(t => (
                          <button
                            type="button"
                            key={t.name}
                            className={`relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/30 ${
                              templateName === t.name
                                ? "bg-accent text-accent-foreground"
                                : ""
                            }`}
                            onClick={() => {
                              setTemplateName(t.name);
                              setParamValues({});
                              setMediaParams({});
                              setMediaUploadStatus({});
                              setIsTemplateDropdownOpen(false);
                              setTemplateSearchQuery("");
                            }}
                            aria-pressed={templateName === t.name}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                templateName === t.name
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                            {t.name} {t.category ? `(${t.category})` : ""}
                          </button>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No templates found.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {selectedTemplate && (
              <Card className="p-4 bg-muted/40 border-dashed space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Selected template
                    </p>
                    <h3 className="font-semibold">{selectedTemplate.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Template ID: {selectedTemplate.providerTemplateId || "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.status && (
                      <Badge variant="outline">{selectedTemplate.status}</Badge>
                    )}
                    {selectedTemplate.category && (
                      <Badge variant="secondary">
                        {selectedTemplate.category}
                      </Badge>
                    )}
                  </div>
                </div>
                {WHATSAPP_TEXT_ONLY_MVP && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Only text-only WhatsApp templates are available in this MVP.
                    Media templates will be supported later.
                  </p>
                )}
              </Card>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="language">Language</Label>
              <Select
                value={selectedLanguage}
                onValueChange={v => setSelectedLanguage(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language…" />
                </SelectTrigger>
                <SelectContent>
                  {availableLanguages.map((lang: any, index: number) => (
                    <SelectItem key={lang.code || index} value={lang.code}>
                      {lang.code.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {availableLanguages.length === 0 && selectedTemplate && (
              <p className="text-sm text-muted-foreground">
                No languages available for this template
              </p>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="audience">Audience</Label>
              <Select value={toAudience} onValueChange={v => setToAudience(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All contacts</SelectItem>
                  <SelectItem value="leads">All leads</SelectItem>
                  <SelectItem value="segment">Saved segment…</SelectItem>
                  <SelectItem value="upload">Upload CSV/Excel…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {toAudience === "segment" && (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="segment">Choose segment</Label>
                  <Link
                    href="/campaigns/segments"
                    className="text-sm text-primary hover:text-info"
                  >
                    Manage segments
                  </Link>
                </div>
                <Select
                  value={segmentId ? String(segmentId) : ""}
                  onValueChange={v => setSegmentId(v ? Number(v) : undefined)}
                  disabled={segmentsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select segment…" />
                  </SelectTrigger>
                  <SelectContent>
                    {segments.map(segment => (
                      <SelectItem key={segment.id} value={String(segment.id)}>
                        {segment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!segmentId || previewLoading}
                    onClick={handlePreviewSegment}
                  >
                    {previewLoading ? "Previewing…" : "Preview audience"}
                  </Button>
                  {segmentPreview.total > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {segmentPreview.total} contacts match (showing first{" "}
                      {segmentPreview.sample})
                    </span>
                  )}
                </div>
              </div>
            )}
            {toAudience === "upload" && (
              <div className="grid gap-4">
                <Card className="p-4 bg-muted/40 border-dashed">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">
                          Upload Contacts File
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Upload a CSV or Excel file with your contacts. The
                          file should contain phone numbers with country code
                          (without + sign).
                        </p>
                      </div>
                    </div>

                    {!csvFile ? (
                      <div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full"
                          disabled={csvLoading}
                        >
                          <UploadCloud className="h-4 w-4" />
                          {csvLoading
                            ? "Parsing file..."
                            : "Choose CSV/Excel File"}
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept=".csv,.xlsx,.xls"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleCsvUpload(file);
                            }
                            e.target.value = "";
                          }}
                          disabled={csvLoading}
                        />
                        {csvLoading && (
                          <p className="text-xs text-info-foreground mt-2 flex items-center gap-1">
                            Processing… file, please wait...
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2 bg-background rounded border">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 text-success-foreground" />
                            <div>
                              <p className="text-sm font-medium">
                                {csvFile.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {csvContacts.length} contacts loaded
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveCsv}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="phoneColumn">
                            Phone Number Column
                          </Label>
                          <Select
                            value={phoneColumnName}
                            onValueChange={v => setPhoneColumnName(v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select phone column…" />
                            </SelectTrigger>
                            <SelectContent>
                              {csvColumns.map(col => (
                                <SelectItem key={col} value={col}>
                                  {col}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Select the column that contains phone numbers
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-3 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Important:
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                        <li>File size must be less than 8MB</li>
                        <li>
                          Phone numbers must include country code without + sign
                          (e.g., 919876543210)
                        </li>
                        <li>Contacts will NOT be saved in the system (MVP)</li>
                      </ul>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        );

      case 6: {
        // Extract parameter fields from template insights
        const paramFields = templateInsights.hints
          .map(hint => {
            // Parse hints like "Body variables: {{1}}, {{2}}" or "Header uses image media (configure header_1)"
            const bodyMatch = hint.match(/Body variables: (.+)/);
            const headerMatch = hint.match(/Header variables: (.+)/);
            const headerMediaMatch = hint.match(
              /Header uses (\w+) media \(configure (\w+)\)/
            );
            const buttonMatch = hint.match(/Button (\d+): (\w+)/);

            if (bodyMatch && bodyMatch[1]) {
              const vars = bodyMatch[1].match(/\{\{(\d+)\}\}/g) || [];
              return vars.map(v => {
                const num = v.match(/\d+/)?.[0] || "1";
                return {
                  key: `body_${num}`,
                  label: `Body Variable ${num}`,
                  type: "text",
                  placeholder: `Enter value for {{${num}}}`,
                };
              });
            }
            if (headerMatch && headerMatch[1]) {
              const vars = headerMatch[1].match(/\{\{(\d+)\}\}/g) || [];
              return vars.map(v => {
                const num = v.match(/\d+/)?.[0] || "1";
                return {
                  key: `header_${num}`,
                  label: `Header Variable ${num}`,
                  type: "text",
                  placeholder: `Enter value for {{${num}}}`,
                };
              });
            }
            if (headerMediaMatch) {
              const [, mediaType = "image", key = "header_1"] =
                headerMediaMatch;
              return [
                {
                  key,
                  label: `Header ${mediaType.toUpperCase()} Media`,
                  type: "media",
                  mediaType: mediaType.toUpperCase(),
                },
              ];
            }
            if (buttonMatch) {
              const [, btnNum, btnType] = buttonMatch;
              if (btnType === "URL") {
                return [
                  {
                    key: `button_${btnNum}`,
                    label: `Button ${btnNum} URL`,
                    type: "url",
                    placeholder: "https://example.com/page",
                  },
                ];
              }
              if (btnType === "Copy") {
                return [
                  {
                    key: `button_${btnNum}`,
                    label: `Button ${btnNum} Coupon Code`,
                    type: "text",
                    placeholder: "DISCOUNT20",
                  },
                ];
              }
            }
            return [];
          })
          .flat();

        // Deduplicate fields
        const uniqueFields = paramFields.filter(
          (field, index, self) =>
            field &&
            field.key &&
            index === self.findIndex(f => f?.key === field.key)
        );

        // Store media fields info for use in handleSubmit
        const mediaFieldsMap = new Map(
          uniqueFields
            .filter(field => field?.type === "media" && field.key)
            .map(field => [
              field!.key as string,
              (field as any).mediaType || "IMAGE",
            ])
        );
        mediaFieldKeysRef.current = Array.from(mediaFieldsMap.keys());
        mediaFieldTypesRef.current = Object.fromEntries(mediaFieldsMap);

        // Helper function to build preview components with replaced values
        const buildPreviewComponents = () => {
          if (!selectedTemplate) return [];

          const components = extractComponentsArray(
            (selectedTemplate as any)?.componentsJson ??
              (selectedTemplate as any)?.components ??
              null
          );

          return components.map((component: any) => {
            const type = String(
              component.type || component.component_type || ""
            ).toUpperCase();

            if (type === "HEADER") {
              const format = String(
                component.format || component.format_type || ""
              ).toUpperCase();
              let headerText = component.text || "";
              const mediaAttachment = mediaParams["header_1"];

              // Replace header variables with actual values
              if (format === "TEXT" && headerText) {
                Object.entries(paramValues).forEach(([key, value]) => {
                  if (key.startsWith("header_")) {
                    const num = key.replace("header_", "");
                    headerText = headerText.replace(
                      new RegExp(`\\{\\{${num}\\}\\}`, "g"),
                      value || `{{${num}}}`
                    );
                  }
                });
              }

              return {
                type: "HEADER" as const,
                format: format,
                text: mediaAttachment
                  ? `[${format.toLowerCase()} media attached${mediaAttachment.fileName ? `: ${mediaAttachment.fileName}` : ""}]`
                  : headerText || undefined,
              };
            } else if (type === "BODY") {
              let bodyText = component.text || "";

              // Replace body variables with actual values
              Object.entries(paramValues).forEach(([key, value]) => {
                if (key.startsWith("body_")) {
                  const num = key.replace("body_", "");
                  bodyText = bodyText.replace(
                    new RegExp(`\\{\\{${num}\\}\\}`, "g"),
                    value || `{{${num}}}`
                  );
                }
              });

              return {
                type: "BODY" as const,
                text: bodyText,
              };
            } else if (type === "FOOTER") {
              return {
                type: "FOOTER" as const,
                text: component.text || undefined,
              };
            } else if (type === "BUTTONS" || type === "BUTTON") {
              const buttons = getButtonList(component);
              return {
                type: "BUTTONS" as const,
                buttons: buttons.map((btn: any, idx: number) => {
                  const btnType = String(
                    btn.sub_type || btn.type || ""
                  ).toUpperCase();
                  return {
                    type:
                      btnType === "VISIT_WEBSITE"
                        ? "URL"
                        : btnType === "CALL_PHONE_NUMBER"
                          ? "PHONE_NUMBER"
                          : btnType === "COPY_CODE"
                            ? "COPY_CODE"
                            : "QUICK_REPLY",
                    text: btn.text || `Button ${idx + 1}`,
                    url: paramValues[`button_${idx + 1}`] || btn.url,
                    phone_number: btn.phone_number,
                  };
                }),
              };
            }

            return component;
          });
        };

        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Template Variables</Label>
                <p className="text-sm text-muted-foreground">
                  Fill in the values for the template placeholders. Use the
                  database icon to insert dynamic fields.
                </p>
              </div>

              {uniqueFields.length > 0 ? (
                <div className="space-y-4">
                  {uniqueFields.map(
                    field =>
                      field &&
                      field.key &&
                      (field.type === "media" ? (
                        <MediaUploadField
                          key={field.key}
                          fieldKey={field.key}
                          label={field.label}
                          mediaType={(field as any).mediaType || "IMAGE"}
                          uploading={Boolean(mediaUploadStatus[field.key])}
                          disabled={!accountId}
                          onUpload={file => handleMediaUpload(field.key!, file)}
                          onUrlChange={url =>
                            setParamValues(prev => ({
                              ...prev,
                              [field.key!]: url,
                            }))
                          }
                          urlValue={paramValues[field.key!] || ""}
                        />
                      ) : (
                        <FieldInputWithDropdown
                          key={field.key}
                          fieldKey={field.key}
                          label={field.label}
                          type={field.type || "text"}
                          placeholder={
                            ("placeholder" in field ? field.placeholder : "") ||
                            ""
                          }
                          value={paramValues[field.key] || ""}
                          onChange={value => {
                            const fieldKey = field.key;
                            setParamValues(prev => ({
                              ...prev,
                              [fieldKey]: value,
                            }));
                          }}
                          csvColumns={
                            toAudience === "upload" ? csvColumns : undefined
                          }
                        />
                      ))
                  )}
                </div>
              ) : templateInsights.hints.length > 0 ? (
                <Card className="p-4 bg-muted/40 border-dashed space-y-4">
                  <div className="space-y-2">
                    <Label>Detected placeholders</Label>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                      {templateInsights.hints.map(hint => (
                        <li key={hint}>{hint}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    {Object.keys(
                      JSON.parse(templateInsights.sampleParamsText || "{}")
                    ).map(key => (
                      <FieldInputWithDropdown
                        key={key}
                        fieldKey={key}
                        label={key
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, c => c.toUpperCase())}
                        type="text"
                        placeholder={`Enter ${key}`}
                        value={paramValues[key] || ""}
                        onChange={value =>
                          setParamValues(prev => ({ ...prev, [key]: value }))
                        }
                        csvColumns={
                          toAudience === "upload" ? csvColumns : undefined
                        }
                      />
                    ))}
                  </div>
                </Card>
              ) : (
                <Card className="p-4 bg-muted/40 border-dashed">
                  <p className="text-sm text-muted-foreground text-center">
                    This template has no variable placeholders. You can proceed
                    to the next step.
                  </p>
                </Card>
              )}
            </div>

            <div className="space-y-2">
              <Label>Message Preview</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Preview how your message will appear to recipients
              </p>
              <div className="border rounded-lg p-4 bg-surface-elevated">
                <WhatsAppPreview
                  components={buildPreviewComponents()}
                  templateName={selectedTemplate?.name}
                />
              </div>
            </div>
          </div>
        );
      }

      case 7:
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>What would you like to do?</Label>
              <div className="grid gap-3">
                <Card
                  className={`cursor-pointer p-4 transition-[background-color,border-color,box-shadow] duration-150 ${
                    campaignAction === "send"
                      ? "border-primary bg-primary/5 ring-2 ring-primary"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setCampaignAction("send")}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center ${
                        campaignAction === "send"
                          ? "border-primary"
                          : "border-muted-foreground"
                      }`}
                    >
                      {campaignAction === "send" && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium">Send Now</h4>
                      <p className="text-sm text-muted-foreground">
                        Create and send the campaign immediately to all
                        recipients
                      </p>
                    </div>
                  </div>
                </Card>

                <Card
                  className={`cursor-pointer p-4 transition-[background-color,border-color,box-shadow] duration-150 ${
                    campaignAction === "schedule"
                      ? "border-primary bg-primary/5 ring-2 ring-primary"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setCampaignAction("schedule")}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center ${
                        campaignAction === "schedule"
                          ? "border-primary"
                          : "border-muted-foreground"
                      }`}
                    >
                      {campaignAction === "schedule" && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Schedule</h4>
                      <p className="text-sm text-muted-foreground">
                        Schedule the campaign to be sent at a specific date and
                        time
                      </p>
                    </div>
                  </div>
                </Card>

                <Card
                  className={`cursor-pointer p-4 transition-[background-color,border-color,box-shadow] duration-150 ${
                    campaignAction === "draft"
                      ? "border-primary bg-primary/5 ring-2 ring-primary"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setCampaignAction("draft")}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center ${
                        campaignAction === "draft"
                          ? "border-primary"
                          : "border-muted-foreground"
                      }`}
                    >
                      {campaignAction === "draft" && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium">Save as Draft</h4>
                      <p className="text-sm text-muted-foreground">
                        Save the campaign without sending. You can send it later
                        from the campaigns list.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {campaignAction === "schedule" && (
              <div className="grid gap-4 p-4 border rounded-lg bg-muted/20">
                <Label>Schedule Date & Time</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label
                      htmlFor="scheduleDate"
                      className="text-sm text-muted-foreground"
                    >
                      Date
                    </Label>
                    <Input
                      id="scheduleDate"
                      type="date"
                      value={scheduleDate}
                      onChange={e => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label
                      htmlFor="scheduleTime"
                      className="text-sm text-muted-foreground"
                    >
                      Time
                    </Label>
                    <Input
                      id="scheduleTime"
                      type="time"
                      value={scheduleTime}
                      onChange={e => setScheduleTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const handleClose = () => {
    if (
      confirm(
        "Are you sure you want to close? Any unsaved changes will be lost."
      )
    ) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={isOpen => {
        // Prevent closing when clicking outside
        if (!isOpen) return;
        onOpenChange(isOpen);
      }}
    >
      <DialogContent
        className="max-w-5xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={e => {
          e.preventDefault();
        }}
        onEscapeKeyDown={e => {
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit WhatsApp Campaign" : "Create WhatsApp Campaign"}
          </DialogTitle>
          <div className="flex items-center gap-2 pt-2">
            <span className="text-sm text-muted-foreground">
              Step {currentStep} of {TOTAL_STEPS}
            </span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          {error && (
            <div className="text-destructive text-sm mb-4 p-2 bg-error-surface rounded">
              {error}
            </div>
          )}
          {renderStep()}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            {currentStep < TOTAL_STEPS ? (
              <Button type="button" onClick={handleNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? campaignAction === "send"
                    ? "Sending…"
                    : campaignAction === "schedule"
                      ? "Scheduling…"
                      : "Saving…"
                  : campaignAction === "send"
                    ? "Send Campaign"
                    : campaignAction === "schedule"
                      ? "Schedule Campaign"
                      : "Save as Draft"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Template insights functions (copied from page.tsx)
type TemplateInsights = {
  sampleParamsText: string;
  rawJson: string;
  hints: string[];
};

function buildTemplateInsights(
  template?: MessageTemplate | any
): TemplateInsights {
  if (!template) {
    return { sampleParamsText: "", rawJson: "", hints: [] };
  }

  const raw =
    (template as any)?.componentsJson ?? (template as any)?.components ?? null;
  const components = extractComponentsArray(raw);
  const sample: Record<string, any> = {};
  const hints: string[] = [];

  components.forEach((component: any) => {
    processComponent(component, sample, hints);
  });

  return {
    sampleParamsText: Object.keys(sample).length
      ? JSON.stringify(sample, null, 2)
      : "",
    rawJson: safeStringify(raw ?? template),
    hints,
  };
}

function safeStringify(value: any) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function extractComponentsArray(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.components)) return raw.components;
  if (Array.isArray(raw.template?.components)) return raw.template.components;
  if (Array.isArray(raw.payload?.template?.components))
    return raw.payload.template.components;
  return [];
}

// Helper to determine if a template is "text-only" for MVP purposes.
// We allow text headers, body and footers, but exclude templates that rely on media headers,
// locations, carousels or other rich formats.
function isTextOnlyTemplate(template: MessageTemplate | any): boolean {
  const components = extractComponentsArray(
    (template as any)?.componentsJson ?? (template as any)?.components ?? null
  );

  if (!components.length) {
    // If we can't introspect components, treat as text-only to avoid hiding templates unexpectedly.
    return true;
  }

  for (const component of components) {
    const type = String(
      component?.type || component?.component_type || ""
    ).toUpperCase();

    if (type === "HEADER") {
      const format = String(
        component?.format || component?.format_type || ""
      ).toUpperCase();
      // Anything other than TEXT in header is considered non-text for MVP (IMAGE / VIDEO / DOCUMENT / LOCATION / etc.)
      if (format && format !== "TEXT") {
        return false;
      }
    }

    // Exclude carousel-style templates for MVP
    if (Array.isArray((component as any)?.cards)) {
      return false;
    }
  }

  return true;
}

function processComponent(
  component: any,
  sample: Record<string, any>,
  hints: string[]
) {
  if (!component || typeof component !== "object") return;
  const type = String(
    component.type || component.component_type || ""
  ).toUpperCase();
  if (!type) return;

  switch (type) {
    case "HEADER":
      handleHeaderComponent(component, sample, hints);
      break;
    case "BODY":
      handleBodyComponent(component, sample, hints);
      break;
    case "BUTTONS":
    case "BUTTON":
      handleButtonsComponent(component, sample, hints);
      break;
    default:
      if (Array.isArray((component as any).cards)) {
        hints.push(
          "Template contains carousel cards. Provide card_X components such as card_0_header_1."
        );
      }
  }
}

function handleHeaderComponent(
  component: any,
  sample: Record<string, any>,
  hints: string[]
) {
  const format = String(
    component.format || component.format_type || ""
  ).toUpperCase();
  const headerText =
    typeof component.text === "string" ? component.text : undefined;
  const exampleText = getExampleText(component, "header_text");

  if (format === "IMAGE" || format === "VIDEO" || format === "DOCUMENT") {
    sample.header_1 = buildMediaExample(format);
    hints.push(
      `Header uses ${format.toLowerCase()} media (configure header_1)`
    );
    return;
  }

  if (format === "LOCATION") {
    sample.header_1_latitude = "19.0760";
    sample.header_1_longitude = "72.8777";
    sample.header_1_name = "Location name";
    sample.header_1_address = "Address";
    hints.push(
      "Header uses location (provide header_1_latitude / longitude / name / address)"
    );
    return;
  }

  const placeholders = Array.from(
    new Set([
      ...extractPlaceholders(headerText),
      ...extractPlaceholders(exampleText),
    ])
  );
  assignTextVariables(sample, "header", placeholders, "Header", hints);
}

function handleBodyComponent(
  component: any,
  sample: Record<string, any>,
  hints: string[]
) {
  const bodyText =
    typeof component.text === "string" ? component.text : undefined;
  const exampleText = getExampleText(component, "body_text");
  const placeholders = Array.from(
    new Set([
      ...extractPlaceholders(bodyText),
      ...extractPlaceholders(exampleText),
    ])
  );
  assignTextVariables(sample, "body", placeholders, "Body", hints);
}

function handleButtonsComponent(
  component: any,
  sample: Record<string, any>,
  hints: string[]
) {
  const buttons = getButtonList(component);
  if (!buttons.length) {
    hints.push("Template includes buttons (no additional parameters detected)");
    return;
  }

  buttons.forEach((button: any, index: number) => {
    const key = `button_${index + 1}`;
    const type = String(button.sub_type || button.type || "").toUpperCase();
    const urlValue = typeof button.url === "string" ? button.url : undefined;
    const phoneValue =
      typeof button.phone_number === "string" ? button.phone_number : undefined;
    const couponValue =
      typeof button.coupon_code === "string" ? button.coupon_code : undefined;

    switch (type) {
      case "URL":
      case "VISIT_WEBSITE": {
        if (hasTemplatePlaceholders(urlValue)) {
          sample[key] = {
            type: "text",
            subtype: "url",
            value: "https://example.com",
          };
          hints.push(
            `Button ${index + 1}: URL – configure ${key}.value with a link`
          );
        }
        break;
      }
      case "PHONE_NUMBER":
      case "CALL_PHONE_NUMBER": {
        if (hasTemplatePlaceholders(phoneValue)) {
          sample[key] = {
            type: "text",
            subtype: "phone_number",
            value: "+1234567890",
          };
          hints.push(
            `Button ${index + 1}: Phone call – configure ${key}.value with a phone number`
          );
        }
        break;
      }
      case "COPY_CODE":
      case "COUPON_CODE": {
        if (hasTemplatePlaceholders(couponValue)) {
          sample[key] = {
            type: "coupon_code",
            coupon_code: "OFFER2025",
            subtype: "COPY_CODE",
          };
          hints.push(
            `Button ${index + 1}: Copy code – configure ${key}.coupon_code`
          );
        }
        break;
      }
      case "CATALOG":
      case "ACTION":
      case "MPM": {
        if (hasTemplatePlaceholders(button.value)) {
          sample[key] = {
            type: "action",
            subtype: type === "MPM" ? "mpm" : "catalog",
            value: "<product_retailer_id>",
          };
          hints.push(
            `Button ${index + 1}: Catalog/Action – configure ${key}.value with product data`
          );
        }
        break;
      }
      default:
        break;
    }
  });
}

function buildMediaExample(format: string) {
  const valueMap: Record<string, string> = {
    IMAGE: "https://example.com/image.jpg",
    VIDEO: "https://example.com/video.mp4",
    DOCUMENT: "https://example.com/document.pdf",
  };

  const base: Record<string, any> = {
    type: format.toLowerCase(),
    value: valueMap[format] || "https://example.com/media",
  };

  if (format === "DOCUMENT") {
    base.filename = "document.pdf";
  }

  return base;
}

function assignTextVariables(
  target: Record<string, any>,
  prefix: string,
  placeholders: number[],
  label: string,
  hints: string[]
) {
  if (!placeholders.length) {
    const key = `${prefix}_1`;
    if (!target[key]) {
      target[key] = { type: "text", value: `Sample ${label} text` };
    }
    return;
  }

  placeholders.forEach((placeholder, index) => {
    const slot = Number.isFinite(placeholder) ? placeholder : index + 1;
    const key = `${prefix}_${slot}`;
    if (!target[key]) {
      target[key] = { type: "text", value: `Value for ${label} ${slot}` };
    }
  });

  hints.push(
    `${label} variables: ${placeholders.map(p => `{{${p}}}`).join(", ")}`
  );
}

function getExampleText(component: any, field: string): string | undefined {
  const example = component?.example;
  if (!example) return undefined;
  const value = example[field];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === "string") return first;
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  }
  return undefined;
}

function extractPlaceholders(text?: string): number[] {
  if (!text) return [];
  const matches = Array.from(text.matchAll(/\{\{\s*(\d+)\s*\}\}/g));
  const numbers = matches
    .map(match => Number(match[1]))
    .filter(num => !Number.isNaN(num));
  return Array.from(new Set(numbers));
}

function hasTemplatePlaceholders(text?: string): boolean {
  return extractPlaceholders(text).length > 0;
}

function getButtonList(component: any): any[] {
  if (Array.isArray(component?.buttons)) return component.buttons;
  if (Array.isArray(component?.buttonList)) return component.buttonList;
  if (Array.isArray(component?.button)) return component.button;
  return [];
}
