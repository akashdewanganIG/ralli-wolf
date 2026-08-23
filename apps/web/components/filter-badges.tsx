"use client";

import React from "react";
import { LeadFilterValues } from "./lead-filter";
import { useKeywords } from "../hooks/useKeywords";
import { Tag } from "@repo/ui/components/ui/tag";

interface FilterBadgesProps {
  filters: LeadFilterValues;
  onStatusRemove: () => void;
  onSourceRemove: () => void;
  onCreatedFromRemove: () => void;
  onCreatedToRemove: () => void;
  onKeywordIdsRemove: () => void;
  onKeywordIdRemove?: (keywordId: number) => void;
}

export const FilterBadges: React.FC<FilterBadgesProps> = ({
  filters,
  onStatusRemove,
  onSourceRemove,
  onCreatedFromRemove,
  onCreatedToRemove,
  onKeywordIdsRemove,
  onKeywordIdRemove,
}) => {
  // Fetch all keywords to get their names
  const { data: allKeywords = [] } = useKeywords();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === "keywordIds") {
      return Array.isArray(value) && value.length > 0;
    }
    return value !== undefined && value !== null && value !== "";
  });

  if (!hasActiveFilters) {
    return null;
  }

  const badges = [];

  // Status filter badge
  if (filters.status) {
    badges.push(
      <Tag key="status" onRemove={onStatusRemove} removeLabel="Remove filter">
        Status: {filters.status}
      </Tag>
    );
  }

  // Source filter badge
  if (filters.source) {
    badges.push(
      <Tag key="source" onRemove={onSourceRemove} removeLabel="Remove filter">
        Source: {filters.source}
      </Tag>
    );
  }

  // Date range filter badges
  if (filters.createdFrom) {
    badges.push(
      <Tag
        key="createdFrom"
        onRemove={onCreatedFromRemove}
        removeLabel="Remove filter"
      >
        From: {formatDate(filters.createdFrom)}
      </Tag>
    );
  }

  if (filters.createdTo) {
    badges.push(
      <Tag
        key="createdTo"
        onRemove={onCreatedToRemove}
        removeLabel="Remove filter"
      >
        To: {formatDate(filters.createdTo)}
      </Tag>
    );
  }

  // Keyword filter badges - show one badge per selected keyword
  if (
    filters.keywordIds &&
    Array.isArray(filters.keywordIds) &&
    filters.keywordIds.length > 0
  ) {
    const selectedKeywords = allKeywords.filter(k =>
      filters.keywordIds!.includes(k.id)
    );

    selectedKeywords.forEach(keyword => {
      badges.push(
        <Tag
          key={`keyword-${keyword.id}`}
          onRemove={() => {
            if (onKeywordIdRemove) {
              onKeywordIdRemove(keyword.id);
            } else {
              onKeywordIdsRemove();
            }
          }}
          removeLabel={`Remove keyword ${keyword.name}`}
        >
          Keyword: {keyword.name}
        </Tag>
      );
    });
  }

  return <div className="flex flex-wrap gap-2 min-h-[2rem]">{badges}</div>;
};
