"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { cn } from "@repo/ui/lib/utils";
import { toast } from "@/lib/toast";
import { SlidersHorizontal } from "@repo/ui/icons";
import React, { useEffect, useState } from "react";

export interface CampaignFilterValues {
  status?: string;
  startDate?: Date | null;
  createdFrom?: Date | null;
  createdTo?: Date | null;
}

interface CampaignFilterProps {
  filters: CampaignFilterValues;
  onStatusChange: (status: string) => void;
  onStartDateChange: (date: Date | null) => void;
  onCreatedFromChange: (date: Date | null) => void;
  onCreatedToChange: (date: Date | null) => void;
  onClearFilters: () => void;
  onApplyFilters?: (filters: CampaignFilterValues) => void;
  statusOptions?: ReadonlyArray<{ value: string; label: string }>;
  showDateFilters?: boolean;
}

const DEFAULT_STATUS_OPTIONS = [
  { value: "Draft", label: "Draft" },
  { value: "Sent", label: "Sent" },
  { value: "Scheduled", label: "Scheduled" },
  { value: "Running", label: "Running" },
  { value: "Suspended", label: "Suspended" },
  { value: "Archived", label: "Archived" },
  { value: "Rejected", label: "Rejected" },
  { value: "Cancelled", label: "Cancelled" },
];

export const hasActiveFilters = (filters: CampaignFilterValues): boolean => {
  return Object.values(filters).some(value => {
    return value !== undefined && value !== null && value !== "";
  });
};

export const CampaignFilter: React.FC<CampaignFilterProps> = ({
  filters,
  onStatusChange,
  onStartDateChange,
  onCreatedFromChange,
  onCreatedToChange,
  onClearFilters,
  onApplyFilters,
  statusOptions = DEFAULT_STATUS_OPTIONS,
  showDateFilters = true,
}) => {
  const [open, setOpen] = useState(false);
  const [localFilters, setLocalFilters] =
    useState<CampaignFilterValues>(filters);
  const hasActive = hasActiveFilters(filters);

  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const handleClear = () => {
    setLocalFilters({});
    onClearFilters();
    setOpen(false);
    toast.info("Campaign filters cleared");
  };

  const handleApplyFilters = () => {
    const cleanedFilters: CampaignFilterValues = {
      ...(localFilters.status && localFilters.status.trim() !== ""
        ? { status: localFilters.status }
        : {}),
      ...(localFilters.startDate ? { startDate: localFilters.startDate } : {}),
      ...(localFilters.createdFrom
        ? { createdFrom: localFilters.createdFrom }
        : {}),
      ...(localFilters.createdTo ? { createdTo: localFilters.createdTo } : {}),
    };

    if (onApplyFilters) {
      onApplyFilters(cleanedFilters);
    } else {
      onStatusChange(localFilters.status ?? "");
      onStartDateChange(localFilters.startDate ?? null);
      onCreatedFromChange(localFilters.createdFrom ?? null);
      onCreatedToChange(localFilters.createdTo ?? null);
    }
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn("relative", hasActive && "border-primary bg-primary/10")}
      >
        <SlidersHorizontal className="size-4" />
        Filter
        {hasActive && <span className="size-2 rounded-full bg-primary" />}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden sm:max-w-[31.25rem]">
          <DialogHeader>
            <DialogTitle>Filter Campaigns</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
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

            {showDateFilters && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Starting Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={
                      localFilters.startDate
                        ? localFilters.startDate.toISOString().split("T")[0]
                        : ""
                    }
                    onChange={e =>
                      setLocalFilters({
                        ...localFilters,
                        startDate: e.target.value
                          ? new Date(e.target.value)
                          : null,
                      })
                    }
                    className="w-full"
                  />
                </div>

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
                        createdTo: e.target.value
                          ? new Date(e.target.value)
                          : null,
                      })
                    }
                    className="w-full"
                  />
                </div>
              </>
            )}
          </DialogBody>

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
