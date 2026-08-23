"use client";

import { ProductCategory } from "@/lib/api/types";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { cn } from "@repo/ui/lib/utils";
import { Filter } from "@repo/ui/icons";
import React, { useEffect, useState } from "react";

export interface ProductFilterValues {
  categoryId?: number;
  active?: boolean;
}

interface ProductFilterProps {
  filters: ProductFilterValues;
  categories: ProductCategory[];
  onCategoryChange: (categoryId: number | undefined) => void;
  onActiveChange: (active: boolean | undefined) => void;
}

// Helper function to check if filters are active
export const hasActiveProductFilters = (
  filters: ProductFilterValues
): boolean => {
  return filters.categoryId !== undefined || filters.active !== undefined;
};

export const ProductFilter: React.FC<ProductFilterProps> = ({
  filters,
  categories,
  onCategoryChange,
  onActiveChange,
}) => {
  const [open, setOpen] = useState(false);
  const [localFilters, setLocalFilters] =
    useState<ProductFilterValues>(filters);
  const hasActive = hasActiveProductFilters(filters);

  // Sync local filters with props when dialog opens or filters change
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const handleApplyFilters = () => {
    onCategoryChange(localFilters.categoryId);
    onActiveChange(localFilters.active);
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn("relative", hasActive && "bg-primary/10 border-primary")}
      >
        <Filter className="size-4" />
        Filter
        {hasActive && <span className="ml-1 h-2 w-2 bg-primary rounded-full" />}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[31.25rem]">
          <DialogHeader>
            <DialogTitle>Filter Products</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Category Filter */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={localFilters.categoryId?.toString() ?? "__all__"}
                onValueChange={v =>
                  setLocalFilters(prev => ({
                    ...prev,
                    categoryId: v === "__all__" ? undefined : parseInt(v, 10),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem
                      key={category.id}
                      value={category.id.toString()}
                    >
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="active">Status</Label>
              <Select
                value={
                  localFilters.active === undefined
                    ? "__all__"
                    : localFilters.active
                      ? "active"
                      : "inactive"
                }
                onValueChange={v => {
                  if (v === "__all__") {
                    setLocalFilters(prev => ({ ...prev, active: undefined }));
                  } else if (v === "active") {
                    setLocalFilters(prev => ({ ...prev, active: true }));
                  } else {
                    setLocalFilters(prev => ({ ...prev, active: false }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          <DialogFooter>
            <Button onClick={handleApplyFilters}>Apply Filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
