/**
 * The one email shell every message from this system is rendered into.
 *
 * Structure and markup are carried over from the OpenDeck template: a bordered
 * 600px card on a tinted page, a masthead pairing the product with a
 * timestamp, then eyebrow, headline, prose, a single action, and a dashed rule
 * above the metadata and the footer. It is table-based with fully inline
 * styles because that is the only thing Outlook renders predictably; the one
 * <style> block carries the mobile overrides, which Outlook ignores harmlessly.
 *
 * The accent is Ralli Wolf red rather than OpenDeck's blue — it is the only
 * colour in the layout, so it has to be the brand's.
 *
 * Every interpolated value is escaped here rather than at the call sites, so a
 * customer name or a quote title cannot break the markup. The single exception
 * is `bodyHtml`, which exists for messages whose body is genuinely structured
 * markup; whoever passes it owns its safety.
 */

export const EMAIL_COLORS = {
  background: "#FFFFFF",
  bodyBackground: "#F5F5F7",
  border: "#E5E5EA",
  text: "#1C1C1E",
  muted: "#6E6E73",
  dim: "#8E8E93",
  /** Ralli Wolf red: accents only. */
  link: "#ED1C24",
} as const;

export const EMAIL_FONT_STACKS = {
  sans: "-apple-system, BlinkMacSystemFont, Inter, Helvetica Neue, Arial, sans-serif",
  mono: "ui-monospace, JetBrains Mono, SF Mono, Menlo, Consolas, monospace",
} as const;

export const EMAIL_MOBILE_BREAKPOINT_PX = 480;

const APP_NAME = "Ralli Wolf Operations";

export type EmailRow = { label: string; value: string };

export type EmailContent = {
  /** Inbox preview text. Never rendered in the body. */
  preview: string;
  /** Small mono line above the headline: what kind of message this is. */
  eyebrow: string;
  heading: string;
  paragraphs?: string[];
  /** A one-time code, set in mono at display size. */
  code?: string;
  /** Fine print directly under the action. */
  note?: string;
  rowsLabel?: string;
  rows?: EmailRow[];
  footer: string;
  /**
   * Pre-rendered markup for bodies that are genuinely structured. Inserted
   * verbatim after the paragraphs — the caller is responsible for escaping
   * anything interpolated into it.
   */
  bodyHtml?: string;
  date?: Date;
};

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Pads the preview text so a client cannot pull the first line of the body up
 * into the inbox listing behind it.
 */
const PREHEADER_SPACER = "&#847;&zwnj;&nbsp;".repeat(80);

const responsiveStyles = `@media only screen and (max-width:${EMAIL_MOBILE_BREAKPOINT_PX}px){
.gutter{padding-left:20px !important;padding-right:20px !important}
.masthead{display:block !important;width:100% !important;text-align:left !important}
.stamp{padding-top:8px !important}
.headline{font-size:22px !important}
.meta-label{display:block !important;width:100% !important;padding-bottom:2px !important}
.meta-value{display:block !important;width:100% !important}
.page{padding:24px 12px !important}
}`;

/**
 * Formats the masthead timestamp in IST — this is an Indian operations team,
 * so a local reading is more use to them than UTC.
 */
export function formatEmailStamp(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Kolkata",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(entry => entry.type === type)?.value ?? "";

  return `${part("day")}.${part("month")}.${part("year")} · ${part("hour")}:${part("minute")} IST`;
}

export function renderEmail(content: EmailContent): string {
  const stamp = formatEmailStamp(content.date ?? new Date());
  const C = EMAIL_COLORS;
  const F = EMAIL_FONT_STACKS;

  const paragraphs = (content.paragraphs ?? [])
    .map(
      line =>
        `<p style="margin:0 0 16px;font-family:${F.sans};font-size:15px;line-height:1.65;color:${C.muted}">${escapeHtml(line)}</p>`
    )
    .join("");

  const code = content.code
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px"><tr><td style="border:1px solid ${C.border};padding:16px 24px;font-family:${F.mono};font-size:30px;font-weight:600;letter-spacing:0.22em;color:${C.text};line-height:36px">${escapeHtml(content.code)}</td></tr></table>`
    : "";

  const note = content.note
    ? `<p style="margin:18px 0 0;font-family:${F.mono};font-size:11px;color:${C.dim};line-height:16px">${escapeHtml(content.note)}</p>`
    : "";

  const rowsLabel = content.rowsLabel
    ? `<p style="margin:0 0 18px;font-family:${F.mono};font-size:11px;color:${C.dim};line-height:16px">${escapeHtml(content.rowsLabel)}</p>`
    : "";

  const rows = (content.rows ?? [])
    .map(
      row =>
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px"><tr><td class="meta-label" style="width:132px;vertical-align:top;font-family:${F.mono};font-size:11px;color:${C.dim};line-height:20px">${escapeHtml(row.label)}</td><td class="meta-value" style="vertical-align:top;font-family:${F.mono};font-size:13px;color:${C.text};line-height:20px;word-break:break-word">${escapeHtml(row.value)}</td></tr></table>`
    )
    .join("");

  const rowsSection = rows
    ? `<tr><td class="gutter" style="border-top:1px dashed ${C.border};padding:28px 32px">${rowsLabel}${rows}</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(content.heading)}</title>
<style>${responsiveStyles}</style>
</head>
<body class="page" style="background-color:${C.bodyBackground};margin:0;padding:40px 16px;font-family:${F.sans}">
<div style="display:none;visibility:hidden;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;opacity:0;height:0;width:0;max-height:0;max-width:0">${escapeHtml(content.preview)}${PREHEADER_SPACER}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:${C.background};border:1px solid ${C.border};border-collapse:collapse">
<tr><td class="gutter" style="padding:20px 32px;border-bottom:1px solid ${C.border}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
<td class="masthead" style="vertical-align:middle">
<p style="margin:0;font-family:${F.sans};font-size:13px;font-weight:500;color:${C.text};line-height:16px">${escapeHtml(APP_NAME)}</p>
</td>
<td align="right" class="masthead stamp" style="vertical-align:middle">
<p style="margin:0;font-family:${F.mono};font-size:12px;color:${C.dim}">${stamp}</p>
</td>
</tr></table>
</td></tr>
<tr><td class="gutter" style="padding:40px 32px 36px">
<p style="margin:0 0 14px;font-family:${F.mono};font-size:11px;color:${C.dim};line-height:16px">${escapeHtml(content.eyebrow)}</p>
<h1 class="headline" style="margin:0 0 24px;font-family:${F.sans};font-weight:500;font-size:28px;line-height:1.2;letter-spacing:-0.022em;color:${C.text}">${escapeHtml(content.heading)}</h1>
${paragraphs}${code}${content.bodyHtml ?? ""}${note}
</td></tr>
${rowsSection}
<tr><td class="gutter" style="border-top:1px dashed ${C.border};padding:18px 32px 22px">
<p style="margin:0;font-family:${F.mono};font-size:10px;color:${C.dim};line-height:16px">${escapeHtml(content.footer)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
