import { AnalyticsEvent } from "./api/types";

function displayValue(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? text.slice(0, 300) : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

function eventValue(
  data: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = displayValue(data[key]);
    if (value) return value;
  }
  return null;
}

function joinPieces(pieces: Array<string | null>): string {
  return pieces.filter((piece): piece is string => piece !== null).join(" • ");
}

export function formatAnalyticsTitle(eventType?: string) {
  if (!eventType) return "Activity";

  if (eventType.startsWith("whatsapp.")) {
    const status = eventType.replace("whatsapp.", "");
    const statusMap: Record<string, string> = {
      sent: "WhatsApp Message Sent",
      delivered: "WhatsApp Message Delivered",
      read: "WhatsApp Message Read",
      failed: "WhatsApp Message Failed",
      queued: "WhatsApp Message Queued",
      opted_out: "WhatsApp Opted Out",
      opted_out_stop_message: "Opted Out via STOP Message",
      opt_out_removed: "Opt-Out Removed (Re-subscribed)",
    };
    return (
      statusMap[status] ||
      `WhatsApp ${status.charAt(0).toUpperCase() + status.slice(1)}`
    );
  }

  const parts = eventType.split(".").filter(Boolean);
  const normalized = parts.join(" ");
  return (
    normalized
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, char => char.toUpperCase()) || "Activity"
  );
}

export function formatAnalyticsDescription(event: AnalyticsEvent) {
  const data = event.eventData;
  if (data) {
    const campaignName = eventValue(data, "campaignName");
    const status = eventValue(data, "status", "event");
    const error = eventValue(data, "errorMessage", "error", "reason");
    const userName = eventValue(data, "userName");
    const messageText = eventValue(data, "messageText");
    const source = eventValue(data, "source");
    const reason = eventValue(data, "reason");

    if (event.eventType === "whatsapp.opted_out_stop_message") {
      const pieces = [
        userName ? `User: ${userName}` : null,
        messageText ? `Message: "${messageText}"` : null,
        source ? `Source: ${source}` : null,
      ];
      return joinPieces(pieces);
    }

    if (event.eventType === "whatsapp.opt_out_removed") {
      const previousCampaignName = eventValue(data, "previousCampaignName");
      const pieces = [
        userName ? `User: ${userName}` : null,
        reason ? `${reason}` : "User can now receive messages again",
        previousCampaignName
          ? `Previous campaign: ${previousCampaignName}`
          : null,
      ];
      return joinPieces(pieces);
    }

    if (event.eventType === "whatsapp.opted_out") {
      const pieces = [
        userName ? `User: ${userName}` : null,
        reason ? `Reason: ${reason}` : null,
        campaignName ? `Campaign: ${campaignName}` : null,
      ];
      return joinPieces(pieces);
    }

    if (event.eventType?.startsWith("whatsapp.") && campaignName) {
      const pieces = [
        `Campaign: ${campaignName}`,
        status ? `Status: ${status}` : null,
        error ? `Error: ${error}` : null,
      ];
      return joinPieces(pieces);
    }

    const address = eventValue(data, "address", "phone", "mobile");
    const pieces = [
      campaignName ? `Campaign: ${campaignName}` : null,
      status ? `Status: ${status}` : null,
      address ? `Recipient: ${address}` : null,
      error ? `Error: ${error}` : null,
    ];
    const description = joinPieces(pieces);
    if (description) return description;
    const summary = Object.entries(data)
      .map(([key, value]) => {
        const text = displayValue(value);
        return text ? `${key}: ${text}` : null;
      })
      .filter((piece): piece is string => piece !== null)
      .slice(0, 3);
    if (summary.length) return summary.join(" • ");
  }
  return "No additional metadata";
}
