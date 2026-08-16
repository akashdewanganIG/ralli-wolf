"use client";

import React from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { X } from "lucide-react";
import { ProductFilterValues } from "./product-filter";

interface ProductFilterBadgesProps {
  filters: ProductFilterValues;
  categories: Array<{ id: number; name: string }>;
  onCategoryRemove: () => void;
  onActiveRemove: () => void;
}

export const ProductFilterBadges: React.FC<ProductFilterBadgesProps> = ({
  filters,
  categories,
  onCategoryRemove,
  onActiveRemove,
}) => {
  const hasActiveFilters =
    filters.categoryId !== undefined || filters.active !== undefined;

  if (!hasActiveFilters) {
    return null;
  }

  const badges = [];

  // Category filter badge
  if (filters.categoryId !== undefined) {
    const category = categories.find(c => c.id === filters.categoryId);
    const categoryName = category
      ? category.name
      : `Category #${filters.categoryId}`;
    badges.push(
      <Badge
        key="category"
        variant="secondary"
        className="bg-blue-100 text-blue-800 hover:bg-blue-100"
      >
        Category: {categoryName}
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 h-4 w-4 p-0 hover:bg-blue-200"
          onClick={onCategoryRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </Badge>
    );
  }

  // Active status filter badge
  if (filters.active !== undefined) {
    badges.push(
      <Badge
        key="active"
        variant="secondary"
        className="bg-green-100 text-green-800 hover:bg-green-100"
      >
        Status: {filters.active ? "Active" : "Inactive"}
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 h-4 w-4 p-0 hover:bg-green-200"
          onClick={onActiveRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 min-h-[32px] justify-end">
      {badges}
    </div>
  );
};
