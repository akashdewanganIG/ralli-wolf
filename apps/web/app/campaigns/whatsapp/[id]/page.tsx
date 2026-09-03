"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { CampaignDetailPage } from "@/components/campaign-detail-page";
import { whatsappService } from "@/lib/api/services";
import { Alert } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { DetailPageSkeleton } from "@/components/skeletons";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import type { Campaign } from "@/components/campaign-table";
import type { MessageTemplate } from "@/lib/api/types";

type DisplayCampaign = Campaign & {
  template?: MessageTemplate;
  messageParams?: Record<string, unknown>;
};

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusFromDeliveryStats(stats: {
  total: number;
  pending: number;
  processing?: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}): string {
  if (stats.total === 0) return "Draft";
  if (stats.pending === stats.total) return "Pending";
  if (stats.failed === stats.total) return "Failed";
  if (stats.delivered > 0 || stats.read > 0 || stats.sent > 0) return "Sent";
  if (stats.queued > 0 || (stats.processing ?? 0) > 0) return "Sending";
  return "Active";
}

export default function WhatsappCampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const idParam = params?.id as string;
  const id = Number(idParam);
  const [campaign, setCampaign] = useState<DisplayCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasLoadedRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const mountedRef = useRef(false);

  const handleBack = () => {
    router.push("/campaigns/whatsapp");
  };

  const load = useCallback(async () => {
    if (!Number.isSafeInteger(id) || id <= 0 || requestInFlightRef.current) {
      return;
    }
    requestInFlightRef.current = true;
    try {
      if (!hasLoadedRef.current && mountedRef.current) setLoading(true);
      const campaignData = await whatsappService.getCampaignById(id);
      if (!mountedRef.current) return;

      const stats = campaignData.deliveryStats || {
        total: 0,
        pending: 0,
        queued: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
      };
      const status = getStatusFromDeliveryStats(stats);

      const creatorName = [
        campaignData.creator.firstName,
        campaignData.creator.lastName,
      ]
        .filter(Boolean)
        .join(" ");
      const mappedCampaign: DisplayCampaign = {
        id: String(campaignData.id),
        name: campaignData.name || "Untitled Campaign",
        channel: "WhatsApp",
        status,

        startDate:
          status === "Draft" ? "-" : formatDate(campaignData.startDate),
        endDate: formatDate(campaignData.endDate),
        createdBy: creatorName || campaignData.creator.email || "Unknown",
        numMessages: stats.total || 0,
        openRate:
          stats.total > 0
            ? Math.round((stats.read / stats.total) * 100 * 10) / 10
            : 0,
        clickRate: 0,
        deliveryStats: stats,
        templateName: campaignData.templateName,
        template: campaignData.template,
        messageParams: campaignData.messageParams ?? undefined,
      };

      setCampaign(mappedCampaign);
      setError(null);
      hasLoadedRef.current = true;
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to load campaign data"
        );
      }
    } finally {
      requestInFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    mountedRef.current = true;
    hasLoadedRef.current = false;
    setCampaign(null);
    setError(null);
    if (!Number.isSafeInteger(id) || id <= 0) {
      setLoading(false);
      return () => {
        mountedRef.current = false;
      };
    }

    const startPolling = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === "visible") {
          void load();
        }
      }, 5000);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void load();
        startPolling();
      } else {
        stopPolling();
      }
    };

    void load();
    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mountedRef.current = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [id, load]);

  if (loading && !campaign) {
    return <DetailPageSkeleton />;
  }

  if (error && !campaign) {
    return (
      <PageShell>
        <Alert
          tone="error"
          title="Campaign could not be loaded"
          action={
            <Button type="button" variant="outline" onClick={handleBack}>
              Back to campaigns
            </Button>
          }
        >
          {error}
        </Alert>
      </PageShell>
    );
  }

  if (!campaign) {
    return (
      <PageShell>
        <p>Campaign not found</p>
        <button
          type="button"
          onClick={handleBack}
          className="mt-4 text-primary transition-colors hover:text-info"
        >
          Back to campaigns
        </button>
      </PageShell>
    );
  }

  return (
    <CampaignDetailPage
      campaign={campaign}
      template={campaign.template}
      messageParams={campaign.messageParams}
      onBack={handleBack}
      loading={loading}
      error={error}
      onRetry={load}
    />
  );
}
