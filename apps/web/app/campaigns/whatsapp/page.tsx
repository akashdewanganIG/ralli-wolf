"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { CampaignTable, Campaign } from "@/components/campaign-table";
import { CampaignFilterValues } from "@/components/campaign-filter";
import Link from "next/link";
import { Button } from "@repo/ui";
import { whatsappService } from "@/lib/api/services";
import { Alert } from "@repo/ui/components/ui/alert";
import { TablePageSkeleton } from "@/components/skeletons";
import { DEFAULT_PAGE_SIZE } from "@/components/data-table";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const CreateCampaignModal = dynamic(
  () =>
    import("@/components/whatsapp/create-campaign-modal").then(
      module => module.CreateCampaignModal
    ),
  { ssr: false }
);

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

export default function WhatsappCampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<CampaignFilterValues>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editCampaignId, setEditCampaignId] = useState<number | undefined>(
    undefined
  );
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await whatsappService.listCampaigns({
        skip: (currentPage - 1) * itemsPerPage,
        take: itemsPerPage,
        search: debouncedSearch.trim() || undefined,
        status: filters.status?.trim().toLowerCase() || undefined,
        startDate: filters.startDate?.toISOString().slice(0, 10),
        createdFrom: filters.createdFrom?.toISOString().slice(0, 10),
        createdTo: filters.createdTo?.toISOString().slice(0, 10),
      });
      const mapped: Campaign[] = response.data.map(c => {
        const stats = c.deliveryStats;
        const status = getStatusFromDeliveryStats(stats);
        const effectiveStartDate = c.scheduledAt || c.startDate || c.createdAt;

        return {
          id: String(c.id),
          name: c.name || "Untitled Campaign",
          channel: "WhatsApp",
          status,

          startDate: status === "Draft" ? undefined : effectiveStartDate,
          startDateRaw: effectiveStartDate,
          endDate: c.endDate ?? undefined,
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
      setTotalCount(response.pagination.total);
      setTotalPages(response.pagination.pages);
      if (
        response.pagination.pages > 0 &&
        currentPage > response.pagination.pages
      ) {
        setCurrentPage(response.pagination.pages);
      }
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Campaigns could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    debouncedSearch,
    filters.createdFrom,
    filters.createdTo,
    filters.startDate,
    filters.status,
    itemsPerPage,
  ]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const handleCampaignClick = (campaign: Campaign) => {
    router.push(`/campaigns/whatsapp/${campaign.id}`);
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const handleCreateSuccess = () => {
    loadCampaigns();
    setEditCampaignId(undefined);
  };

  const handleEditClick = (campaign: Campaign) => {
    setEditCampaignId(Number(campaign.id));
    setIsModalOpen(true);
  };

  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setEditCampaignId(undefined);
    }
  };

  if (loading) {
    return <TablePageSkeleton filters={2} />;
  }

  return (
    <PageShell gap="tight">
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
      {!loadError && totalCount === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No WhatsApp campaigns yet.{" "}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="text-primary transition-colors hover:text-info"
          >
            Create your first campaign
          </button>
          .
        </div>
      ) : null}
      {!loadError ? (
        <CampaignTable
          campaigns={campaigns}
          title="WhatsApp Campaigns"
          subtitle="Message campaigns you have sent or scheduled on WhatsApp."
          searchQuery={searchQuery}
          filters={filters}
          channelFilter={"WhatsApp"}
          statusOptions={[
            { value: "Draft", label: "Draft" },
            { value: "Pending", label: "Pending" },
            { value: "Sending", label: "Sending" },
            { value: "Sent", label: "Sent" },
            { value: "Failed", label: "Failed" },
            { value: "Active", label: "Active" },
          ]}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
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
    </PageShell>
  );
}
