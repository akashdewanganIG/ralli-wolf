"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { cn } from "@repo/ui/lib/utils";
import { ChevronDown, Loader2, Plus, Search, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useCreateKeyword, useKeywords } from "../hooks/useKeywords";
import { ListSkeleton } from "./skeletons";

interface KeywordSelectProps {
  selectedKeywordIds: number[];
  onSelectionChange?: (keywordIds: number[]) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function KeywordSelect({
  selectedKeywordIds = [],
  onSelectionChange = () => {},
  label = "Keyword",
  placeholder = "Select or create keywords",
  className,
}: KeywordSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newKeywordName, setNewKeywordName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all keywords (for displaying selected ones)
  const { data: allKeywords = [], isLoading: isLoadingAllKeywords } =
    useKeywords();

  // Fetch keywords with search (for the dropdown list)
  const searchTerm = searchQuery.trim() || undefined;
  const { data: searchKeywords = [], isLoading: isLoadingSearchKeywords } =
    useKeywords(searchTerm);

  const createKeywordMutation = useCreateKeyword();

  // Ensure onSelectionChange is always a function
  const handleSelectionChange = React.useCallback(
    (keywordIds: number[]) => {
      if (typeof onSelectionChange === "function") {
        onSelectionChange(keywordIds);
      } else {
        console.error(
          "onSelectionChange is not a function",
          typeof onSelectionChange,
          onSelectionChange
        );
      }
    },
    [onSelectionChange]
  );

  // Use search results if searching, otherwise use all keywords
  const keywords = searchTerm ? searchKeywords : allKeywords;
  const isLoadingKeywords = searchTerm
    ? isLoadingSearchKeywords
    : isLoadingAllKeywords;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
        setNewKeywordName("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Get selected keywords from all keywords (so they show even when searching)
  const selectedKeywords = allKeywords.filter(k =>
    selectedKeywordIds.includes(k.id)
  );

  // Available keywords are those in the current list that aren't selected
  const availableKeywords = keywords.filter(
    k => !selectedKeywordIds.includes(k.id)
  );

  const handleToggleKeyword = (keywordId: number) => {
    if (selectedKeywordIds.includes(keywordId)) {
      handleSelectionChange(selectedKeywordIds.filter(id => id !== keywordId));
    } else {
      handleSelectionChange([...selectedKeywordIds, keywordId]);
    }
  };

  const handleRemoveKeyword = (keywordId: number) => {
    handleSelectionChange(selectedKeywordIds.filter(id => id !== keywordId));
  };

  const handleCreateKeyword = async () => {
    if (!newKeywordName.trim()) return;

    const keywordName = newKeywordName.trim().toLowerCase();
    setIsCreating(true);

    try {
      const newKeyword = await createKeywordMutation.mutateAsync(keywordName);
      handleSelectionChange([...selectedKeywordIds, newKeyword.id]);
      setNewKeywordName("");
      setSearchQuery("");
    } catch (error) {
      console.error("Failed to create keyword:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}

      {/* Selected Keywords Display */}
      {selectedKeywords.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedKeywords.map(keyword => (
            <Badge
              key={keyword.id}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {keyword.name}
              <button
                type="button"
                onClick={() => handleRemoveKeyword(keyword.id)}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5 whitespace-nowrap"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="text-muted-foreground">
            {selectedKeywords.length > 0
              ? `${selectedKeywords.length} selected`
              : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-80 overflow-auto">
            {/* Search Input */}
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search keywords..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Create New Keyword */}
            <div className="p-2 border-b">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Create new keyword..."
                  value={newKeywordName}
                  onChange={e => setNewKeywordName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateKeyword();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateKeyword}
                  disabled={!newKeywordName.trim() || isCreating}
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Keywords List */}
            <div className="max-h-48 overflow-auto">
              {isLoadingKeywords ? (
                <div className="p-4">
                  <ListSkeleton rows={4} />
                </div>
              ) : availableKeywords.length === 0 && searchQuery === "" ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No keywords available. Create one above.
                </div>
              ) : availableKeywords.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No keywords found. Create one above.
                </div>
              ) : (
                <div className="p-1">
                  {availableKeywords.map(keyword => (
                    <button
                      key={keyword.id}
                      type="button"
                      onClick={() => handleToggleKeyword(keyword.id)}
                      className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground rounded-sm text-sm flex items-center gap-2"
                    >
                      <div className="flex-1">{keyword.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
