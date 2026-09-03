"use client";

import logo from "@/app/assets/images/logos/logo-v1.png";
import {
  type AnalyticsEvent,
  type BrevoCampaign,
  type CampaignDelivery,
  type MessageTemplate,
} from "@/lib/api/types";
import { toast } from "@/lib/toast";
import { generateCampaignPDF } from "@/lib/utils/pdf-generator";
import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui";
import { Alert } from "@repo/ui/components/ui/alert";
import { PageHeader } from "@repo/ui/components/ui/page-header";
import {
  ArrowLeft,
  Download,
  Edit,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Table,
} from "@repo/ui/icons";
import React from "react";
import { Campaign } from "./campaign-table";
import {
  type TemplateComponent,
  WhatsAppPreview,
} from "./whatsapp/whatsapp-preview";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { normalizeBrevoCampaignStats } from "@/lib/brevo";

interface CampaignDetailPageProps {
  campaign: Campaign;
  brevoCampaign?: BrevoCampaign;
  template?: MessageTemplate;
  messageParams?: Record<string, unknown>;
  onBack: () => void;
  onEdit?: () => void;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  deliveries?: CampaignDelivery[];
  events?: AnalyticsEvent[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeReportFileName(value: string): string {
  const withoutControls = Array.from(value.normalize("NFKC"), character =>
    character.codePointAt(0)! < 32 ? "_" : character
  ).join("");
  const safe = withoutControls
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 100);
  return safe || "campaign";
}

function renderReportRows(rows: Array<Array<string | number>>): string {
  return rows
    .map(
      (row, rowIndex) =>
        `<tr>${row
          .map(cell =>
            rowIndex === 0
              ? `<th>${escapeHtml(cell)}</th>`
              : `<td>${escapeHtml(cell)}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
}

function csvCell(value: string | number): string {
  const text = String(value);
  const formulaSafe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${formulaSafe.replaceAll('"', '""')}"`;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subValue }) => {
  const getRateColor = (subValueText: string, labelText: string) => {
    const match = subValueText.match(/([\d.]+)%/);
    if (!match || !match[1]) return "text-muted-foreground";

    const rate = parseFloat(match[1] as string);
    const lowerLabel = (labelText || "").toLowerCase();
    const lowerSubValue = subValueText.toLowerCase();

    if (
      lowerLabel.includes("unsubscribe") ||
      lowerLabel.includes("spam") ||
      lowerLabel.includes("bounce") ||
      lowerSubValue.includes("unsubscribe") ||
      lowerSubValue.includes("spam") ||
      lowerSubValue.includes("bounce")
    ) {
      if (rate >= 2) return "text-destructive";
      if (rate >= 1) return "text-warning";
      return "text-success-foreground";
    }

    if (
      lowerLabel.includes("delivery") ||
      lowerLabel.includes("delivered") ||
      lowerLabel.includes("open") ||
      lowerLabel.includes("click") ||
      lowerSubValue.includes("delivery") ||
      lowerSubValue.includes("open") ||
      lowerSubValue.includes("click")
    ) {
      if (rate >= 50) return "text-success-foreground";
      if (rate >= 25) return "text-info-foreground";
      if (rate >= 10) return "text-info";
      return "text-warning";
    }

    return "text-muted-foreground";
  };

  const rateColor = subValue
    ? getRateColor(subValue, label)
    : "text-muted-foreground";

  return (
    <div className="relative h-full w-full min-w-0 overflow-hidden rounded-lg border bg-surface p-4 shadow-sm">
      <div className="relative z-10">
        <div className="mb-1 text-sm leading-5 text-muted-foreground">
          {label}
        </div>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
        {subValue && (
          <div className={`mt-1 text-xs leading-4 ${rateColor}`}>
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
};

const HorizontalSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="space-y-4">
    <h3 className="text-lg font-semibold">{title}</h3>
    <div className="grid grid-cols-2 items-stretch gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {children}
    </div>
  </div>
);

export function CampaignDetailPage({
  campaign,
  brevoCampaign,
  template,
  messageParams,
  onBack,
  onEdit,
  onRefresh,
  refreshing = false,
  deliveries = [],
  loading = false,
  error = null,
  onRetry,
}: CampaignDetailPageProps) {
  const isWhatsApp = campaign.channel === "WhatsApp";

  const stats = brevoCampaign
    ? normalizeBrevoCampaignStats(brevoCampaign)
    : null;

  const emailStats = {
    delivered: stats?.delivered ?? 0,
    deliveryRate: stats?.deliveryRate ?? 0,
    opens: stats?.uniqueOpens ?? 0,
    openRate: stats?.openRate ?? 0,
    clicks: stats?.uniqueClicks ?? 0,
    clickThroughRate: stats?.clickRate ?? 0,
    unsubscribes: stats?.unsubscribes ?? 0,
    unsubscribeRate: stats?.unsubscribeRate ?? 0,
    sentTo: stats?.sent ?? 0,
    deliveredCount: stats?.delivered ?? 0,
    inProcessing: stats?.deferred ?? 0,
    softBounces: stats?.softBounces ?? 0,
    hardBounces: stats?.hardBounces ?? 0,
    totalOpens: stats?.totalOpens ?? 0,
    appleMPPOpens: stats?.appleMppOpens ?? 0,
    totalClicks: stats?.totalClicks ?? 0,
    clickToOpenRate: stats?.clickToOpenRate ?? 0,
    spamComplaints: stats?.complaints ?? 0,
    spamComplaintRate: stats?.spamRate ?? 0,
  };

  const exportWhatsAppStats = (format: "pdf" | "excel" | "csv") => {
    const kpi = campaign.deliveryStats || {
      total: deliveries.length,
      pending: deliveries.filter(x => x.status === "PENDING").length,
      queued: deliveries.filter(x => x.status === "QUEUED").length,
      sent: deliveries.filter(x => x.status === "SENT").length,
      delivered: deliveries.filter(x => x.status === "DELIVERED").length,
      read: deliveries.filter(x => x.status === "READ").length,
      failed: deliveries.filter(x => x.status === "FAILED").length,
    };

    const stats = [
      ["Metric", "Count", "Percentage"],
      ["Total", kpi.total, "100%"],
      [
        "Pending",
        kpi.pending,
        kpi.total > 0
          ? `${((kpi.pending / kpi.total) * 100).toFixed(1)}%`
          : "0%",
      ],
      [
        "Queued",
        kpi.queued,
        kpi.total > 0
          ? `${((kpi.queued / kpi.total) * 100).toFixed(1)}%`
          : "0%",
      ],
      [
        "Sent",
        kpi.sent,
        kpi.total > 0 ? `${((kpi.sent / kpi.total) * 100).toFixed(1)}%` : "0%",
      ],
      [
        "Delivered",
        kpi.delivered,
        kpi.total > 0
          ? `${((kpi.delivered / kpi.total) * 100).toFixed(1)}%`
          : "0%",
      ],
      [
        "Read",
        kpi.read,
        kpi.total > 0 ? `${((kpi.read / kpi.total) * 100).toFixed(1)}%` : "0%",
      ],
      [
        "Failed",
        kpi.failed,
        kpi.total > 0
          ? `${((kpi.failed / kpi.total) * 100).toFixed(1)}%`
          : "0%",
      ],
    ];
    const fileName = safeReportFileName(campaign.name);
    const reportRows = renderReportRows(stats);

    if (format === "csv") {
      const csvContent = stats
        .map(row => row.map(csvCell).join(","))
        .join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = `${fileName}_report.csv`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } else if (format === "excel") {
      const tableHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="UTF-8"></head>
        <body>
          <h1>${escapeHtml(campaign.name)}</h1>
          <p>Campaign Report - ${new Date().toLocaleDateString()}</p>
          <table border="1">
            ${reportRows}
          </table>
        </body>
        </html>
      `;
      const blob = new Blob([tableHtml], { type: "application/vnd.ms-excel" });
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = `${fileName}_report.xls`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } else if (format === "pdf") {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.opener = null;
        printWindow.document.write(`
          <html>
          <head>
            <title>${escapeHtml(campaign.name)} - Campaign Report</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; }
              h1 { color: #333; }
              table { border-collapse: collapse; width: 100%; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
              th { background-color: #f5f5f5; font-weight: bold; }
              .header { margin-bottom: 20px; }
              .date { color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${escapeHtml(campaign.name)}</h1>
              <p class="date">Report generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
              <p>Channel: WhatsApp | Status: ${escapeHtml(campaign.status)}</p>
            </div>
            <table>
              ${reportRows}
            </table>
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      } else {
        toast.error("Unable to open the print preview", {
          description: "Allow pop-ups for this site and try again.",
        });
        return;
      }
    }
    toast.success(
      format === "pdf"
        ? "Print preview opened"
        : `${format.toUpperCase()} report downloaded`
    );
  };

  type JsonRecord = Record<string, unknown>;
  const asRecord = (value: unknown): JsonRecord | null =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as JsonRecord)
      : null;
  const asRecords = (value: unknown): JsonRecord[] =>
    Array.isArray(value)
      ? value.map(asRecord).filter((item): item is JsonRecord => item !== null)
      : [];
  const asText = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value : undefined;

  const extractComponentsArray = (raw: unknown): JsonRecord[] => {
    const direct = asRecords(raw);
    if (direct.length) return direct;
    const root = asRecord(raw);
    if (!root) return [];
    const components = asRecords(root.components);
    if (components.length) return components;
    const templateRecord = asRecord(root.template);
    const templateComponents = asRecords(templateRecord?.components);
    if (templateComponents.length) return templateComponents;
    const payloadTemplate = asRecord(asRecord(root.payload)?.template);
    return asRecords(payloadTemplate?.components);
  };

  const getButtonList = (component: JsonRecord): JsonRecord[] => {
    for (const key of ["buttons", "buttonList", "button"] as const) {
      const buttons = asRecords(component[key]);
      if (buttons.length) return buttons;
    }
    return [];
  };

  const buildPreviewComponents = (): TemplateComponent[] => {
    if (!template) return [];

    const components = extractComponentsArray(template.components);
    const preview: TemplateComponent[] = [];

    for (const component of components) {
      const type = (
        asText(component.type) ??
        asText(component.component_type) ??
        ""
      ).toUpperCase();

      if (type === "HEADER") {
        const format = (
          asText(component.format) ??
          asText(component.format_type) ??
          ""
        ).toUpperCase();
        let headerText = asText(component.text) ?? "";

        if (format === "TEXT" && headerText && messageParams) {
          Object.keys(messageParams).forEach(key => {
            if (key.startsWith("header_")) {
              const num = key.replace("header_", "");

              const paramValue = messageParams[key];
              if (
                typeof paramValue === "string" &&
                paramValue.startsWith("{{") &&
                paramValue.endsWith("}}")
              ) {
                headerText = headerText.replace(
                  new RegExp(`\\{\\{${num}\\}\\}`, "g"),
                  paramValue
                );
              }
            }
          });
        }

        preview.push({
          type: "HEADER",
          format,
          text: headerText || undefined,
        });
      } else if (type === "BODY") {
        let bodyText = asText(component.text) ?? "";

        if (messageParams) {
          Object.keys(messageParams).forEach(key => {
            if (key.startsWith("body_")) {
              const num = key.replace("body_", "");

              const paramValue = messageParams[key];
              if (
                typeof paramValue === "string" &&
                paramValue.startsWith("{{") &&
                paramValue.endsWith("}}")
              ) {
                bodyText = bodyText.replace(
                  new RegExp(`\\{\\{${num}\\}\\}`, "g"),
                  paramValue
                );
              }
            }
          });
        }

        preview.push({
          type: "BODY",
          text: bodyText,
        });
      } else if (type === "FOOTER") {
        preview.push({
          type: "FOOTER",
          text: asText(component.text),
        });
      } else if (type === "BUTTONS" || type === "BUTTON") {
        const buttons = getButtonList(component);
        preview.push({
          type: "BUTTONS",
          buttons: buttons.map((button, index) => {
            const buttonType = (
              asText(button.sub_type) ??
              asText(button.type) ??
              ""
            ).toUpperCase();
            const buttonKey = `button_${index + 1}`;
            const configuredValue = asText(messageParams?.[buttonKey]);

            return {
              type:
                buttonType === "VISIT_WEBSITE"
                  ? "URL"
                  : buttonType === "CALL_PHONE_NUMBER"
                    ? "PHONE_NUMBER"
                    : buttonType === "COPY_CODE"
                      ? "COPY_CODE"
                      : "QUICK_REPLY",
              text: asText(button.text) ?? `Button ${index + 1}`,
              url: configuredValue ?? asText(button.url),
              phone_number: asText(button.phone_number),
            };
          }),
        });
      }
    }
    return preview;
  };

  if (isWhatsApp) {
    const kpi = campaign.deliveryStats || {
      total: deliveries.length,
      pending: deliveries.filter(x => x.status === "PENDING").length,
      queued: deliveries.filter(x => x.status === "QUEUED").length,
      sent: deliveries.filter(x => x.status === "SENT").length,
      delivered: deliveries.filter(x => x.status === "DELIVERED").length,
      read: deliveries.filter(x => x.status === "READ").length,
      failed: deliveries.filter(x => x.status === "FAILED").length,
    };
    return (
      <PageShell>
        <PageHeader
          title={campaign.name}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{campaign.channel}</Badge>
              <Badge variant="secondary">{campaign.status}</Badge>
              {campaign.templateName && (
                <Badge variant="outline">
                  Template: {campaign.templateName}
                </Badge>
              )}
            </span>
          }
          actions={
            <>
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2">
                    <Download className="h-4 w-4" />
                    Export Report
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportWhatsAppStats("pdf")}>
                    <FileText className="h-4 w-4 mr-2" />
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => exportWhatsAppStats("excel")}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Download Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportWhatsAppStats("csv")}>
                    <Table className="h-4 w-4 mr-2" />
                    Download CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />

        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-7">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="rounded-lg border p-4">
                    <div className="h-3 w-20 bg-muted animate-pulse rounded mb-2" />
                    <div className="h-6 w-24 bg-muted animate-pulse rounded" />
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <Alert
              tone="error"
              title="Unable to load campaign analytics"
              action={
                <Button variant="outline" onClick={onRetry}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          ) : (
            <>
              <div className="grid grid-cols-2 items-stretch gap-4 sm:grid-cols-4 md:grid-cols-7">
                <StatCard label="Total" value={kpi.total} />
                <StatCard label="Pending" value={kpi.pending} />
                <StatCard label="Queued" value={kpi.queued} />
                <StatCard label="Sent" value={kpi.sent} />
                <StatCard label="Delivered" value={kpi.delivered} />
                <StatCard label="Read" value={kpi.read} />
                <StatCard label="Failed" value={kpi.failed} />
              </div>

              {template && (
                <div className="mt-4">
                  <h2 className="text-xl font-semibold mb-4 max-w-sm">
                    Message Preview
                  </h2>
                  <Card className="p-4 bg-surface-elevated">
                    <WhatsAppPreview
                      components={buildPreviewComponents()}
                      templateName={template.name}
                    />
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </PageShell>
    );
  }

  const handleDownloadPDF = async () => {
    if (!brevoCampaign) return;

    try {
      let logoDataUrl: string | undefined;
      try {
        const logoPath = typeof logo === "string" ? logo : logo.src;

        const response = await fetch(logoPath);
        if (!response.ok) throw new Error("Failed to fetch logo");

        const blob = await response.blob();
        logoDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        logoDataUrl = undefined;
      }

      await generateCampaignPDF(
        brevoCampaign,
        campaign.name,
        campaign.subject,
        campaign.fromEmail,
        campaign.replyToEmail,
        logoDataUrl
      );
      toast.success("Campaign PDF downloaded");
    } catch {
      toast.error("Failed to generate PDF", {
        description: "Please try again.",
      });
    }
  };

  return (
    <PageShell>
      <PageHeader
        title={campaign.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{campaign.status}</Badge>
            <Badge variant="secondary">{campaign.channel}</Badge>
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            {onEdit && (
              <Button variant="outline" onClick={onEdit}>
                <Edit className="size-4" />
                Edit
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Report
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  Download PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="space-y-4">
        <div className="relative bg-surface rounded-lg border p-4 shadow-lg overflow-hidden">
          <div className="relative z-10">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Date & Time</div>
                <div className="font-medium">{campaign.startDate}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Subject</div>
                <div className="font-medium">{campaign.subject || "-"}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">From</div>
                <div className="font-medium">{campaign.fromEmail || "-"}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Reply To</div>
                <div className="font-medium">
                  {campaign.replyToEmail || "-"}
                </div>
              </div>
              {campaign.previewText && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">
                    Preview Text
                  </div>
                  <div className="font-medium">{campaign.previewText}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {onRefresh && (
          <div className="flex justify-start mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Refreshing..." : "Refresh Statistics"}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Campaign Performance</h2>
        <div className="grid grid-cols-2 items-stretch gap-4 lg:grid-cols-4">
          <StatCard
            label="Delivered"
            value={emailStats.delivered}
            subValue={`${emailStats.deliveryRate}% delivery rate`}
          />
          <StatCard
            label="Opens"
            value={emailStats.opens}
            subValue={`${emailStats.openRate}% open rate`}
          />
          <StatCard
            label="Clicks"
            value={emailStats.clicks}
            subValue={`${emailStats.clickThroughRate}% click-through rate`}
          />
          <StatCard
            label="Unsubscribes"
            value={emailStats.unsubscribes}
            subValue={`${emailStats.unsubscribeRate}% unsubscribe rate`}
          />
        </div>
      </div>

      <HorizontalSection title="Deliverability Details">
        <StatCard label="Sent to" value={emailStats.sentTo} />
        <StatCard
          label="Delivered"
          value={emailStats.deliveredCount}
          subValue={`${emailStats.deliveryRate}% delivery rate`}
        />
        <StatCard label="In Processing" value={emailStats.inProcessing} />
        <StatCard label="Soft Bounces" value={emailStats.softBounces} />
        <StatCard label="Hard Bounces" value={emailStats.hardBounces} />
      </HorizontalSection>

      <HorizontalSection title="Opens Details">
        <StatCard
          label="Opens"
          value={emailStats.opens}
          subValue={`${emailStats.openRate}% open rate`}
        />
        <StatCard label="Total Opens" value={emailStats.totalOpens} />
        <StatCard label="Apple MPP Opens" value={emailStats.appleMPPOpens} />
        <div></div>
        <div></div>
      </HorizontalSection>

      <HorizontalSection title="Clicks Details">
        <StatCard
          label="Click-through Rate"
          value={`${emailStats.clickThroughRate}%`}
        />
        <StatCard label="Total Clicks" value={emailStats.totalClicks} />
        <StatCard label="Clicks" value={emailStats.clicks} />
        <StatCard
          label="Click to Open Rate"
          value={`${emailStats.clickToOpenRate}%`}
        />
        <div></div>
      </HorizontalSection>

      <HorizontalSection title="Unsubscribers Details">
        <StatCard label="Unsubscribers" value={emailStats.unsubscribes} />
        <StatCard
          label="Unsubscribe Rate"
          value={`${emailStats.unsubscribeRate}%`}
        />
        <StatCard label="Spam Complaints" value={emailStats.spamComplaints} />
        <StatCard
          label="Spam Complaint Rate"
          value={`${emailStats.spamComplaintRate}%`}
        />
        <div></div>
      </HorizontalSection>
    </PageShell>
  );
}
