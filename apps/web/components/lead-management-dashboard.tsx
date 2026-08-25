"use client";

import { toast } from "@/lib/toast";
import { CONTROL_HEIGHT } from "@repo/ui/components/ui/form-control";
import { ConvertConfirmationDialog, DeleteConfirmationDialog } from "@repo/ui";
import { Button } from "@repo/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Download, Plus } from "@repo/ui/icons";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLeadManagementContext } from "../contexts/LeadManagementContext";
import {
  useAccountsWithPagination,
  useDeleteAccount,
} from "../hooks/useAccounts";
import { useSyncLeadsToBrevo } from "../hooks/useBrevo";
import {
  useContactsWithPagination,
  useDeleteContact,
} from "../hooks/useContacts";
import {
  useAssignLeadsBulk,
  useAssignmentStats,
  useConvertLeadsBulk,
  useDeleteLead,
  useLeadsWithPagination,
} from "../hooks/useLeads";
import { useSearchAccounts } from "../hooks/useSearchAccounts";
import { useSearchAllContacts } from "../hooks/useSearchAllContacts";
import { useSearchLeads } from "../hooks/useSearchLeads";
import { useUsers } from "../hooks/useUsers";
import type {
  Account,
  LeadAssignmentStats,
  LeadFilters,
} from "../lib/api/types";
import { getLeadFullName } from "../lib/name";
import { AccountTable } from "./account-table";
import AddLeadModal from "./AddLeadModal";
import { AssignLeadsModal } from "./assign-leads-modal";
import { ContactTable } from "./contact-table";
import { ImportLeadsModal } from "./ImportLeadsModal";
import { LeadSearchInput } from "./lead-search-input";
import { LeadTable } from "./lead-table";
import { SelectedLeadsActions } from "./selected-leads-actions";
import { SendLeadsEmailModal } from "./SendLeadsEmailModal";
import {
  StatGridSkeleton,
  SummaryCardSkeleton,
  TableSkeleton,
} from "./skeletons";
import { buttonVariants } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { DashboardToolbar } from "@repo/ui/components/ui/dashboard-toolbar";
import { Tag } from "@repo/ui/components/ui/tag";
import { PageShell } from "@repo/ui/components/ui/page-shell";
import { DataTransfer } from "@/components/data-transfer/DataTransfer";
import { useQueryClient } from "@tanstack/react-query";

const REGION_LABELS: Record<string, string> = {
  SOUTH: "South",
  NORTH: "North",
  EAST: "East",
  WEST_1: "West 1",
  WEST_2: "West 2",
  APTOC: "APTOC",
};

const formatRegionLabel = (region?: string): string => {
  if (!region) return "Unassigned";
  return REGION_LABELS[region] || region;
};

type AssignmentSummary = {
  label: string;
  regionLabel?: string;
  totalLeads: number;
  totalConverted: number;
  totalRemaining: number;
  conversionRate: number;
};

const EMPTY_ASSIGNMENT_METRICS = {
  totalLeads: 0,
  totalConverted: 0,
  totalRemaining: 0,
  conversionRate: 0,
};

const calculateSummaryFromStat = (stat?: LeadAssignmentStats | null) => {
  if (!stat) {
    return { ...EMPTY_ASSIGNMENT_METRICS };
  }
  const totalLeads = stat.totalLeads ?? 0;
  const totalConverted = stat.totalConverted ?? 0;
  const totalRemaining = stat.totalRemaining ?? 0;
  const conversionRate =
    typeof stat.conversionRate === "number"
      ? stat.conversionRate
      : totalLeads > 0
        ? (totalConverted / totalLeads) * 100
        : 0;
  return {
    totalLeads,
    totalConverted,
    totalRemaining,
    conversionRate,
  };
};

const aggregateAssignmentStats = (stats: LeadAssignmentStats[]) => {
  if (!stats || stats.length === 0) {
    return { ...EMPTY_ASSIGNMENT_METRICS };
  }
  const totals = stats.reduce(
    (acc, stat) => {
      acc.totalLeads += stat.totalLeads ?? 0;
      acc.totalConverted += stat.totalConverted ?? 0;
      acc.totalRemaining += stat.totalRemaining ?? 0;
      return acc;
    },
    { totalLeads: 0, totalConverted: 0, totalRemaining: 0 }
  );
  const conversionRate =
    totals.totalLeads > 0
      ? (totals.totalConverted / totals.totalLeads) * 100
      : 0;
  return {
    totalLeads: totals.totalLeads,
    totalConverted: totals.totalConverted,
    totalRemaining: totals.totalRemaining,
    conversionRate,
  };
};

