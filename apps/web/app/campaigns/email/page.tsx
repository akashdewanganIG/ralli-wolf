"use client";

import { CampaignFilterValues } from "@/components/campaign-filter";
import { Campaign, CampaignTable } from "@/components/campaign-table";
import EditCampaignModal from "@/components/EditCampaignModal";
import { useBrevoCampaigns, useDeleteCampaign } from "@/hooks/useBrevo";
import { brevoService } from "@/lib/api/services";
import { BrevoCampaign } from "@/lib/api/types";
import { DeleteConfirmationDialog } from "@repo/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@/components/data-table";

function paginateArray<T>(
  array: T[],
  page: number,
  limit: number
): { data: T[]; totalPages: number; totalCount: number } {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedData = array.slice(startIndex, endIndex);
  const totalPages = Math.ceil(array.length / limit);

  return {
    data: paginatedData,
    totalPages,
    totalCount: array.length,
  };
}

function mapBrevoToUiCampaign(c: BrevoCampaign): Campaign {
  const sent = c.statistics?.sent ?? c.statistics?.delivered ?? 0;
  const delivered = c.statistics?.delivered ?? 0;
  const opens = c.statistics?.opens ?? 0;
  const clicks = c.statistics?.clicks ?? 0;
  const safeRate = (num: number, den: number) =>
    den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0;
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
    startDateRaw: start, // Store raw ISO date string for filtering
    endDate: end ? new Date(end).toLocaleDateString() : "",
    createdAt: c.createdAt,
    createdBy: c.sender?.name || c.sender?.email || "Brevo",
    fromEmail: c.sender?.email,
    replyToEmail: (c as any).replyTo || undefined,
    numMessages: sent,
    openRate:
      c.statistics?.openPercentage ?? safeRate(opens, sent || delivered),
    clickRate:
      c.statistics?.clickPercentage ?? safeRate(clicks, sent || delivered),
  };
}

