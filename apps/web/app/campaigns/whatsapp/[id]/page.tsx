"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { CampaignDetailPage } from "@/components/campaign-detail-page";
import { whatsappService } from "@/lib/api/services";
import { Alert } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { DetailPageSkeleton } from "@/components/skeletons";

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusFromDeliveryStats(stats: {
  total: number;
  pending: number;
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
  if (stats.queued > 0) return "Sending";
  return "Active";
}

export default function WhatsappCampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const idParam = params?.id as string;
  const id = Number(idParam);
  const [campaign, setCampaign] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const intervalRef = useRef<any>(null);

  const handleBack = () => {
    router.push("/campaigns/whatsapp");
  };

  const load = async () => {
    try {
      if (!hasLoaded) setLoading(true);
      const [campaignData, d, e] = await Promise.all([
        whatsappService.getCampaignById(id),
        whatsappService.listDeliveries(id),
        whatsappService.listEvents(id),
      ]);

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

      // Map campaign data to the expected format
      const mappedCampaign = {
        id: String(campaignData.id),
        name: campaignData.name || "Untitled Campaign",
        channel: "WhatsApp",
        status,
        // For drafts, hide the start time in the detail header (will render as "-").
        startDate:
          status === "Draft" ? "-" : formatDate(campaignData.startDate),
        endDate: formatDate(campaignData.endDate),
        createdBy:
          campaignData.creator?.name ||
          campaignData.creator?.email ||
          "Unknown",
        numMessages: stats.total || 0,
        openRate:
          stats.total > 0
            ? Math.round((stats.read / stats.total) * 100 * 10) / 10
            : 0,
        clickRate: 0,
        deliveryStats: stats,
        templateName: campaignData.templateName,
        template: campaignData.template,
        messageParams: campaignData.messageParams,
      };

      setCampaign(mappedCampaign);
      setDeliveries(d);
      setEvents(e);
      setError(null);
      setHasLoaded(true);
    } catch (err: any) {
      setError(err?.message || "Failed to load campaign data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id || isNaN(id)) return;
    let canceled = false;

    const loadData = async () => {
      if (canceled) return;
      await load();
    };

    const startPolling = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === "visible") {
          loadData();
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
        loadData();
        startPolling();
      } else {
        stopPolling();
      }
    };

    loadData();
    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      canceled = true;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [id]);

  if (loading && !campaign) {
    return <DetailPageSkeleton />;
  }

  if (error && !campaign) {
    return (
      <div className="app-page">
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
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-4">
        <p>Campaign not found</p>
        <button
          type="button"
          onClick={handleBack}
          className="mt-4 text-primary transition-colors hover:text-info"
        >
          Back to campaigns
        </button>
      </div>
    );
  }

  return (
    <CampaignDetailPage
      campaign={campaign}
      template={campaign.template}
      messageParams={campaign.messageParams}
      onBack={handleBack}
      deliveries={deliveries}
      events={events}
      loading={loading}
      error={error}
      onRetry={load}
    />
  );
}