export const LeadManagementDashboard: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const userRole = String(user?.role || "");
  const isAdminUser = userRole === "ADMIN";
  const mapLeadForTable = React.useCallback(
    (item: any) => ({
      id: item.id?.toString(),
      firstName: item.firstName,
      lastName: item.lastName,
      name: getLeadFullName(item.firstName, item.lastName),
      email: item.email,
      phone: item.phone || "",
      countryCode: item.countryCode,
      source: item.source,
      status: item.status || "OPEN",
      createdAt: item.createdAt,
      assignedAt: item.assignedAt,
      owner: item.owner
        ? {
            id: item.owner.id,
            firstName: item.owner.firstName,
            lastName: item.owner.lastName,
            email: item.owner.email,
            region: item.owner.region,
          }
        : undefined,
    }),
    []
  );

  // Use context for state management
  const {
    activeTab,
    leadSearchQuery,
    assignedLeadsSearchQuery,
    unassignedLeadsSearchQuery,
    accountsSearchQuery,
    contactsSearchQuery,
    statusFilter,
    sourceFilter,
    createdFrom,
    createdTo,
    keywordIds,
    currentPage,
    itemsPerPage,
    setLeadSearchQuery,
    setAssignedLeadsSearchQuery,
    setUnassignedLeadsSearchQuery,
    setAccountsSearchQuery,
    setContactsSearchQuery,
    setStatusFilter,
    setSourceFilter,
    setCreatedFrom,
    setCreatedTo,
    setKeywordIds,
    setCurrentPage,
    setItemsPerPage,
    selectedSalesUserId,
    setSelectedSalesUserId,
    selectedSalesRegion,
    setSelectedSalesRegion,
  } = useLeadManagementContext();

  /** Which dataset the visible tab is showing, for import and export. */
  const transferEntity =
    activeTab === "accounts"
      ? "accounts"
      : activeTab === "contacts"
        ? "contacts"
        : "leads";

  /**
   * Pull the visible list again after an import.
   *
   * The queries here are keyed per tab, so invalidating the whole lead
   * namespace is both correct and simpler than naming the one in view.
   */
  const queryClient = useQueryClient();
  const refetchCurrent = () =>
    queryClient.invalidateQueries({ queryKey: ["leads"] });

  // Selection state (not in URL)
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [showBulkConvertDialog, setShowBulkConvertDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkAccountsDeleteDialog, setShowBulkAccountsDeleteDialog] =
    useState(false);
  const [showBulkContactsDeleteDialog, setShowBulkContactsDeleteDialog] =
    useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showSendLeadsEmailModal, setShowSendLeadsEmailModal] = useState(false);
  const { data: salesUsersResponse, isLoading: salesUsersLoading } = useUsers(
    { role: "SALES" },
    { enabled: isAdminUser }
  );
  const salesUsers = salesUsersResponse?.data || [];
  const { data: assignmentStats = [], isLoading: assignmentStatsLoading } =
    useAssignmentStats({ enabled: !!user });

  const salesRegions = useMemo(() => {
    if (!salesUsers.length) return [];
    const uniqueRegions = new Set<string>();
    salesUsers.forEach(user => {
      if (user.region) uniqueRegions.add(user.region);
    });
    return Array.from(uniqueRegions);
  }, [salesUsers]);

  useEffect(() => {
    if (!isAdminUser) {
      if (selectedSalesUserId !== "all") {
        setSelectedSalesUserId("all");
      }
      if (selectedSalesRegion !== "all") {
        setSelectedSalesRegion("all");
      }
    }
  }, [
    isAdminUser,
    selectedSalesUserId,
    selectedSalesRegion,
    setSelectedSalesRegion,
    setSelectedSalesUserId,
  ]);

  // Search functionality - only call the relevant search hook based on active tab
  const { data: leadSearchResults = [], isLoading: isSearchingLeads } =
    useSearchLeads(leadSearchQuery, {
      debounceMs: 500,
      enabled: activeTab === "lead-master",
    });

  const {
    data: assignedLeadsSearchResults = [],
    isLoading: isSearchingMyLeads,
  } = useSearchLeads(assignedLeadsSearchQuery, {
    debounceMs: 500,
    enabled: activeTab === "assigned",
  });

  const {
    data: unassignedLeadsSearchResults = [],
    isLoading: isSearchingUnassignedLeads,
  } = useSearchLeads(unassignedLeadsSearchQuery, {
    debounceMs: 500,
    enabled: activeTab === "unassigned-leads",
  });

  // Account search functionality - only when on accounts tab
  const {
    data: accountSearchResults = [],
    isLoading: isSearchingAccounts,
    isSearching: isSearchingAccountsActive,
  } = useSearchAccounts(accountsSearchQuery, {
    debounceMs: 500,
    enabled: activeTab === "accounts",
  });

  // Contact search functionality - only when on contacts tab
  const {
    data: contactSearchResults = [],
    isLoading: isSearchingContacts,
    isSearching: isSearchingContactsActive,
  } = useSearchAllContacts(contactsSearchQuery, {
    debounceMs: 500,
    enabled: activeTab === "contacts",
  });

  // Lazy load data based on active tab
  // Lead Master tab - paginated leads
  const tableFilters = React.useMemo(
    () => ({
      status: statusFilter,
      source: sourceFilter,
      createdFrom,
      createdTo,
      keywordIds,
    }),
    [statusFilter, sourceFilter, createdFrom, createdTo, keywordIds]
  );

  const apiFilterParams = React.useMemo(
    () => ({
      status: statusFilter || undefined,
      source: sourceFilter || undefined,
      createdFrom: createdFrom?.toISOString() || undefined,
      createdTo: createdTo?.toISOString() || undefined,
      keywordIds: keywordIds.length > 0 ? keywordIds : undefined,
    }),
    [statusFilter, sourceFilter, createdFrom, createdTo, keywordIds]
  );

  const leadFilters = {
    page: currentPage,
    limit: itemsPerPage,
    ...apiFilterParams,
  };

  const {
    data: leads = [],
    pagination,
    isLoading: leadsLoading,
    error: leadsError,
  } = useLeadsWithPagination(leadFilters, {
    enabled: activeTab === "lead-master" && !leadSearchQuery,
  });

  // Assigned tab - all assigned leads with optional filters
  const ownerId = typeof user?.id === "number" ? user.id : undefined;
  const parsedSelectedSalesUserId =
    selectedSalesUserId !== "all" ? Number(selectedSalesUserId) : undefined;
  const hasSelectedSalesUser =
    typeof parsedSelectedSalesUserId === "number" &&
    !Number.isNaN(parsedSelectedSalesUserId);
  const selectedSalesUser = useMemo(() => {
    if (!isAdminUser || !hasSelectedSalesUser) return undefined;
    return salesUsers.find(user => user.id === parsedSelectedSalesUserId);
  }, [
    hasSelectedSalesUser,
    isAdminUser,
    parsedSelectedSalesUserId,
    salesUsers,
  ]);
  const assignedFilterChips = useMemo(() => {
    if (!isAdminUser) return [];
    const chips: { key: string; label: string; onClear?: () => void }[] = [];
    if (hasSelectedSalesUser) {
      const labelName =
        [selectedSalesUser?.firstName, selectedSalesUser?.lastName]
          .filter(Boolean)
          .join(" ") ||
        selectedSalesUser?.email ||
        (parsedSelectedSalesUserId
          ? `User ${parsedSelectedSalesUserId}`
          : "Sales User");
      chips.push({
        key: "sales-user",
        label: `Sales: ${labelName}`,
        onClear: () => setSelectedSalesUserId("all"),
      });
    }
    if (selectedSalesRegion !== "all") {
      chips.push({
        key: "sales-region",
        label: `Region: ${formatRegionLabel(selectedSalesRegion)}`,
        onClear: () => setSelectedSalesRegion("all"),
      });
    }
    return chips;
  }, [
    hasSelectedSalesUser,
    isAdminUser,
    parsedSelectedSalesUserId,
    selectedSalesRegion,
    selectedSalesUser,
    setSelectedSalesRegion,
    setSelectedSalesUserId,
  ]);
  const assignedSearchPlaceholder = useMemo(() => {
    if (!assignedFilterChips.length) {
      return "Search assigned leads...";
    }
    const chipText = assignedFilterChips.map(chip => chip.label).join(" • ");
    return `Search assigned leads (${chipText})`;
  }, [assignedFilterChips]);

  const assignedLeadFilters = useMemo(() => {
    const filters: LeadFilters & { page?: number; limit?: number } = {
      page: currentPage,
      limit: itemsPerPage,
      assigned: true,
      ...apiFilterParams,
    };

    if (isAdminUser && hasSelectedSalesUser) {
      filters.ownerId = parsedSelectedSalesUserId;
    } else if (!isAdminUser && typeof ownerId === "number") {
      filters.ownerId = ownerId;
    }

    if (isAdminUser && selectedSalesRegion !== "all") {
      filters.ownerRegion = selectedSalesRegion;
    }

    return filters;
  }, [
    currentPage,
    itemsPerPage,
    isAdminUser,
    parsedSelectedSalesUserId,
    selectedSalesRegion,
    ownerId,
    apiFilterParams,
  ]);

  const {
    data: assignedLeads = [],
    pagination: assignedPagination,
    isLoading: assignedLoading,
    error: assignedError,
  } = useLeadsWithPagination(assignedLeadFilters, {
    enabled: activeTab === "assigned" && !assignedLeadsSearchQuery,
  });
  const assignmentStatsByUser = useMemo(() => {
    const map = new Map<number, LeadAssignmentStats>();
    (assignmentStats || []).forEach(stat => {
      if (typeof stat?.userId === "number") {
        map.set(stat.userId, stat);
      }
    });
    return map;
  }, [assignmentStats]);
  const selectedAssigneeSummary = useMemo<AssignmentSummary | null>(() => {
    if (isAdminUser) {
      if (hasSelectedSalesUser && parsedSelectedSalesUserId) {
        const metrics = calculateSummaryFromStat(
          assignmentStatsByUser.get(parsedSelectedSalesUserId)
        );
        const label =
          [selectedSalesUser?.firstName, selectedSalesUser?.lastName]
            .filter(Boolean)
            .join(" ") ||
          selectedSalesUser?.email ||
          `User ${parsedSelectedSalesUserId}`;
        const regionLabel = selectedSalesUser?.region
          ? formatRegionLabel(selectedSalesUser.region)
          : undefined;
        return {
          label,
          regionLabel,
          ...metrics,
        };
      }
      if (selectedSalesRegion !== "all") {
        const regionUserIds = new Set(
          salesUsers
            .filter(user => user.region === selectedSalesRegion)
            .map(user => user.id)
        );
        const regionStats = assignmentStats.filter(stat =>
          regionUserIds.has(stat.userId)
        );
        const metrics = aggregateAssignmentStats(regionStats);
        return {
          label: `${formatRegionLabel(selectedSalesRegion)} Region`,
          regionLabel: formatRegionLabel(selectedSalesRegion),
          ...metrics,
        };
      }
      return {
        label: "All Sales Users",
        ...aggregateAssignmentStats(assignmentStats),
      };
    }
    if (typeof ownerId === "number") {
      const metrics = calculateSummaryFromStat(
        assignmentStatsByUser.get(ownerId)
      );
      const regionLabel = (user as any)?.region
        ? formatRegionLabel((user as any)?.region)
        : undefined;
      return {
        label:
          [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
          "My Stats",
        regionLabel,
        ...metrics,
      };
    }
    return null;
  }, [
    assignmentStats,
    assignmentStatsByUser,
    hasSelectedSalesUser,
    isAdminUser,
    ownerId,
    parsedSelectedSalesUserId,
    salesUsers,
    selectedSalesRegion,
    selectedSalesUser,
    user,
  ]);

  // Unassigned Leads tab - filtered leads (new leads)
  const unassignedLeadFilters = useMemo(
    () => ({
      page: currentPage,
      limit: itemsPerPage,
      unassigned: true,
      ...apiFilterParams,
    }),
    [currentPage, itemsPerPage, apiFilterParams]
  );

  const {
    data: unassignedLeads = [],
    pagination: unassignedPagination,
    isLoading: unassignedLoading,
    error: unassignedError,
  } = useLeadsWithPagination(unassignedLeadFilters, {
    enabled: activeTab === "unassigned-leads",
  });

  // Contacts tab
  const {
    data: contacts = [],
    pagination: contactsPagination,
    isLoading: contactsLoading,
    error: contactsError,
  } = useContactsWithPagination(
    {
      page: currentPage,
      limit: itemsPerPage,
    },
    { enabled: activeTab === "contacts" }
  );

  // API hooks for accounts
  const {
    data: accounts = [],
    pagination: accountsPagination,
    isLoading: accountsLoading,
    error: accountsError,
  } = useAccountsWithPagination(
    {
      page: currentPage,
      limit: itemsPerPage,
    },
    { enabled: activeTab === "accounts" }
  );
  // Mutation hooks
  const deleteLeadMutation = useDeleteLead();
  const assignLeadsBulkMutation = useAssignLeadsBulk();
  const convertLeadsBulkMutation = useConvertLeadsBulk();
  const syncLeadsToBrevoMutation = useSyncLeadsToBrevo();
  const deleteAccountMutation = useDeleteAccount();
  const deleteContactMutation = useDeleteContact();

  // Note: Client-side filtering removed to support pagination
  // Filtering can be added back as server-side filtering if needed

  // Bulk action handlers
  const handleBulkConvert = async () => {
    if (selectedLeads.length === 0) return;
    setShowBulkConvertDialog(true);
  };

  const handleBulkConvertConfirm = async () => {
    try {
      const leads = selectedLeads.map(id => ({ leadId: parseInt(id) }));
      await convertLeadsBulkMutation.mutateAsync(leads);
      setSelectedLeads([]);
    } catch (error) {
      console.error("Failed to convert leads:", error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) return;
    setShowBulkDeleteDialog(true);
  };

  const handleBulkDeleteConfirm = async () => {
    try {
      // Delete leads one by one since there's no bulk delete API
      for (const leadId of selectedLeads) {
        await deleteLeadMutation.mutateAsync(parseInt(leadId));
      }
      setSelectedLeads([]);
      setShowBulkDeleteDialog(false);
      toast.success(`${selectedLeads.length} leads deleted successfully!`);
    } catch (error) {
      console.error("Failed to delete leads:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to delete leads: ${errorMessage}`);
    }
  };

  // Bulk action handlers for Accounts
  const handleBulkAccountsDelete = async () => {
    if (selectedAccounts.length === 0) return;
    setShowBulkAccountsDeleteDialog(true);
  };

  const handleBulkAccountsDeleteConfirm = async () => {
    try {
      // Delete accounts one by one since there's no bulk delete API
      for (const accountId of selectedAccounts) {
        await deleteAccountMutation.mutateAsync(parseInt(accountId));
      }
      setSelectedAccounts([]);
      setShowBulkAccountsDeleteDialog(false);
      toast.success(
        `${selectedAccounts.length} accounts deleted successfully!`
      );
    } catch (error) {
      console.error("Failed to delete accounts:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to delete accounts: ${errorMessage}`);
    }
  };

  const handleBulkAccountsExport = () => {
    console.log("Export selected accounts:", selectedAccounts);
  };

  // Bulk action handlers for Contacts
  const handleBulkContactsDelete = async () => {
    if (selectedContacts.length === 0) return;
    setShowBulkContactsDeleteDialog(true);
  };

  const handleBulkContactsDeleteConfirm = async () => {
    try {
      // Delete contacts one by one since there's no bulk delete API
      for (const contactId of selectedContacts) {
        await deleteContactMutation.mutateAsync(parseInt(contactId));
      }
      setSelectedContacts([]);
      setShowBulkContactsDeleteDialog(false);
      toast.success(
        `${selectedContacts.length} contacts deleted successfully!`
      );
    } catch (error) {
      console.error("Failed to delete contacts:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to delete contacts: ${errorMessage}`);
    }
  };

  const handleBulkContactsExport = () => {
    console.log("Export selected contacts:", selectedContacts);
  };

  const handleBulkEmail = async () => {
    if (selectedLeads.length === 0) {
      toast.error("Please select at least one lead to sync");
      return;
    }

    let loadingToastId: string | number | undefined;
    try {
      loadingToastId = toast.loading(
        `Syncing ${selectedLeads.length} leads to email...`
      );

      const response = await syncLeadsToBrevoMutation.mutateAsync(
        selectedLeads.map(id => parseInt(id))
      );

      // Dismiss loading toast before showing result
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
      }

      // Show success message with summary
      if (response.summary.failed === 0) {
        toast.success(
          `Successfully synced all ${response.summary.successful} leads to email!`
        );
      } else {
        toast.warning(
          `Synced ${response.summary.successful} leads to email. ${response.summary.failed} failed.`,
          {
            description:
              response.failed.length > 0
                ? `Failed: ${response.failed.map(f => f.email).join(", ")}`
                : undefined,
          }
        );
      }

      // Clear selection after successful sync
      setSelectedLeads([]);
    } catch (error) {
      // Dismiss loading toast before showing error
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
      }
      console.error("Failed to sync leads to email:", error);
      toast.error(
        `Failed to sync leads to email: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const handleKeywordIdsFilterRemove = () => {
    setKeywordIds([]);
  };

  const handleBulkAssignModal = () => {
    setShowAssignDialog(true);
  };

  const handleAssignConfirm = async (salesPersonId: number) => {
    try {
      await assignLeadsBulkMutation.mutateAsync({
        userId: salesPersonId,
        leadIds: selectedLeads.map(id => parseInt(id)),
      });
      toast.success(
        `Successfully assigned ${selectedLeads.length} lead${selectedLeads.length > 1 ? "s" : ""} to user`
      );
      setSelectedLeads([]);
      setShowAssignDialog(false);
    } catch (error) {
      console.error("Failed to assign leads:", error);
      toast.error("Failed to assign leads. Please try again.");
    }
  };

  const handleSalesUserFilterChange = (value: string) => {
    setSelectedSalesUserId(value);
    setCurrentPage(1);
  };

  const handleSalesRegionFilterChange = (value: string) => {
    setSelectedSalesRegion(value);
    setCurrentPage(1);
  };

  const leadMatchesActiveFilters = React.useCallback(
    (lead: any) => {
      if (statusFilter && lead.status !== statusFilter) {
        return false;
      }

      if (sourceFilter && lead.source !== sourceFilter) {
        return false;
      }

      const createdAtDate = lead.createdAt ? new Date(lead.createdAt) : null;
      if (createdFrom) {
        if (!createdAtDate || createdAtDate < createdFrom) {
          return false;
        }
      }

      if (createdTo) {
        if (!createdAtDate || createdAtDate > createdTo) {
          return false;
        }
      }

      if (keywordIds.length > 0) {
        const leadKeywordIds = Array.isArray(lead.keywords)
          ? lead.keywords
              .map((keyword: any) => {
                if (typeof keyword === "number") return keyword;
                if (typeof keyword?.keywordId === "number")
                  return keyword.keywordId;
                if (typeof keyword?.keyword?.id === "number")
                  return keyword.keyword.id;
                return undefined;
              })
              .filter(
                (id: number | undefined): id is number => typeof id === "number"
              )
          : [];

        if (!keywordIds.some(id => leadKeywordIds.includes(id))) {
          return false;
        }
      }

      return true;
    },
    [statusFilter, sourceFilter, createdFrom, createdTo, keywordIds]
  );

  // Determine which data to display based on search state
  const getDisplayData = () => {
    if (leadSearchQuery && activeTab === "lead-master") {
      return {
        data: leadSearchResults,
        pagination: null,
        isLoading: isSearchingLeads,
        error: null,
        isSearchMode: true,
      };
    }

    if (assignedLeadsSearchQuery && activeTab === "assigned") {
      let filteredResults = assignedLeadsSearchResults.filter(
        lead => lead.ownerId != null
      );

      if (!isAdminUser) {
        filteredResults = filteredResults.filter(
          lead => lead.ownerId === user?.id
        );
      } else {
        if (hasSelectedSalesUser) {
          filteredResults = filteredResults.filter(
            lead => lead.ownerId === parsedSelectedSalesUserId
          );
        }
        if (selectedSalesRegion !== "all") {
          filteredResults = filteredResults.filter(
            lead => (lead as any)?.owner?.region === selectedSalesRegion
          );
        }
      }

      filteredResults = filteredResults.filter(leadMatchesActiveFilters);

      return {
        data: filteredResults,
        pagination: null,
        isLoading: isSearchingMyLeads,
        error: null,
        isSearchMode: true,
      };
    }

    if (unassignedLeadsSearchQuery && activeTab === "unassigned-leads") {
      // Filter for unassigned leads (ownerId is null)
      const filteredResults = unassignedLeadsSearchResults
        .filter(lead => lead.ownerId == null)
        .filter(leadMatchesActiveFilters);

      return {
        data: filteredResults,
        pagination: null,
        isLoading: isSearchingUnassignedLeads,
        error: null,
        isSearchMode: true,
      };
    }

    if (accountsSearchQuery && activeTab === "accounts") {
      return {
        data: accountSearchResults,
        pagination: null,
        isLoading: isSearchingAccounts,
        error: null,
        isSearchMode: true,
      };
    }

    if (contactsSearchQuery && activeTab === "contacts") {
      return {
        data: contactSearchResults,
        pagination: null,
        isLoading: isSearchingContacts,
        error: null,
        isSearchMode: true,
      };
    }

    switch (activeTab) {
      case "lead-master":
        return {
          data: leads,
          pagination,
          isLoading: leadsLoading,
          error: leadsError,
          isSearchMode: false,
        };
      case "assigned":
        return {
          data: assignedLeads,
          pagination: assignedPagination,
          isLoading: assignedLoading,
          error: assignedError,
          isSearchMode: false,
        };
      case "unassigned-leads":
        return {
          data: unassignedLeads,
          pagination: unassignedPagination,
          isLoading: unassignedLoading,
          error: unassignedError,
          isSearchMode: false,
        };
      case "accounts":
        return {
          data: accounts,
          pagination: accountsPagination,
          isLoading: accountsLoading,
          error: accountsError,
          isSearchMode: false,
        };
      case "contacts":
        return {
          data: contacts,
          pagination: contactsPagination,
          isLoading: contactsLoading,
          error: contactsError,
          isSearchMode: false,
        };
      default:
        return {
          data: [],
          pagination: null,
          isLoading: false,
          error: null,
          isSearchMode: false,
        };
    }
  };

  const currentData = getDisplayData();
  const totalPages = currentData.pagination?.totalPages || 1;

  console.log(
    "🎯 Dashboard state - Tab:",
    activeTab,
    "Page:",
    currentPage,
    "Total pages:",
    totalPages
  );

  const handlePageChange = (page: number) => {
    console.log(
      "📄 Page change requested:",
      page,
      "(current:",
      currentPage,
      ")"
    );
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage); // nuqs handles page reset automatically
  };

  const handleLeadClick = (lead: any) => {
    // Navigate to lead detail page
    router.push(`/leads/${lead.id}`);
  };

  const handleAccountClick = (account: any) => {
    // Navigate to account detail page
    router.push(`/accounts/${account.id}`);
  };

  const handleContactClick = (contact: any) => {
    // Navigate to contact detail page
    router.push(`/contacts/${contact.id}`);
  };

  // Determine error state based on active tab
  const getError = () => {
    switch (activeTab) {
      case "lead-master":
        return leadsError;
      case "assigned":
        return assignedError;
      case "unassigned-leads":
        return unassignedError;
      case "accounts":
        return accountsError;
      case "contacts":
        return contactsError;
      default:
        return null;
    }
  };

  const currentError = getError();

  // Error state
  if (currentError) {
    return (
      <div className="bg-background pb-4">
        <PageShell>
          <div className="rounded-xl border border-error/20 bg-error-surface px-5 py-10 text-center">
            <h2 className="mb-2 text-xl font-semibold text-error-foreground">
              Unable to load this workspace
            </h2>
            <p className="text-muted-foreground">
              {currentError?.message || "An error occurred while loading data"}
            </p>
          </div>
        </PageShell>
      </div>
    );
  }

  // Render content based on pathname
  const renderContent = () => {
    if (pathname.endsWith("/lead-master")) {
      return (
        <div className="space-y-4">
          {/* Lead Master Content */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <DataTransfer
                entity={transferEntity}
                allowImport={false}
                size="default"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowImportModal(true)}
              >
                <Download className="size-4" />
                Import
              </Button>
              <Button type="button" onClick={() => setShowAddLeadModal(true)}>
                <Plus className="size-4" />
                Add
              </Button>
            </div>
            {selectedLeads.length > 0 && (
              <SelectedLeadsActions
                count={selectedLeads.length}
                onSendToEmail={handleBulkEmail}
                onEmailExcel={() => setShowSendLeadsEmailModal(true)}
                onAssign={handleBulkAssignModal}
                onConvert={() => {}}
                onDelete={handleBulkDelete}
              />
            )}
            <LeadTable
              leads={currentData.data.map(mapLeadForTable)}
              title="Leads"
              search={
                <LeadSearchInput
                  value={leadSearchQuery}
                  onChange={setLeadSearchQuery}
                  placeholder="Search leads..."
                  isSearching={
                    currentData.isSearchMode ? isSearchingLeads : false
                  }
                  resultCount={
                    currentData.isSearchMode
                      ? currentData.data.length
                      : undefined
                  }
                  showResultCount={true}
                  className="w-full"
                />
              }
              onLeadClick={lead =>
                handleLeadClick(
                  currentData.data.find(l => l.id.toString() === lead.id)
                )
              }
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={
                currentData.pagination?.totalItems || currentData.data.length
              }
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
              showCheckboxes={true}
              selectedLeads={selectedLeads}
              onSelectionChange={setSelectedLeads}
              filters={tableFilters}
              onStatusChange={value => {
                setStatusFilter(value);
                setLeadSearchQuery("");
              }}
              onSourceChange={value => {
                setSourceFilter(value);
                setLeadSearchQuery("");
              }}
              onCreatedFromChange={value => {
                setCreatedFrom(value);
                setLeadSearchQuery("");
              }}
              onCreatedToChange={value => {
                setCreatedTo(value);
                setLeadSearchQuery("");
              }}
              onKeywordIdsChange={value => {
                setKeywordIds(value);
                setLeadSearchQuery("");
              }}
              onClearFilters={() => {
                setStatusFilter("");
                setSourceFilter("");
                setCreatedFrom(null);
                setCreatedTo(null);
                setKeywordIds([]);
              }}
              // onStatusFilterRemove={handleStatusFilterRemove}
              // onSourceFilterRemove={handleSourceFilterRemove}
              // onCreatedFromFilterRemove={handleCreatedFromFilterRemove}
              // onCreatedToFilterRemove={handleCreatedToFilterRemove}
              onKeywordIdsFilterRemove={handleKeywordIdsFilterRemove}
              searchQuery={leadSearchQuery}
              isSearchMode={currentData.isSearchMode}
              isLoading={currentData.isLoading}
            />
          </div>
        </div>
      );
    }

    if (pathname.endsWith("/assigned")) {
      return (
        <div className="space-y-4">
          {/* Assigned Leads Content */}
          <div className="space-y-3">
            <DashboardToolbar
              search={
                <LeadSearchInput
                  value={assignedLeadsSearchQuery}
                  onChange={setAssignedLeadsSearchQuery}
                  placeholder={assignedSearchPlaceholder}
                  isSearching={
                    currentData.isSearchMode ? isSearchingMyLeads : false
                  }
                  resultCount={
                    currentData.isSearchMode
                      ? currentData.data.length
                      : undefined
                  }
                  showResultCount={true}
                  className="w-full"
                />
              }
              actions={
                isAdminUser
                  ? [
                      <Select
                        key="sales-user"
                        value={selectedSalesUserId}
                        onValueChange={handleSalesUserFilterChange}
                        disabled={salesUsersLoading}
                      >
                        {/* Sized to its content rather than a fixed 16rem —
                            the old w-64 pair left a gap beside the search on
                            wide screens and forced a wrap on narrow ones. */}
                        <SelectTrigger className="w-full sm:w-44">
                          <SelectValue placeholder="Sales user" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All sales users</SelectItem>
                          {salesUsers.map(salesUser => (
                            <SelectItem
                              key={salesUser.id}
                              value={String(salesUser.id)}
                            >
                              {[salesUser.firstName, salesUser.lastName]
                                .filter(Boolean)
                                .join(" ") ||
                                salesUser.email ||
                                `User ${salesUser.id}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>,
                      <Select
                        key="region"
                        value={selectedSalesRegion}
                        onValueChange={handleSalesRegionFilterChange}
                        disabled={salesUsersLoading}
                      >
                        <SelectTrigger className="w-full sm:w-44">
                          <SelectValue placeholder="Region" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All regions</SelectItem>
                          {salesRegions.map(region => (
                            <SelectItem key={region} value={region}>
                              {formatRegionLabel(region)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>,
                    ]
                  : undefined
              }
            />
            {isAdminUser && assignedFilterChips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {assignedFilterChips.map(chip => (
                  <Tag
                    key={chip.key}
                    tone="neutral"
                    onRemove={chip.onClear}
                    removeLabel={`Clear ${chip.label}`}
                  >
                    {chip.label}
                  </Tag>
                ))}
              </div>
            )}
            {(assignmentStatsLoading || selectedAssigneeSummary) && (
              <div className="rounded-lg border bg-background p-4 shadow-sm">
                {assignmentStatsLoading ? (
                  <div className="space-y-4">
                    <SummaryCardSkeleton />
                    <StatGridSkeleton count={4} />
                  </div>
                ) : selectedAssigneeSummary ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">
                          Showing stats for
                        </p>
                        <p className="text-lg font-semibold text-foreground">
                          {selectedAssigneeSummary.label}
                        </p>
                        {selectedAssigneeSummary.regionLabel && (
                          <p className="text-sm text-muted-foreground">
                            {selectedAssigneeSummary.regionLabel}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-md border bg-card p-3 text-center shadow-sm">
                        <p className="text-xs font-medium text-muted-foreground">
                          Total Leads
                        </p>
                        <p className="text-2xl font-semibold text-foreground">
                          {selectedAssigneeSummary.totalLeads.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-md border bg-card p-3 text-center shadow-sm">
                        <p className="text-xs font-medium text-muted-foreground">
                          Converted
                        </p>
                        <p className="text-2xl font-semibold text-foreground">
                          {selectedAssigneeSummary.totalConverted.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-md border bg-card p-3 text-center shadow-sm">
                        <p className="text-xs font-medium text-muted-foreground">
                          Remaining
                        </p>
                        <p className="text-2xl font-semibold text-foreground">
                          {selectedAssigneeSummary.totalRemaining.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-md border bg-card p-3 text-center shadow-sm">
                        <p className="text-xs font-medium text-muted-foreground">
                          Conversion Rate
                        </p>
                        <p className="text-2xl font-semibold text-foreground">
                          {`${selectedAssigneeSummary.conversionRate.toFixed(1)}%`}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No stats available for the current selection.
                  </p>
                )}
              </div>
            )}
            {selectedLeads.length > 0 && (
              <SelectedLeadsActions
                count={selectedLeads.length}
                onSendToEmail={handleBulkEmail}
                onEmailExcel={() => setShowSendLeadsEmailModal(true)}
                onAssign={handleBulkAssignModal}
                onConvert={handleBulkConvert}
                onDelete={handleBulkDelete}
              />
            )}

            {!assignedLoading && assignedLeads.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center text-muted-foreground">
                  <p className="mb-2">
                    No assigned leads match the current filters.
                  </p>
                  <p className="text-sm">
                    Adjust the selected sales user or region filters to view
                    other assignments.
                  </p>
                </div>
              </div>
            ) : (
              <LeadTable
                leads={currentData.data.map(mapLeadForTable)}
                title="Assigned Leads"
                onLeadClick={lead =>
                  handleLeadClick(
                    currentData.data.find(l => l.id.toString() === lead.id)
                  )
                }
                currentPage={currentPage}
                totalPages={currentData.pagination?.totalPages || 1}
                totalCount={
                  currentData.pagination?.totalItems || currentData.data.length
                }
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
                showCheckboxes={true}
                selectedLeads={selectedLeads}
                onSelectionChange={setSelectedLeads}
                filters={tableFilters}
                onStatusChange={value => {
                  setStatusFilter(value);
                  setAssignedLeadsSearchQuery("");
                }}
                onSourceChange={value => {
                  setSourceFilter(value);
                  setAssignedLeadsSearchQuery("");
                }}
                onCreatedFromChange={value => {
                  setCreatedFrom(value);
                  setAssignedLeadsSearchQuery("");
                }}
                onCreatedToChange={value => {
                  setCreatedTo(value);
                  setAssignedLeadsSearchQuery("");
                }}
                onKeywordIdsChange={value => {
                  setKeywordIds(value);
                  setAssignedLeadsSearchQuery("");
                }}
                onClearFilters={() => {
                  setStatusFilter("");
                  setSourceFilter("");
                  setCreatedFrom(null);
                  setCreatedTo(null);
                  setKeywordIds([]);
                  setAssignedLeadsSearchQuery("");
                }}
                onKeywordIdsFilterRemove={() => {
                  handleKeywordIdsFilterRemove();
                  setAssignedLeadsSearchQuery("");
                }}
                searchQuery={assignedLeadsSearchQuery}
                isSearchMode={currentData.isSearchMode}
                showAssignedAtColumn
                hideCreatedAtColumn
                isLoading={assignedLoading}
              />
            )}
          </div>
        </div>
      );
    }

    if (pathname.endsWith("/unassigned-leads")) {
      return (
        <div className="space-y-4">
          {/* Unassigned Leads Content */}
          <div className="space-y-3">
            <DashboardToolbar
              search={
                <LeadSearchInput
                  value={unassignedLeadsSearchQuery}
                  onChange={setUnassignedLeadsSearchQuery}
                  placeholder="Search unassigned leads..."
                  isSearching={
                    currentData.isSearchMode
                      ? isSearchingUnassignedLeads
                      : false
                  }
                  resultCount={
                    currentData.isSearchMode
                      ? currentData.data.length
                      : undefined
                  }
                  showResultCount={true}
                  className="w-full"
                />
              }
              actions={
                <DataTransfer
                  entity={transferEntity}
                  allowImport={activeTab !== "leads"}
                  onImported={() => void refetchCurrent()}
                  size="default"
                />
              }
            />
            {selectedLeads.length > 0 && (
              <SelectedLeadsActions
                count={selectedLeads.length}
                onSendToEmail={handleBulkEmail}
                onEmailExcel={() => setShowSendLeadsEmailModal(true)}
                onAssign={handleBulkAssignModal}
                onConvert={() => {}}
                onDelete={handleBulkDelete}
              />
            )}

            <LeadTable
              leads={currentData.data.map(mapLeadForTable)}
              title="Unassigned Leads"
              onLeadClick={lead =>
                handleLeadClick(
                  currentData.data.find(l => l.id.toString() === lead.id)
                )
              }
              currentPage={currentPage}
              totalPages={currentData.pagination?.totalPages || 1}
              totalCount={
                currentData.pagination?.totalItems || currentData.data.length
              }
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
              showCheckboxes={true}
              selectedLeads={selectedLeads}
              onSelectionChange={setSelectedLeads}
              filters={tableFilters}
              onStatusChange={value => {
                setStatusFilter(value);
                setUnassignedLeadsSearchQuery("");
              }}
              onSourceChange={value => {
                setSourceFilter(value);
                setUnassignedLeadsSearchQuery("");
              }}
              onCreatedFromChange={value => {
                setCreatedFrom(value);
                setUnassignedLeadsSearchQuery("");
              }}
              onCreatedToChange={value => {
                setCreatedTo(value);
                setUnassignedLeadsSearchQuery("");
              }}
              onKeywordIdsChange={value => {
                setKeywordIds(value);
                setUnassignedLeadsSearchQuery("");
              }}
              onClearFilters={() => {
                setStatusFilter("");
                setSourceFilter("");
                setCreatedFrom(null);
                setCreatedTo(null);
                setKeywordIds([]);
                setUnassignedLeadsSearchQuery("");
              }}
              onKeywordIdsFilterRemove={() => {
                handleKeywordIdsFilterRemove();
                setUnassignedLeadsSearchQuery("");
              }}
              searchQuery={unassignedLeadsSearchQuery}
              isSearchMode={currentData.isSearchMode}
              isLoading={unassignedLoading}
            />
          </div>
        </div>
      );
    }

    if (pathname.endsWith("/accounts")) {
      return (
        <div className="space-y-4">
          {/* Accounts Content */}
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                {/* Search Bar */}
                <LeadSearchInput
                  value={accountsSearchQuery}
                  onChange={setAccountsSearchQuery}
                  placeholder="Search accounts..."
                  isSearching={
                    currentData.isSearchMode ? isSearchingAccountsActive : false
                  }
                  resultCount={
                    currentData.isSearchMode
                      ? currentData.data.length
                      : undefined
                  }
                  showResultCount={true}
                  className="w-full"
                />
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <DataTransfer
                  entity={transferEntity}
                  onImported={() => void refetchCurrent()}
                  size="default"
                  className="w-full sm:w-auto"
                />
              </div>
            </div>
            {selectedAccounts.length > 0 && (
              <div className="mr-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedAccounts.length} selected
                </span>
                <Button variant="outline" onClick={handleBulkAccountsExport}>
                  <Download className="h-4 w-4" />
                  Export Selected
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkAccountsDelete}
                >
                  Delete Selected
                </Button>
              </div>
            )}
            {accountsLoading ? (
              <div className="rounded-xl border bg-card/30 p-4">
                <TableSkeleton />
              </div>
            ) : accountsError ? (
              <div className="text-center py-8">
                <p className="mb-4 text-error-foreground">
                  Failed to load accounts
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <AccountTable
                accounts={(currentData.data ?? []) as Account[]}
                onAccountClick={handleAccountClick}
                onDeleteAccount={async account => {
                  try {
                    await deleteAccountMutation.mutateAsync(account.id);
                    toast.success("Account deleted successfully!");
                  } catch (error) {
                    const errorMessage =
                      error instanceof Error ? error.message : "Unknown error";
                    toast.error(`Failed to delete account: ${errorMessage}`);
                  }
                }}
                showCheckboxes={true}
                selectedItems={selectedAccounts}
                onSelectionChange={setSelectedAccounts}
                searchQuery={accountsSearchQuery}
                isSearchMode={currentData.isSearchMode}
                currentPage={currentPage}
                totalPages={currentData.pagination?.totalPages || 1}
                totalCount={
                  currentData.pagination?.totalItems || currentData.data.length
                }
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            )}
          </div>
        </div>
      );
    }

    if (pathname.endsWith("/contacts")) {
      return (
        <div className="space-y-4">
          {/* Contacts Content */}
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                {/* Search Bar */}
                <LeadSearchInput
                  value={contactsSearchQuery}
                  onChange={setContactsSearchQuery}
                  placeholder="Search contacts..."
                  isSearching={
                    currentData.isSearchMode ? isSearchingContactsActive : false
                  }
                  resultCount={
                    currentData.isSearchMode
                      ? currentData.data.length
                      : undefined
                  }
                  showResultCount={true}
                  className="w-full"
                />
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <DataTransfer
                  entity={transferEntity}
                  onImported={() => void refetchCurrent()}
                  size="default"
                  className="w-full sm:w-auto"
                />
              </div>
            </div>
            {selectedContacts.length > 0 && (
              <div className="mr-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedContacts.length} selected
                </span>
                <Button variant="outline" onClick={handleBulkContactsExport}>
                  <Download className="h-4 w-4" />
                  Export Selected
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkContactsDelete}
                >
                  Delete Selected
                </Button>
              </div>
            )}

            {currentData.isLoading ? (
              <div className="rounded-xl border bg-card/30 p-4">
                <TableSkeleton />
              </div>
            ) : (
              <ContactTable
                contacts={currentData.data.map((item: any) => ({
                  id: item.id.toString(),
                  name: item.name,
                  email: item.email,
                  phone: item.phone || "",
                  countryCode: item.countryCode,
                  position: item.position || "",
                  accountName: item.account?.name || "No Account",
                  createdAt: item.createdAt,
                  isConvertedLead:
                    item.convertedLeads && item.convertedLeads.length > 0,
                }))}
                onContactClick={handleContactClick}
                onDeleteContact={async contact => {
                  try {
                    await deleteContactMutation.mutateAsync(
                      parseInt(contact.id)
                    );
                    toast.success("Contact deleted successfully!");
                  } catch (error) {
                    const errorMessage =
                      error instanceof Error ? error.message : "Unknown error";
                    toast.error(`Failed to delete contact: ${errorMessage}`);
                  }
                }}
                showCheckboxes={true}
                selectedItems={selectedContacts}
                onSelectionChange={setSelectedContacts}
                searchQuery={contactsSearchQuery}
                isSearchMode={currentData.isSearchMode}
                currentPage={currentPage}
                totalPages={currentData.pagination?.totalPages || 1}
                totalCount={
                  currentData.pagination?.totalItems || currentData.data.length
                }
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            )}
          </div>
        </div>
      );
    }

    // Default fallback
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <h2 className="text-base sm:text-lg font-medium tracking-tight">
            Page Not Found
          </h2>
          <p className="text-muted-foreground">
            The requested page could not be found.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-background">
      {/* Content */}
      <PageShell>{renderContent()}</PageShell>

      {/* Bulk Confirmation Dialogs */}
      <ConvertConfirmationDialog
        open={showBulkConvertDialog}
        onOpenChange={setShowBulkConvertDialog}
        onConfirm={handleBulkConvertConfirm}
        itemName={`${selectedLeads.length} selected leads`}
        itemType="lead"
      />

      <DeleteConfirmationDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        onConfirm={handleBulkDeleteConfirm}
        itemName={`${selectedLeads.length} selected leads`}
        itemType="lead"
      />

      <DeleteConfirmationDialog
        open={showBulkAccountsDeleteDialog}
        onOpenChange={setShowBulkAccountsDeleteDialog}
        onConfirm={handleBulkAccountsDeleteConfirm}
        itemName={`${selectedAccounts.length} selected accounts`}
        itemType="account"
      />

      <DeleteConfirmationDialog
        open={showBulkContactsDeleteDialog}
        onOpenChange={setShowBulkContactsDeleteDialog}
        onConfirm={handleBulkContactsDeleteConfirm}
        itemName={`${selectedContacts.length} selected contacts`}
        itemType="contact"
      />

      <AssignLeadsModal
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        onAssign={handleAssignConfirm}
        selectedLeadsCount={selectedLeads.length}
      />

      <ImportLeadsModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
      />
      <AddLeadModal
        open={showAddLeadModal}
        onOpenChange={setShowAddLeadModal}
      />
      <SendLeadsEmailModal
        open={showSendLeadsEmailModal}
        onOpenChange={setShowSendLeadsEmailModal}
        selectedLeadIds={selectedLeads.map(id => parseInt(id))}
        onSent={() => setSelectedLeads([])}
      />
    </div>
  );
};
