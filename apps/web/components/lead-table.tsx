"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import React from "react";
import { getLeadFullName } from "../lib/name";
import { displayPhone } from "../lib/phone-formatter";
import { getLeadStatusConfig } from "../lib/status-config";
import { DataTable, TableColumn } from "./data-table";
import { FilterBadges } from "./filter-badges";
import { LeadFilter, LeadFilterValues } from "./lead-filter";
import { TableSkeleton, ToolbarSkeleton } from "./skeletons";
import { Tag } from "@repo/ui/components/ui/tag";

const REGION_LABELS: Record<string, string> = {
  SOUTH: "South",
  NORTH: "North",
  EAST: "East",
  WEST_1: "West 1",
  WEST_2: "West 2",
  APTOC: "APTOC",
};

type LeadStatusValue = Parameters<typeof getLeadStatusConfig>[0];

const formatRegionLabel = (region?: string | null) => {
  if (!region) return "Unassigned";
  return REGION_LABELS[region] || region;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not available";
  const date = new Date(value);
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const dateStr = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
  return `${time}, ${dateStr}`;
};

export interface Lead {
  id: string;
  firstName: string;
  lastName?: string | null;
  name?: string;
  email: string;
  phone: string;
  countryCode?: string;
  source: string;
  status:
    | "New"
    | "Contacted"
    | "Qualified"
    | "Nurturing"
    | "Closed Won"
    | "Closed Lost"
    | string;
  createdAt: string;
  assignedAt?: string | null;
  owner?: {
    id?: number;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    region?: string | null;
  };
}

interface LeadStatusBadgeProps {
  status: Lead["status"];
}

const LeadStatusBadge: React.FC<LeadStatusBadgeProps> = ({ status }) => {
  const config = getLeadStatusConfig(status as LeadStatusValue);
  return <Tag tone={config.tone}>{config.label}</Tag>;
};

interface LeadTableProps {
  leads: Lead[];
  title?: string;
  onLeadClick?: (lead: Lead) => void;

  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;

  showCheckboxes?: boolean;
  selectedLeads?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;

  filters?: LeadFilterValues;
  onStatusChange?: (status: string) => void;
  onSourceChange?: (source: string) => void;
  onCreatedFromChange?: (date: Date | null) => void;
  onCreatedToChange?: (date: Date | null) => void;
  onKeywordIdsChange?: (keywordIds: number[]) => void;
  onClearFilters?: () => void;

  onStatusFilterRemove?: () => void;
  onSourceFilterRemove?: () => void;
  onCreatedFromFilterRemove?: () => void;
  onCreatedToFilterRemove?: () => void;
  onKeywordIdsFilterRemove?: () => void;

  search?: React.ReactNode;

  searchQuery?: string;
  isSearchMode?: boolean;
  showAssignedAtColumn?: boolean;
  hideCreatedAtColumn?: boolean;
  isLoading?: boolean;
}

