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
import { brevoReplyTo, normalizeBrevoCampaignStats } from "@/lib/brevo";
import { getErrorMessage } from "@/lib/api/error-handler";

const EditCampaignModal = dynamic(
  () => import("@/components/edit-campaign-modal"),
  { ssr: false }
);

function formatDateTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function mapBrevoToUiCampaign(c: BrevoCampaign): UICampaign {
  const stats = normalizeBrevoCampaignStats(c);
  const start = c.sentDate || c.scheduledAt || c.createdAt;
  const end = c.modifiedAt || "";
  return {
    id: String(c.id),
    name: c.name,
    channel: "Email",
    status: c.status,
    startDate: formatDateTime(start),
    endDate: end ? new Date(end).toLocaleDateString() : "",
    createdBy: c.sender?.name || c.sender?.email || "Brevo",
    subject: c.subject,
    fromEmail: c.sender?.email,
    replyToEmail: brevoReplyTo(c),
    previewText: c.previewText,
    numMessages: stats.sent,
    openRate: stats.openRate,
    clickRate: stats.clickRate,
  };
}

export default function EmailCampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const numericId = Number(id);
  const validCampaignId = Number.isSafeInteger(numericId) && numericId > 0;
  const [data, setData] = useState<BrevoCampaign | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!validCampaignId) {
        setError("Campaign ID is invalid");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await brevoService.getCampaignDetails(
          numericId,
          "globalStats"
        );
        if (!cancelled) setData(res);
      } catch (error: unknown) {
        if (!cancelled) setError(getErrorMessage(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [numericId, validCampaignId]);

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
    if (!validCampaignId) return;
    async function refetch() {
      try {
        const res = await brevoService.getCampaignDetails(
          numericId,
          "globalStats"
        );
        setData(res);
      } catch (error: unknown) {
        setError(getErrorMessage(error));
        toast.error(error, "Campaign reload failed");
      }
    }
    refetch();
    setShowEditModal(false);
  };

  const handleRefresh = async () => {
    if (!validCampaignId) return;
    try {
      setRefreshing(true);
      setError(null);
      const res = await brevoService.getCampaignDetails(
        numericId,
        "globalStats"
      );
      setData(res);
      toast.success("Campaign statistics refreshed");
    } catch (error: unknown) {
      setError(getErrorMessage(error));
      toast.error(error, "Campaign refresh failed");
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
            <Button onClick={handleRefresh} variant="outline">
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
          data && ["draft", "queued"].includes(data.status)
            ? handleEdit
            : undefined
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
