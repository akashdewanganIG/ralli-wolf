"use client";

import React from "react";
import { ProductFilterValues } from "./product-filter";
import { Tag } from "@repo/ui/components/ui/tag";

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

  if (filters.categoryId !== undefined) {
    const category = categories.find(c => c.id === filters.categoryId);
    const categoryName = category
      ? category.name
      : `Category #${filters.categoryId}`;
    badges.push(
      <Tag
        key="category"
        onRemove={onCategoryRemove}
        removeLabel="Remove filter"
      >
        Category: {categoryName}
      </Tag>
    );
  }

  if (filters.active !== undefined) {
    badges.push(
      <Tag key="active" onRemove={onActiveRemove} removeLabel="Remove filter">
        Status: {filters.active ? "Active" : "Inactive"}
      </Tag>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 min-h-[2rem] justify-end">
      {badges}
    </div>
  );
};
