"use client";

import React from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { X } from "lucide-react";
import { LeadFilterValues } from "./lead-filter";
import { useKeywords } from "../hooks/useKeywords";

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
      <Badge
        key="status"
        variant="secondary"
        className="bg-blue-100 text-blue-800 hover:bg-blue-100"
      >
        Status: {filters.status}
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 h-4 w-4 p-0 hover:bg-blue-200"
          onClick={onStatusRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </Badge>
    );
  }

  // Source filter badge
  if (filters.source) {
    badges.push(
      <Badge
        key="source"
        variant="secondary"
        className="bg-green-100 text-green-800 hover:bg-green-100"
      >
        Source: {filters.source}
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 h-4 w-4 p-0 hover:bg-green-200"
          onClick={onSourceRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </Badge>
    );
  }

  // Date range filter badges
  if (filters.createdFrom) {
    badges.push(
      <Badge
        key="createdFrom"
        variant="secondary"
        className="bg-purple-100 text-purple-800 hover:bg-purple-100"
      >
        From: {formatDate(filters.createdFrom)}
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 h-4 w-4 p-0 hover:bg-purple-200"
          onClick={onCreatedFromRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </Badge>
    );
  }

  if (filters.createdTo) {
    badges.push(
      <Badge
        key="createdTo"
        variant="secondary"
        className="bg-purple-100 text-purple-800 hover:bg-purple-100"
      >
        To: {formatDate(filters.createdTo)}
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 h-4 w-4 p-0 hover:bg-purple-200"
          onClick={onCreatedToRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </Badge>
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
        <Badge
          key={`keyword-${keyword.id}`}
          variant="secondary"
          className="bg-orange-100 text-orange-800 hover:bg-orange-100"
        >
          Keyword: {keyword.name}
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 h-4 w-4 p-0 hover:bg-orange-200"
            onClick={() => {
              if (onKeywordIdRemove) {
                onKeywordIdRemove(keyword.id);
              } else {
                onKeywordIdsRemove();
              }
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      );
    });
  }

  return <div className="flex flex-wrap gap-2 min-h-[32px]">{badges}</div>;
};
