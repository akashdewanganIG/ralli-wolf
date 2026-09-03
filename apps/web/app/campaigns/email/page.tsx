"use client";

import { CampaignFilterValues } from "@/components/campaign-filter";
import { Campaign, CampaignTable } from "@/components/campaign-table";
import EditCampaignModal from "@/components/edit-campaign-modal";
import { useBrevoCampaigns, useDeleteCampaign } from "@/hooks/use-brevo";
import { brevoService } from "@/lib/api/services";
import { BrevoCampaign } from "@/lib/api/types";
import { DeleteConfirmationDialog } from "@repo/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@/components/data-table";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { toast } from "@/lib/toast";
import { brevoReplyTo, normalizeBrevoCampaignStats } from "@/lib/brevo";

const EMAIL_CAMPAIGN_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "queued", label: "Queued" },
  { value: "in_process", label: "In process" },
  { value: "suspended", label: "Suspended" },
  { value: "archive", label: "Archived" },
] as const;

function mapBrevoToUiCampaign(c: BrevoCampaign): Campaign {
  const stats = normalizeBrevoCampaignStats(c);
  const start = c.scheduledAt || c.createdAt;
  const isCompleted =
    c.status?.toLowerCase?.() === "sent" ||
    c.status?.toLowerCase?.() === "archive" ||
    c.status?.toLowerCase?.() === "completed";
  const end = isCompleted ? c.modifiedAt || c.createdAt : "";
  const startDate = new Date(start);
  return {
    id: String(c.id),
    name: c.name,
    channel: "Email",
    status: c.status,
    startDate: startDate.toLocaleDateString(),
    startDateRaw: start,
    endDate: end ? new Date(end).toLocaleDateString() : "",
    createdAt: c.createdAt,
    createdBy: c.sender?.name || c.sender?.email || "Brevo",
    fromEmail: c.sender?.email,
    replyToEmail: brevoReplyTo(c),
    numMessages: stats.sent,
    openRate: stats.openRate,
    clickRate: stats.clickRate,
  };
}

export default function EmailCampaignsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<CampaignFilterValues>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const { data, isLoading } = useBrevoCampaigns({
    limit: itemsPerPage,
    offset: (currentPage - 1) * itemsPerPage,
    status: filters.status || undefined,
  });
  const deleteCampaignMutation = useDeleteCampaign();
  const [showDelete, setShowDelete] = useState(false);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<BrevoCampaign | null>(
    null
  );

  const handleCampaignClick = (campaign: Campaign) => {
    router.push(`/campaigns/email/${campaign.id}`);
  };

  const campaigns = useMemo(
    () => (data?.campaigns ?? []).map(mapBrevoToUiCampaign),
    [data?.campaigns]
  );
  const totalCount = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const handleCreateCampaign = () => {
    const brevoUrl =
      "https://app.brevo.com/marketing-campaign/campaign-setup?source=outbound-modal";
    window.open(brevoUrl, "_blank", "noopener,noreferrer");
  };

  const handleEditClick = async (campaign: Campaign) => {
    try {
      const campaignData = await brevoService.getCampaignDetails(
        Number(campaign.id)
      );
      setEditingCampaign(campaignData);
      setShowEditModal(true);
    } catch (error) {
      toast.error(error, "Failed to load campaign details");
    }
  };

  const handleEditUpdated = () => {
    setEditingCampaign(null);
  };

  return (
    <PageShell>
      <CampaignTable
        campaigns={campaigns}
        title="Email Campaigns"
        subtitle={
          isLoading
            ? "Loading email campaigns..."
            : "Browse and manage your email campaigns"
        }
        filters={filters}
        channelFilter={"Email"}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        itemsPerPage={itemsPerPage}
        isLoading={isLoading}
        onFilterChange={newFilters => {
          setFilters(newFilters);
          setCurrentPage(1);
        }}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        onCampaignClick={handleCampaignClick}
        onGoToCampaign={item => {
          const isDraft = item.status?.toLowerCase() === "draft";
          const brevoUrl = isDraft
            ? `https://app.brevo.com/marketing-campaign/edit/${item.id}`
            : `https://app.brevo.com/marketing-reports/email/${item.id}/overview`;
          window.open(brevoUrl, "_blank", "noopener,noreferrer");
        }}
        onDeleteClick={item => {
          setSelected(item);
          setShowDelete(true);
        }}
        onEditClick={handleEditClick}
        onCreateClick={handleCreateCampaign}
        searchEnabled={false}
        dateFiltersEnabled={false}
        statusOptions={EMAIL_CAMPAIGN_STATUSES}
      />
      <DeleteConfirmationDialog
        open={showDelete && !!selected}
        onOpenChange={open => {
          if (!open) setShowDelete(false);
        }}
        onConfirm={() => {
          if (!selected) return;
          deleteCampaignMutation.mutate(Number(selected.id), {
            onSuccess: () => setShowDelete(false),
          });
        }}
        itemName={selected?.name || ""}
        itemType="campaign"
        isLoading={deleteCampaignMutation.isPending}
        disabled={deleteCampaignMutation.isPending}
      />
      {editingCampaign && (
        <EditCampaignModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          campaign={editingCampaign}
          onUpdated={handleEditUpdated}
        />
      )}
    </PageShell>
  );
}
