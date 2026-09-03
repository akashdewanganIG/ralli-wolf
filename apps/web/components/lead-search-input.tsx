"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X } from "@repo/ui/icons";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

interface LeadSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  isSearching?: boolean;
  resultCount?: number;
  showResultCount?: boolean;
}

export const LeadSearchInput: React.FC<LeadSearchInputProps> = React.memo(
  ({
    value,
    onChange,
    placeholder = "Search leads...",
    className,
    isSearching = false,
    resultCount,
    showResultCount = true,
  }) => {
    const [localValue, setLocalValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);
    const isControlled = value !== undefined;

    useEffect(() => {
      if (isControlled) {
        setLocalValue(value);
      }
    }, [value, isControlled]);

    const handleInputChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setLocalValue(newValue);
        if (onChange) {
          onChange(newValue);
        }
      },
      [onChange]
    );

    const handleClear = React.useCallback(() => {
      setLocalValue("");
      if (onChange) {
        onChange("");
      }
    }, [onChange]);

    const hasValue = localValue.length > 0;
    const showClearButton = hasValue && !isSearching;

    return (
      <div className={cn("relative w-full", className)}>
        <div className="relative w-full">
          <Search className="absolute left-3 inset-y-0 my-auto h-fit h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={localValue}
            onChange={handleInputChange}
            className={cn("pl-10 pr-20", isSearching && "pr-16")}
          />
          {isSearching && (
            <div className="absolute right-3 inset-y-0 my-auto h-fit"></div>
          )}
          {showClearButton && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-1 inset-y-0 my-auto h-fit h-6 w-6 p-0 hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {showResultCount && hasValue && resultCount !== undefined && (
          <div className="mt-1 text-xs text-muted-foreground">
            {isSearching
              ? "Searching..."
              : resultCount === 0
                ? "No results found"
                : `Found ${resultCount} result${resultCount === 1 ? "" : "s"}`}
          </div>
        )}
      </div>
    );
  }
);

LeadSearchInput.displayName = "LeadSearchInput";
