"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useParams } from "next/navigation";
import { CampaignDetailPage } from "@/components/campaign-detail-page";
import { type Campaign as UICampaign } from "@/components/campaign-table";
import { BrevoCampaign } from "@/lib/api/types";
import { brevoService } from "@/lib/api/services";
import { toast } from "@/lib/toast";
import {
  DetailHeaderSkeleton,
  SectionSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from "@/components/skeletons";
import { Button } from "@repo/ui";
import { PageShell } from "@repo/ui/components/ui/page-shell";

const EditCampaignModal = dynamic(
  () => import("@/components/EditCampaignModal"),
  { ssr: false }
);

function formatDateTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function mapBrevoToUiCampaign(c: BrevoCampaign): UICampaign {
  const globalStats = (c as any)?.statistics?.globalStats || {};
  const sent =
    (c as any)?.statistics?.sent ??
    (c as any)?.statistics?.delivered ??
    globalStats.sent ??
    0;
  const opens = (c as any)?.statistics?.opens ?? globalStats.uniqueViews ?? 0;
  const clicks =
    (c as any)?.statistics?.clicks ?? globalStats.uniqueClicks ?? 0;
  const safeRate = (num: number, den: number) =>
    den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0;
  const start = (c as any).sentDate || (c as any).scheduledAt || c.createdAt;
  const end = (c as any).modifiedAt || "";
  const mapped = {
    id: String(c.id),
    name: (c as any).name,
    channel: "Email",
    status: (c as any).status,
    startDate: formatDateTime(start),
    endDate: end ? new Date(end).toLocaleDateString() : "",
    createdBy: (c as any).sender?.name || (c as any).sender?.email || "Brevo",
    subject: (c as any).subject,
    fromEmail: (c as any).sender?.email,
    replyToEmail:
      typeof (c as any).replyTo === "string"
        ? (c as any).replyTo
        : (c as any).replyTo?.email || undefined,
    previewText: (c as any).previewText || undefined,
    numMessages: sent,
    openRate:
      (c as any)?.statistics?.openPercentage ??
      globalStats.opensRate ??
      safeRate(opens, sent),
    clickRate:
      (c as any)?.statistics?.clickPercentage ?? safeRate(clicks, sent),
  } as unknown as UICampaign;
  return mapped;
}

export default function EmailCampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const numericId = Number(id);
  const [data, setData] = useState<BrevoCampaign | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (Number.isNaN(numericId)) return;
      setLoading(true);
      setError(null);
      try {
        // Try to fetch with globalStats first, fallback to without statistics if it fails
        let res: BrevoCampaign;
        try {
          res = await brevoService.getCampaignDetails(numericId, "globalStats");
        } catch (statsError: any) {
          // If globalStats fails, try without statistics parameter
          console.warn(
            "Failed to fetch with globalStats, trying without statistics:",
            statsError
          );
          res = await brevoService.getCampaignDetails(numericId);
        }
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load campaign");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [numericId]);

  const campaign = useMemo(
    () => (data ? mapBrevoToUiCampaign(data) : undefined),
    [data]
  );

  const handleBack = () => {
    router.push("/campaigns/email");
  };

  const handleEdit = () => {
    if (data) {
      setShowEditModal(true);
    }
  };

  const handleEditUpdated = () => {
    // Refetch campaign data after update
    if (Number.isNaN(numericId)) return;
    async function refetch() {
      try {
        // Try to fetch with globalStats first, fallback to without statistics if it fails
        let res: BrevoCampaign;
        try {
          res = await brevoService.getCampaignDetails(numericId, "globalStats");
        } catch (statsError: any) {
          // If globalStats fails, try without statistics parameter
          console.warn(
            "Failed to refetch with globalStats, trying without statistics:",
            statsError
          );
          res = await brevoService.getCampaignDetails(numericId);
        }
        setData(res);
      } catch (e: any) {
        console.error("Failed to refetch campaign:", e);
      }
    }
    refetch();
    setShowEditModal(false);
  };

  const handleRefresh = async () => {
    if (Number.isNaN(numericId)) return;
    try {
      setRefreshing(true);
      setError(null);
      // Try to fetch with globalStats first, fallback to without statistics if it fails
      let res: BrevoCampaign;
      try {
        res = await brevoService.getCampaignDetails(numericId, "globalStats");
      } catch (statsError: any) {
        // If globalStats fails, try without statistics parameter
        console.warn(
          "Failed to refresh with globalStats, trying without statistics:",
          statsError
        );
        res = await brevoService.getCampaignDetails(numericId);
      }
      setData(res);
      toast.success("Campaign statistics refreshed");
    } catch (e: any) {
      console.error("Failed to refresh campaign:", e);
      setError(e?.message || "Failed to refresh campaign");
      toast.error(e, "Campaign refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <DetailHeaderSkeleton />
        <SectionSkeleton>
          <StatGridSkeleton count={4} />
        </SectionSkeleton>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionSkeleton>
            <TableSkeleton rows={5} />
          </SectionSkeleton>
          <SectionSkeleton>
            <TableSkeleton rows={5} />
          </SectionSkeleton>
        </div>
        <SectionSkeleton>
          <StatGridSkeleton count={5} />
        </SectionSkeleton>
      </PageShell>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-[60vh] p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">
            {error || "Failed to load campaign"}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => window.location.reload()} variant="outline">
              Retry
            </Button>
            <Button onClick={handleBack} variant="outline">
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <CampaignDetailPage
        campaign={campaign}
        brevoCampaign={data || undefined}
        onBack={handleBack}
        onEdit={
          data?.status?.toLowerCase() !== "draft" ? handleEdit : undefined
        }
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />
      {data && (
        <EditCampaignModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          campaign={data}
          onUpdated={handleEditUpdated}
        />
      )}
    </>
  );
}
