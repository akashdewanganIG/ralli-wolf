import type { BrevoCampaign, BrevoCampaignStats } from "./api/types";

export interface NormalizedBrevoCampaignStats {
  sent: number;
  delivered: number;
  uniqueOpens: number;
  uniqueClicks: number;
  unsubscribes: number;
  complaints: number;
  hardBounces: number;
  softBounces: number;
  deferred: number;
  totalOpens: number;
  totalClicks: number;
  appleMppOpens: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
  spamRate: number;
  clickToOpenRate: number;
}

const STAT_FIELDS = [
  "sent",
  "delivered",
  "uniqueViews",
  "uniqueClicks",
  "unsubscriptions",
  "complaints",
  "hardBounces",
  "softBounces",
  "deferred",
  "viewed",
  "clickers",
  "appleMppOpens",
] as const satisfies ReadonlyArray<keyof BrevoCampaignStats>;

function percentage(numerator: number, denominator: number): number {
  return denominator > 0
    ? Number(((numerator / denominator) * 100).toFixed(2))
    : 0;
}

export function normalizeBrevoCampaignStats(
  campaign: BrevoCampaign
): NormalizedBrevoCampaignStats {
  const sources = campaign.statistics?.globalStats
    ? [campaign.statistics.globalStats]
    : (campaign.statistics?.campaignStats ?? []);
  const totals = Object.fromEntries(
    STAT_FIELDS.map(field => [
      field,
      sources.reduce((sum, stats) => sum + (stats[field] ?? 0), 0),
    ])
  ) as Record<(typeof STAT_FIELDS)[number], number>;

  const deliveryDenominator = totals.delivered || totals.sent;
  return {
    sent: totals.sent,
    delivered: totals.delivered,
    uniqueOpens: totals.uniqueViews,
    uniqueClicks: totals.uniqueClicks,
    unsubscribes: totals.unsubscriptions,
    complaints: totals.complaints,
    hardBounces: totals.hardBounces,
    softBounces: totals.softBounces,
    deferred: totals.deferred,
    totalOpens: totals.viewed,
    totalClicks: totals.clickers,
    appleMppOpens: totals.appleMppOpens,
    deliveryRate: percentage(totals.delivered, totals.sent),
    openRate: percentage(totals.uniqueViews, deliveryDenominator),
    clickRate: percentage(totals.uniqueClicks, deliveryDenominator),
    unsubscribeRate: percentage(totals.unsubscriptions, deliveryDenominator),
    spamRate: percentage(totals.complaints, deliveryDenominator),
    clickToOpenRate: percentage(totals.uniqueClicks, totals.uniqueViews),
  };
}

export function brevoReplyTo(campaign: BrevoCampaign): string | undefined {
  return typeof campaign.replyTo === "string"
    ? campaign.replyTo
    : campaign.replyTo?.email;
}
