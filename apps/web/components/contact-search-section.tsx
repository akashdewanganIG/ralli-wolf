"use client";

import React, { useState, useCallback } from "react";
import { LeadSearchInput } from "./lead-search-input";

interface ContactSearchSectionProps {
  onSearchQueryChange: (query: string) => void;
  isSearching?: boolean;
}

export const ContactSearchSection = React.memo(function ContactSearchSection({
  onSearchQueryChange,
  isSearching = false,
}: ContactSearchSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      onSearchQueryChange(value);
    },
    [onSearchQueryChange]
  );

  return (
    <LeadSearchInput
      value={searchQuery}
      onChange={handleSearchChange}
      placeholder="Search contacts in this account..."
      isSearching={isSearching}
    />
  );
});
