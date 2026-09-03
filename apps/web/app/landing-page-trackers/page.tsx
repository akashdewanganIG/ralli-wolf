"use client";

import { DataTable, TableColumn } from "@/components/data-table";
import { RoleGuard } from "@/components/guards/role-guard";
import { TablePageSkeleton } from "@/components/skeletons";
import { landingPageCampaignService } from "@/lib/api/services";
import { LandingPageCampaign } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import { Button, DeleteConfirmationDialog, Input, Label } from "@repo/ui";
import { Alert } from "@repo/ui/components/ui/alert";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { PageHeader } from "@repo/ui/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { SearchFilterToolbar } from "@repo/ui/components/ui/toolbar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { ChartColumnIcon, Check, Copy, Plus } from "@repo/ui/icons";
import { useEffect, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@/components/data-table";
import { Tag } from "@repo/ui/components/ui/tag";
import { PageShell } from "@repo/ui/components/ui/page-shell";

export default function LandingPageTrackersPage() {
  const [trackers, setTrackers] = useState<LandingPageCampaign[]>([]);
  const [stats, setStats] = useState<{
    activeTrackers: number;
    totalTrackers: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTracker, setSelectedTracker] =
    useState<LandingPageCampaign | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    status: "ACTIVE" | "PAUSED" | "SCHEDULED" | "CLOSED" | "ARCHIVED";
  }>({
    name: "",
    description: "",
    status: "ACTIVE",
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchTrackers();
    fetchStats();
  }, [currentPage, itemsPerPage, searchQuery, statusFilter]);

  const fetchTrackers = async () => {
    try {
      setLoading(true);
      const response = await landingPageCampaignService.getAllCampaigns({
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      setTrackers(response.campaigns);
      setTotalCount(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch (err: any) {
      setError(err.message || "Failed to load trackers");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await landingPageCampaignService.getStats();
      setStats({
        activeTrackers: response.activeCampaigns,
        totalTrackers: response.totalCampaigns,
      });
    } catch (err) {
      toast.error(err, "Failed to load tracker statistics");
    }
  };

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await landingPageCampaignService.createCampaign(formData);
      setIsCreateModalOpen(false);
      setFormData({ name: "", description: "", status: "ACTIVE" });
      fetchTrackers();
      fetchStats();
    } catch (err: any) {
      setError(err.message || "Failed to create tracker");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTracker) return;
    try {
      setDeleting(true);
      await landingPageCampaignService.deleteCampaign(selectedTracker.id);
      setIsDeleteDialogOpen(false);
      setIsEditModalOpen(false);
      setSelectedTracker(null);
      await Promise.all([fetchTrackers(), fetchStats()]);
      toast.success("Tracker deleted successfully");
    } catch (err) {
      toast.error(err, "Failed to delete tracker");
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedTracker) return;
    try {
      setSubmitting(true);
      await landingPageCampaignService.updateCampaign(
        selectedTracker.id,
        formData
      );
      setIsEditModalOpen(false);
      setSelectedTracker(null);
      setFormData({ name: "", description: "", status: "ACTIVE" });
      fetchTrackers();
      fetchStats();
    } catch (err: any) {
      setError(err.message || "Failed to update tracker");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyUniqueId = async (uniqueId: string) => {
    try {
      await navigator.clipboard.writeText(uniqueId);
      setCopiedId(uniqueId);
      toast.success("Tracker ID copied");
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error(error, "Unable to copy tracker ID");
    }
  };

  const openEditModal = (tracker: LandingPageCampaign) => {
    setSelectedTracker(tracker);
    setFormData({
      name: tracker.name,
      description: tracker.description || "",
      status: tracker.status,
    });
    setIsEditModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      { tone: React.ComponentProps<typeof Tag>["tone"]; label: string }
    > = {
      ACTIVE: {
        tone: "active" as const,
        label: "Active",
      },
      PAUSED: {
        tone: "pending" as const,
        label: "Paused",
      },
      SCHEDULED: {
        tone: "progress" as const,
        label: "Scheduled",
      },
      CLOSED: {
        tone: "neutral" as const,
        label: "Closed",
      },
      ARCHIVED: {
        tone: "danger" as const,
        label: "Archived",
      },
    };
    const variant = variants[status] ?? variants.ACTIVE;
    return <Tag tone={variant!.tone}>{variant!.label}</Tag>;
  };

  const columns: TableColumn<LandingPageCampaign>[] = [
    {
      key: "name",
      label: "Tracker Name",
      render: (_, tracker) => (
        <div className="flex items-center gap-2 py-2">
          <span className="text-muted-foreground hover:text-info">
            {tracker.name}
          </span>
        </div>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (_, tracker) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-sm text-muted-foreground truncate max-w-xs cursor-help">
                {tracker.description || "No description"}
              </div>
            </TooltipTrigger>
            {tracker.description && (
              <TooltipContent className="max-w-sm">
                <p>{tracker.description}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      ),
    },
    {
      key: "uniqueId",
      label: "Unique ID",
      render: (_, tracker) => (
        <div className="flex items-center gap-2">
          <code className="text-xs bg-surface-secondary px-2 py-1 rounded">
            {tracker.uniqueId.substring(0, 12)}...
          </code>
          <Button
            variant="ghost"
            onClick={e => {
              e.stopPropagation();
              handleCopyUniqueId(tracker.uniqueId);
            }}
          >
            {copiedId === tracker.uniqueId ? (
              <Check className="h-4 w-4 text-success-foreground" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (_, tracker) => getStatusBadge(tracker.status),
    },
    {
      key: "createdAt",
      label: "Created",
      render: (_, tracker) => (
        <div className="text-sm text-text-secondary">
          {new Date(tracker.createdAt).toLocaleDateString()}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <RoleGuard allowedRoles={["ADMIN"]}>
        <TablePageSkeleton filters={1} rows={7} />
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <PageShell>
        <PageHeader
          title="Landing page trackers"
          description="See which landing page each enquiry came from, so you know what is working."
          actions={
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="size-4" />
              Create tracker
            </Button>
          }
        />

        {error && (
          <Alert
            tone="error"
            title="Unable to load trackers"
            action={
              <Button variant="outline" onClick={() => setError(null)}>
                Dismiss
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-secondary">
                      Active Landing Pages
                    </p>
                    <p className="text-3xl font-bold mt-2">
                      {stats.activeTrackers}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/15 bg-primary/[0.06]">
                    <span className="text-2xl">
                      <Check className="h-4 w-4 text-primary" />
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-secondary">
                      Total Landing Pages
                    </p>
                    <p className="text-xs text-muted-foreground">
                      (non-archived)
                    </p>
                    <p className="text-3xl font-bold mt-2">
                      {stats.totalTrackers}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-subtle">
                    <span className="text-2xl">
                      <ChartColumnIcon className="h-4 w-4 text-foreground/70" />
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <SearchFilterToolbar
          search={
            <Input
              placeholder="Search trackers..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full"
            />
          }
          filters={
            <Select
              value={statusFilter}
              onValueChange={value => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PAUSED">Paused</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          }
        />

        <DataTable
          data={trackers}
          columns={columns}
          title="Trackers"
          count={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={value => {
            setItemsPerPage(value);
            setCurrentPage(1);
          }}
          onNameClick={openEditModal}
          columnPreferenceKey="landing-page-trackers-table"
        />

        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="gap-0 overflow-hidden">
            <DialogHeader>
              <DialogTitle>Create Landing Page Tracker</DialogTitle>
              <DialogDescription>
                Create a new tracker to track leads from your landing pages.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3">
              <div>
                <Label htmlFor="name">Tracker Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter tracker name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={e =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Enter tracker description"
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PAUSED">Paused</SelectItem>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={submitting || !formData.name}
              >
                {submitting ? "Creating..." : "Create Tracker"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="gap-0 overflow-hidden">
            <DialogHeader>
              <DialogTitle>Edit Landing Page Tracker</DialogTitle>
              <DialogDescription>
                Update tracker details. The Unique ID cannot be changed.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              {selectedTracker && (
                <div className="space-y-3">
                  <div>
                    <Label>Unique ID</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-sm bg-surface-secondary px-3 py-2 rounded">
                        {selectedTracker.uniqueId}
                      </code>
                      <Button
                        variant="outline"
                        onClick={() =>
                          handleCopyUniqueId(selectedTracker.uniqueId)
                        }
                      >
                        {copiedId === selectedTracker.uniqueId ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use this ID in your landing page forms as a hidden field
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="edit-name">Tracker Name *</Label>
                    <Input
                      id="edit-name"
                      value={formData.name}
                      onChange={e =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-description">Description</Label>
                    <Input
                      id="edit-description"
                      value={formData.description}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: any) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="PAUSED">Paused</SelectItem>
                        <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                        <SelectItem value="ARCHIVED">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button
                variant="destructive"
                className="mr-auto"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={submitting || deleting}
              >
                Delete
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={submitting || !formData.name}
              >
                {submitting ? "Updating..." : "Update Tracker"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DeleteConfirmationDialog
          open={isDeleteDialogOpen && !!selectedTracker}
          onOpenChange={setIsDeleteDialogOpen}
          onConfirm={handleDelete}
          itemName={selectedTracker?.name || "this tracker"}
          itemType="campaign"
          isLoading={deleting}
          disabled={deleting}
        />
      </PageShell>
    </RoleGuard>
  );
}