export const LeadTable: React.FC<LeadTableProps> = ({
  leads,
  title = "Master Lead Table",
  onLeadClick,
  currentPage = 1,
  totalPages = 1,
  totalCount,
  itemsPerPage = 10,
  onPageChange,
  onItemsPerPageChange,
  showCheckboxes = false,
  selectedLeads = [],
  onSelectionChange,

  filters = {},
  onStatusChange,
  onSourceChange,
  onCreatedFromChange,
  onCreatedToChange,
  onKeywordIdsChange,
  onClearFilters,

  onStatusFilterRemove,
  onSourceFilterRemove,
  onCreatedFromFilterRemove,
  onCreatedToFilterRemove,
  onKeywordIdsFilterRemove,

  search,
  searchQuery,
  isSearchMode = false,
  showAssignedAtColumn = false,
  hideCreatedAtColumn = false,
  isLoading = false,
}) => {
  const columns: TableColumn<Lead>[] = [
    {
      key: "name",
      label: "Lead Name",
      render: (_value, item) => (
        <div className="flex items-center gap-2 py-2">
          <span className="text-muted-foreground hover:text-info">
            {item.name ?? getLeadFullName(item.firstName, item.lastName)}
          </span>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      render: value => (
        <span className="text-muted-foreground">
          {value || "No email provided"}
        </span>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (_value, item) => (
        <span className="text-muted-foreground">
          {displayPhone(item.phone, item.countryCode)}
        </span>
      ),
    },
    {
      key: "owner",
      label: "Assignee",
      render: (_value, item) => (
        <div className="flex flex-col">
          <span className="text-sm text-foreground">
            {[item.owner?.firstName, item.owner?.lastName]
              .filter(Boolean)
              .join(" ") ||
              item.owner?.email ||
              "Unassigned"}
          </span>
          {item.owner?.region ? (
            <span className="text-xs text-muted-foreground">
              {formatRegionLabel(item.owner.region)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No region</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: value => (
        <div className="flex items-center">
          <LeadStatusBadge status={value} />
        </div>
      ),
    },
  ];

  if (!hideCreatedAtColumn) {
    columns.push({
      key: "createdAt",
      label: "Created At",
      render: value => (
        <span className="text-muted-foreground">{formatDateTime(value)}</span>
      ),
    });
  }

  if (showAssignedAtColumn) {
    columns.push({
      key: "assignedAt",
      label: "Assigned On",
      render: (_value, item) => (
        <span className="text-muted-foreground">
          {formatDateTime(item.assignedAt)}
        </span>
      ),
    });
  }

  const actionItems = [
    { label: "View Details", onClick: (lead: Lead) => onLeadClick?.(lead) },
  ];

  const filterComponent = (
    <LeadFilter
      filters={filters}
      onStatusChange={onStatusChange || (() => {})}
      onSourceChange={onSourceChange || (() => {})}
      onCreatedFromChange={onCreatedFromChange || (() => {})}
      onCreatedToChange={onCreatedToChange || (() => {})}
      onKeywordIdsChange={onKeywordIdsChange || (() => {})}
      onClearFilters={onClearFilters || (() => {})}
    />
  );

  const filterBadgesComponent = (
    <FilterBadges
      filters={filters}
      onStatusRemove={onStatusFilterRemove || (() => onStatusChange?.(""))}
      onSourceRemove={onSourceFilterRemove || (() => onSourceChange?.(""))}
      onCreatedFromRemove={
        onCreatedFromFilterRemove || (() => onCreatedFromChange?.(null))
      }
      onCreatedToRemove={
        onCreatedToFilterRemove || (() => onCreatedToChange?.(null))
      }
      onKeywordIdsRemove={
        onKeywordIdsFilterRemove || (() => onKeywordIdsChange?.([]))
      }
      onKeywordIdRemove={keywordId => {
        if (filters?.keywordIds && Array.isArray(filters.keywordIds)) {
          onKeywordIdsChange?.(
            filters.keywordIds.filter(id => id !== keywordId)
          );
        }
      }}
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-4 rounded-xl border bg-card/30 p-4">
        <ToolbarSkeleton />
        <TableSkeleton />
      </div>
    );
  }

  return (
    <DataTable
      search={search}
      data={leads}
      columns={columns}
      title={title}
      count={totalCount || leads.length}
      actionItems={actionItems}
      onNameClick={onLeadClick}
      getRowHref={lead => `/leads/${lead.id}`}
      currentPage={currentPage}
      totalPages={totalPages}
      itemsPerPage={itemsPerPage}
      onPageChange={onPageChange}
      onItemsPerPageChange={onItemsPerPageChange}
      showFilter={true}
      customFilter={filterComponent}
      filterBadges={filterBadgesComponent}
      showCheckboxes={showCheckboxes}
      selectedItems={selectedLeads}
      onSelectionChange={onSelectionChange}
      searchQuery={searchQuery}
      isSearchMode={isSearchMode}
      columnPreferenceKey="lead-table"
    />
  );
};
