"use client";

import React from "react";
import { Tag } from "@repo/ui/components/ui/tag";

interface UserFilterBadgesProps {
  selectedRole?: string;
  selectedRegion?: string;
  onRoleRemove: () => void;
  onRegionRemove: () => void;
}

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

  if (selectedRole !== undefined) {
    badges.push(
      <Tag key="role" onRemove={onRoleRemove} removeLabel="Remove filter">
        Role: {selectedRole}
      </Tag>
    );
  }

  if (selectedRegion !== undefined) {
    badges.push(
      <Tag key="region" onRemove={onRegionRemove} removeLabel="Remove filter">
        Region: {formatRegion(selectedRegion)}
      </Tag>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 min-h-[2rem] justify-end">
      {badges}
    </div>
  );
};
