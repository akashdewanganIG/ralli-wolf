import { AnalyticsEvent } from "./api/types";

export function formatAnalyticsTitle(eventType?: string) {
  if (!eventType) return "Activity";

  // Handle WhatsApp campaign events
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
  if (data && typeof data === "object") {
    const campaignName = (data as any).campaignName;
    const status = (data as any).status || (data as any).event;
    const error =
      (data as any).errorMessage || (data as any).error || (data as any).reason;
    const userName = (data as any).userName;
    const messageText = (data as any).messageText;
    const source = (data as any).source;
    const reason = (data as any).reason;

    // Handle opt-out events specially
    if (event.eventType === "whatsapp.opted_out_stop_message") {
      const pieces = [
        userName ? `User: ${userName}` : null,
        messageText ? `Message: "${messageText}"` : null,
        source ? `Source: ${source}` : null,
      ].filter(Boolean);
      return pieces.join(" • ");
    }

    // Handle opt-out removal events
    if (event.eventType === "whatsapp.opt_out_removed") {
      const previousCampaignName = (data as any).previousCampaignName;
      const pieces = [
        userName ? `User: ${userName}` : null,
        reason ? `${reason}` : "User can now receive messages again",
        previousCampaignName
          ? `Previous campaign: ${previousCampaignName}`
          : null,
      ].filter(Boolean);
      return pieces.join(" • ");
    }

    // Handle generic opt-out events
    if (event.eventType === "whatsapp.opted_out") {
      const pieces = [
        userName ? `User: ${userName}` : null,
        reason ? `Reason: ${reason}` : null,
        campaignName ? `Campaign: ${campaignName}` : null,
      ].filter(Boolean);
      return pieces.join(" • ");
    }

    // For WhatsApp campaign events, show campaign name prominently
    if (event.eventType?.startsWith("whatsapp.") && campaignName) {
      const pieces = [
        `Campaign: ${campaignName}`,
        status ? `Status: ${status}` : null,
        error ? `Error: ${error}` : null,
      ].filter(Boolean);
      return pieces.join(" • ");
    }

    const address =
      (data as any).address || (data as any).phone || (data as any).mobile;
    const pieces = [
      campaignName ? `Campaign: ${campaignName}` : null,
      status ? `Status: ${status}` : null,
      address ? `Recipient: ${address}` : null,
      error ? `Error: ${error}` : null,
    ].filter(Boolean);
    if (pieces.length) return pieces.join(" • ");
    const summary = Object.entries(data as Record<string, unknown>)
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${String(value)}`);
    if (summary.length) return summary.join(" • ");
  }
  return "No additional metadata";
}