export default function EmailCampaignsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<CampaignFilterValues>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const { data, isLoading } = useBrevoCampaigns({ limit: 50, offset: 0 });
  const deleteCampaignMutation = useDeleteCampaign();
  const [showDelete, setShowDelete] = useState(false);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<BrevoCampaign | null>(
    null
  );

  const handleCampaignClick = (campaign: Campaign) => {
    // const isDraft = campaign.status?.toLowerCase() === 'draft';
    // if (isDraft) {
    //   const brevoUrl = `https://app.brevo.com/marketing-campaign/edit/${campaign.id}`;
    //   window.open(brevoUrl, '_blank');
    // } else {
    router.push(`/campaigns/email/${campaign.id}`);
    // }
  };

  const filteredCampaigns = useMemo(() => {
    const brevoCampaigns = (data?.campaigns || []).map(mapBrevoToUiCampaign);
    let filtered = brevoCampaigns;

    if (searchQuery) {
      filtered = filtered.filter(
        campaign =>
          campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          campaign.createdBy.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter - normalize status values for comparison
    if (filters.status && filters.status.trim() !== "") {
      const statusMap: Record<string, string[]> = {
        draft: ["draft"],
        sent: ["sent"],
        scheduled: ["scheduled"],
        running: ["running", "in_process"],
        suspended: ["suspended"],
        archived: ["archived", "archive"],
        rejected: ["rejected"],
        cancelled: ["cancelled", "canceled"],
      };

      const filterStatus = filters.status.toLowerCase().trim();
      const validStatuses = statusMap[filterStatus] || [filterStatus];

      filtered = filtered.filter(campaign => {
        const campaignStatus = campaign.status?.toLowerCase().trim() || "";
        return validStatuses.includes(campaignStatus);
      });
    }

    // Starting date filter
    if (filters.startDate) {
      try {
        const filterDate = new Date(filters.startDate);
        if (!isNaN(filterDate.getTime())) {
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(campaign => {
            if (!campaign.startDateRaw) return false;
            try {
              const campaignStartDate = new Date(campaign.startDateRaw);
              if (isNaN(campaignStartDate.getTime())) return false;
              campaignStartDate.setHours(0, 0, 0, 0);
              return campaignStartDate.getTime() === filterDate.getTime();
            } catch {
              return false;
            }
          });
        }
      } catch {
        // Invalid date, skip this filter
      }
    }

    // Created from filter
    if (filters.createdFrom) {
      try {
        const filterDate = new Date(filters.createdFrom);
        if (!isNaN(filterDate.getTime())) {
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(campaign => {
            if (!campaign.createdAt) return false;
            try {
              const campaignCreatedDate = new Date(campaign.createdAt);
              if (isNaN(campaignCreatedDate.getTime())) return false;
              campaignCreatedDate.setHours(0, 0, 0, 0);
              return campaignCreatedDate.getTime() >= filterDate.getTime();
            } catch {
              return false;
            }
          });
        }
      } catch {
        // Invalid date, skip this filter
      }
    }

    // Created to filter
    if (filters.createdTo) {
      try {
        const filterDate = new Date(filters.createdTo);
        if (!isNaN(filterDate.getTime())) {
          filterDate.setHours(23, 59, 59, 999);
          filtered = filtered.filter(campaign => {
            if (!campaign.createdAt) return false;
            try {
              const campaignCreatedDate = new Date(campaign.createdAt);
              if (isNaN(campaignCreatedDate.getTime())) return false;
              campaignCreatedDate.setHours(23, 59, 59, 999);
              return campaignCreatedDate.getTime() <= filterDate.getTime();
            } catch {
              return false;
            }
          });
        }
      } catch {
        // Invalid date, skip this filter
      }
    }

    if (
      currentPage > 1 &&
      filtered.length <= (currentPage - 1) * itemsPerPage
    ) {
      setCurrentPage(1);
    }

    return filtered;
  }, [data?.campaigns, searchQuery, filters, currentPage, itemsPerPage]);

  const paginatedData = useMemo(() => {
    return paginateArray(filteredCampaigns, currentPage, itemsPerPage);
  }, [filteredCampaigns, currentPage, itemsPerPage]);

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const handleCreateCampaign = () => {
    const brevoUrl =
      "https://app.brevo.com/marketing-campaign/campaign-setup?source=outbound-modal";
    window.open(brevoUrl, "_blank");
  };

  const handleEditClick = async (campaign: Campaign) => {
    try {
      const campaignData = await brevoService.getCampaignDetails(
        Number(campaign.id)
      );
      setEditingCampaign(campaignData);
      setShowEditModal(true);
    } catch (error) {
      console.error("Failed to load campaign details:", error);
    }
  };

  const handleEditUpdated = () => {
    // Refetch campaigns after update
    window.location.reload();
  };

  return (
    <div className="p-4">
      <style
        dangerouslySetInnerHTML={{
          __html: `@import url('https://fonts.googleapis.com/css2?family=Courgette&family=Karla:wght@400&display=swap');`,
        }}
      />
      <CampaignTable
        campaigns={paginatedData.data}
        title="Email Campaigns"
        subtitle={
          isLoading
            ? "Loading email campaigns..."
            : "Browse and manage your email campaigns"
        }
        searchQuery={searchQuery}
        filters={filters}
        channelFilter={"Email"}
        currentPage={currentPage}
        totalPages={paginatedData.totalPages}
        totalCount={paginatedData.totalCount}
        itemsPerPage={itemsPerPage}
        isLoading={isLoading}
        onSearchChange={value => {
          setSearchQuery(value);
          setCurrentPage(1);
        }}
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
          window.open(brevoUrl, "_blank");
        }}
        onDeleteClick={item => {
          setSelected(item);
          setShowDelete(true);
        }}
        onEditClick={handleEditClick}
        onCreateClick={handleCreateCampaign}
      />
      <DeleteConfirmationDialog
        open={showDelete && !!selected}
        onOpenChange={open => {
          if (!open) setShowDelete(false);
        }}
        onConfirm={async () => {
          if (!selected) return;
          try {
            await deleteCampaignMutation.mutateAsync(Number(selected.id));
            setShowDelete(false);
          } catch (error) {
            console.error("Failed to delete campaign:", error);
          }
        }}
        itemName={selected?.name || ""}
        itemType={"campaign" as any}
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
    </div>
  );
}
