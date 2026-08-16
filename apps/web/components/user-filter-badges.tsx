"use client";

import React from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { X } from "lucide-react";

interface UserFilterBadgesProps {
  selectedRole?: string;
  selectedRegion?: string;
  onRoleRemove: () => void;
  onRegionRemove: () => void;
}

// Helper function to format region for display
const formatRegion = (region?: string): string => {
  if (!region) return "-";
  const regionMap: Record<string, string> = {
    SOUTH: "South",
    NORTH: "North",
    EAST: "East",
    WEST_1: "West 1",
    WEST_2: "West 2",
    APTOC: "APTOC",
  };
  return regionMap[region] || region;
};

export const UserFilterBadges: React.FC<UserFilterBadgesProps> = ({
  selectedRole,
  selectedRegion,
  onRoleRemove,
  onRegionRemove,
}) => {
  const hasActiveFilters =
    selectedRole !== undefined || selectedRegion !== undefined;

  if (!hasActiveFilters) {
    return null;
  }

  const badges = [];

  // Role filter badge
  if (selectedRole !== undefined) {
    badges.push(
      <Badge
        key="role"
        variant="secondary"
        className="bg-brand-pale-aqua text-brand-teal hover:bg-brand-pale-aqua"
      >
        Role: {selectedRole}
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 h-4 w-4 p-0 hover:bg-brand-teal/20"
          onClick={onRoleRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </Badge>
    );
  }

  // Region filter badge
  if (selectedRegion !== undefined) {
    badges.push(
      <Badge
        key="region"
        variant="secondary"
        className="bg-brand-lavender text-brand-indigo hover:bg-brand-lavender"
      >
        Region: {formatRegion(selectedRegion)}
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 h-4 w-4 p-0 hover:bg-brand-indigo/20"
          onClick={onRegionRemove}
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
