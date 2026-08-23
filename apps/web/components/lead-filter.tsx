"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@repo/ui/components/ui/dialog";
import { Filter } from "@repo/ui/icons";
import { cn } from "@repo/ui/lib/utils";
import { KeywordSelect } from "./keyword-select";
import { toast } from "@/lib/toast";

// Local mirror of the Prisma LeadSource enum values (string values match the
// schema 1:1) so this client component never pulls in @prisma/client's
// generated runtime.
const LeadSource = {
  MANUAL: "MANUAL",
  IMPORT: "IMPORT",
  LANDING_PAGE: "LANDING_PAGE",
} as const;

export interface LeadFilterValues {
  status?: string;
  source?: string;
  createdFrom?: Date | null;
  createdTo?: Date | null;
  keywordIds?: number[];
}

interface LeadFilterProps {
  filters: LeadFilterValues;
  onStatusChange: (status: string) => void;
  onSourceChange: (source: string) => void;
  onCreatedFromChange: (date: Date | null) => void;
  onCreatedToChange: (date: Date | null) => void;
  onKeywordIdsChange: (keywordIds: number[]) => void;
  onClearFilters: () => void;
}

const statusOptions = [
  { value: "OPEN", label: "OPEN" },
  { value: "WORKING", label: "WORKING" },
  { value: "QUALIFIED", label: "QUALIFIED" },
  { value: "NURTURING", label: "NURTURING" },
  { value: "CONVERTED", label: "CONVERTED" },
  { value: "UNQUALIFIED", label: "UNQUALIFIED" },
];

const sourceOptions = [
  { value: LeadSource.MANUAL, label: "Manual" },
  { value: LeadSource.IMPORT, label: "Import" },
  { value: LeadSource.LANDING_PAGE, label: "Landing Page" },
];

// Helper function to check if filters are active
export const hasActiveFilters = (filters: LeadFilterValues): boolean => {
  return Object.entries(filters).some(([key, value]) => {
    if (key === "keywordIds") {
      return Array.isArray(value) && value.length > 0;
    }
    return value !== undefined && value !== null && value !== "";
  });
};

export const LeadFilter: React.FC<LeadFilterProps> = ({
  filters,
  onStatusChange,
  onSourceChange,
  onCreatedFromChange,
  onCreatedToChange,
  onKeywordIdsChange,
  onClearFilters,
}) => {
  const [open, setOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<LeadFilterValues>(filters);
  const hasActive = hasActiveFilters(filters);

  // Sync local filters with props when dialog opens or filters change
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const handleClear = () => {
    setLocalFilters({});
    onClearFilters();
    setOpen(false);
    toast.info("Lead filters cleared");
  };

  const handleApplyFilters = () => {
    // Apply all local filter values to parent
    onStatusChange(localFilters.status ?? "");
    onSourceChange(localFilters.source ?? "");
    onCreatedFromChange(localFilters.createdFrom ?? null);
    onCreatedToChange(localFilters.createdTo ?? null);
    onKeywordIdsChange(localFilters.keywordIds ?? []);
    setOpen(false);
  };

  return (
    <>
      <div className="inline-flex items-center">
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          className={cn(
            "relative px-3",
            hasActive && "border-primary/30 bg-accent text-accent-foreground"
          )}
        >
          <Filter className="size-4" />
          Filter
          {hasActive && (
            <span className="ml-1 h-2 w-2 bg-primary rounded-full" />
          )}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[31.25rem]">
          <DialogHeader>
            <DialogTitle>Filter Leads</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={localFilters.status ?? "__all__"}
                onValueChange={v =>
                  setLocalFilters({
                    ...localFilters,
                    status: v === "__all__" ? "" : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Statuses</SelectItem>
                  {statusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Source Filter */}
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select
                value={localFilters.source ?? "__all__"}
                onValueChange={v =>
                  setLocalFilters({
                    ...localFilters,
                    source: v === "__all__" ? "" : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Sources</SelectItem>
                  {sourceOptions.map(option => (
                    <SelectItem
                      key={String(option.value)}
                      value={String(option.value)}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Keyword Filter */}
            <div className="space-y-2">
              <KeywordSelect
                selectedKeywordIds={localFilters.keywordIds || []}
                onSelectionChange={keywordIds =>
                  setLocalFilters({ ...localFilters, keywordIds })
                }
                label="Keyword"
                placeholder="Select keywords to filter"
              />
            </div>

            {/* Created From Date */}
            <div className="space-y-2">
              <Label htmlFor="createdFrom">Created From</Label>
              <Input
                id="createdFrom"
                type="date"
                value={
                  localFilters.createdFrom
                    ? localFilters.createdFrom.toISOString().split("T")[0]
                    : ""
                }
                onChange={e =>
                  setLocalFilters({
                    ...localFilters,
                    createdFrom: e.target.value
                      ? new Date(e.target.value)
                      : null,
                  })
                }
                className="w-full"
              />
            </div>

            {/* Created To Date */}
            <div className="space-y-2">
              <Label htmlFor="createdTo">Created To</Label>
              <Input
                id="createdTo"
                type="date"
                value={
                  localFilters.createdTo
                    ? localFilters.createdTo.toISOString().split("T")[0]
                    : ""
                }
                onChange={e =>
                  setLocalFilters({
                    ...localFilters,
                    createdTo: e.target.value ? new Date(e.target.value) : null,
                  })
                }
                className="w-full"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <DialogFooter>
            <Button variant="outline" onClick={handleClear}>
              Clear Filters
            </Button>
            <Button onClick={handleApplyFilters}>Apply Filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
