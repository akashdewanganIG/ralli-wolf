"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { CampaignTable, Campaign } from "@/components/campaign-table";
import { CampaignFilterValues } from "@/components/campaign-filter";
import Link from "next/link";
import { Button } from "@repo/ui";
import { whatsappService } from "@/lib/api/services";
import { Alert } from "@repo/ui/components/ui/alert";
import { TablePageSkeleton } from "@/components/skeletons";

const CreateCampaignModal = dynamic(
  () =>
    import("@/components/whatsapp/create-campaign-modal").then(
      module => module.CreateCampaignModal
    ),
  { ssr: false }
);

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

export default function WhatsappCampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<CampaignFilterValues>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editCampaignId, setEditCampaignId] = useState<number | undefined>(
    undefined
  );

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await whatsappService.listCampaigns();
      const mapped: Campaign[] = data.map((c: any) => {
        const stats = c.deliveryStats || {
          total: 0,
          pending: 0,
          queued: 0,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
        };
        const status = getStatusFromDeliveryStats(stats);
        const effectiveStartDate = c.scheduledAt || c.startDate || c.createdAt;

        return {
          id: String(c.id),
          name: c.name || "Untitled Campaign",
          channel: "WhatsApp",
          status,
          // For drafts, hide the start time in the table; it will show as "-" in the UI.
          startDate: status === "Draft" ? undefined : effectiveStartDate,
          startDateRaw: effectiveStartDate,
          endDate: c.endDate,
          createdAt: c.createdAt,
          createdBy:
            c.creator?.firstName || c.creator?.lastName
              ? `${c.creator.firstName ?? ""} ${c.creator.lastName ?? ""}`.trim()
              : c.creator?.email || "Unknown",
          templateName: c.templateName,
          numMessages: stats.total || 0,
          openRate:
            stats.total > 0
              ? Math.round((stats.read / stats.total) * 100 * 10) / 10
              : 0,
          clickRate: 0,
          deliveryStats: stats,
        };
      });
      setCampaigns(mapped);
    } catch (error) {
      console.error("Failed to load campaigns:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Campaigns could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleCampaignClick = (campaign: Campaign) => {
    router.push(`/campaigns/whatsapp/${campaign.id}`);
  };

  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns;

    if (searchQuery) {
      filtered = filtered.filter(
        campaign =>
          campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          campaign.createdBy.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (filters.status && filters.status.trim() !== "") {
      const filterStatus = filters.status.toLowerCase().trim();
      filtered = filtered.filter(campaign => {
        const campaignStatus = campaign.status?.toLowerCase().trim() || "";
        return campaignStatus === filterStatus;
      });
    }

    if (
      currentPage > 1 &&
      filtered.length <= (currentPage - 1) * itemsPerPage
    ) {
      setCurrentPage(1);
    }

    return filtered;
  }, [campaigns, searchQuery, filters, currentPage, itemsPerPage]);

  const paginatedData = useMemo(() => {
    return paginateArray(filteredCampaigns, currentPage, itemsPerPage);
  }, [filteredCampaigns, currentPage, itemsPerPage]);

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const handleCreateSuccess = () => {
    loadCampaigns();
    setEditCampaignId(undefined); // Reset edit state after success
  };

  const handleEditClick = (campaign: Campaign) => {
    setEditCampaignId(Number(campaign.id));
    setIsModalOpen(true);
  };

  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setEditCampaignId(undefined); // Reset edit state when modal closes
    }
  };

  if (loading) {
    return <TablePageSkeleton filters={2} />;
  }

  return (
    <div className="app-page space-y-4">
      {loadError ? (
        <Alert
          tone="error"
          title="WhatsApp campaigns could not be loaded"
          action={
            <Button type="button" variant="outline" onClick={loadCampaigns}>
              Retry
            </Button>
          }
        >
          {loadError}
        </Alert>
      ) : null}
      {!loadError && campaigns.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No WhatsApp campaigns yet.{" "}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="underline"
          >
            Create your first campaign
          </button>
          .
        </div>
      ) : null}
      {!loadError ? (
        <CampaignTable
          campaigns={paginatedData.data}
          title="WhatsApp Campaigns"
          subtitle="Browse and manage your WhatsApp campaigns"
          searchQuery={searchQuery}
          filters={filters}
          channelFilter={"WhatsApp"}
          currentPage={currentPage}
          totalPages={paginatedData.totalPages}
          totalCount={paginatedData.totalCount}
          itemsPerPage={itemsPerPage}
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
          onEditClick={handleEditClick}
          onCreateClick={() => {
            setEditCampaignId(undefined);
            setIsModalOpen(true);
          }}
          headerActions={
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/campaigns/whatsapp/management">
                  Manage Templates & Numbers
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/campaigns/whatsapp/opt-outs">Opt-Outs</Link>
              </Button>
            </div>
          }
        />
      ) : null}
      <CreateCampaignModal
        open={isModalOpen}
        onOpenChange={handleModalOpenChange}
        onSuccess={handleCreateSuccess}
        editCampaignId={editCampaignId}
      />
    </div>
  );
}
