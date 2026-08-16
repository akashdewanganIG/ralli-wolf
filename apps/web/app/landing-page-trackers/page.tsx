"use client";

import { DataTable, TableColumn } from "@/components/data-table";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { TablePageSkeleton } from "@/components/skeletons";
import { useAuth } from "@/contexts/AuthContext";
import { landingPageCampaignService } from "@/lib/api/services";
import { LandingPageCampaign } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import { Button, Input, Label } from "@repo/ui";
import { Alert } from "@repo/ui/components/ui/alert";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import {
  Dialog,
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
import { ChartColumnIcon, Check, Copy, Plus } from "lucide-react";
import { useEffect, useState } from "react";

export default function LandingPageTrackersPage() {
  const { user } = useAuth();
  const [trackers, setTrackers] = useState<LandingPageCampaign[]>([]);
  const [stats, setStats] = useState<{
    activeTrackers: number;
    totalTrackers: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination and filters
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTracker, setSelectedTracker] =
    useState<LandingPageCampaign | null>(null);

  // Form states
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
      console.error("Failed to fetch stats", err);
    }
  };

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await landingPageCampaignService.createCampaign({
        ...formData,
        createdBy: user?.id,
      });
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
    const variants: Record<string, { color: string; label: string }> = {
      ACTIVE: { color: "bg-green-100 text-green-800", label: "Active" },
      PAUSED: { color: "bg-indigo-100 text-yellow-800", label: "Paused" },
      SCHEDULED: { color: "bg-blue-100 text-blue-800", label: "Scheduled" },
      CLOSED: { color: "bg-gray-100 text-gray-800", label: "Closed" },
      ARCHIVED: { color: "bg-red-100 text-red-800", label: "Archived" },
    };
    const variant = variants[status] ?? variants.ACTIVE;
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${variant!.color}`}
      >
        {variant!.label}
      </span>
    );
  };

  const columns: TableColumn<LandingPageCampaign>[] = [
    {
      key: "name",
      label: "Tracker Name",
      render: (_, tracker) => (
        <div className="flex items-center gap-2 py-2">
          <span className="text-muted-foreground hover:underline hover:text-blue-400">
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
              <div className="text-sm text-gray-500 truncate max-w-xs cursor-help">
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
          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
            {tracker.uniqueId.substring(0, 12)}...
          </code>
          <Button
            size="sm"
            variant="ghost"
            onClick={e => {
              e.stopPropagation();
              handleCopyUniqueId(tracker.uniqueId);
            }}
          >
            {copiedId === tracker.uniqueId ? (
              <Check className="h-4 w-4 text-green-600" />
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
        <div className="text-sm text-gray-600">
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
      <div className="app-page space-y-5">
        <PageHeader
          title="Landing page trackers"
          description="Manage landing-page trackers and the enquiries attributed to them."
          actions={
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="size-4" />
              Create tracker
            </Button>
          }
        />

        {/* Error Message */}
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

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
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
                    <p className="text-sm text-gray-600">Total Landing Pages</p>
                    <p className="text-xs text-gray-500">(non-archived)</p>
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

        {/* Filters */}
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

        {/* Data Table */}
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

        {/* Create Tracker Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Landing Page Tracker</DialogTitle>
              <DialogDescription>
                Create a new tracker to track leads from your landing pages.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
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
            </div>
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

        {/* Edit Tracker Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Landing Page Tracker</DialogTitle>
              <DialogDescription>
                Update tracker details. The Unique ID cannot be changed.
              </DialogDescription>
            </DialogHeader>
            {selectedTracker && (
              <div className="space-y-4 py-4">
                <div>
                  <Label>Unique ID</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 text-sm bg-gray-100 px-3 py-2 rounded">
                      {selectedTracker.uniqueId}
                    </code>
                    <Button
                      size="sm"
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
                  <p className="text-xs text-gray-500 mt-1">
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
                      setFormData({ ...formData, description: e.target.value })
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
            <DialogFooter>
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

        {/* Delete Confirmation Modal */}
        {/* TODO: Add delete confirmation modal */}
      </div>
    </RoleGuard>
  );
}
