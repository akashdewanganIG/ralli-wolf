import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { leadService } from "../lib/api/services";

// Debounce utility function
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Query keys for search
export const searchKeys = {
  all: ["search"] as const,
  leads: (query: string) => [...searchKeys.all, "leads", query] as const,
};

/**
 * Custom hook for debounced lead search
 * @param searchQuery - The search query from nuqs state
 * @param debounceMs - Debounce delay in milliseconds (default: 500)
 * @param minQueryLength - Minimum query length to trigger search (default: 2)
 */
export function useSearchLeads(
  searchQuery: string,
  options?: {
    debounceMs?: number;
    minQueryLength?: number;
    enabled?: boolean;
  }
) {
  const {
    debounceMs = 500,
    minQueryLength = 2,
    enabled = true,
  } = options || {};

  // Debounce the search query
  const debouncedQuery = useDebounce(searchQuery, debounceMs);

  // Determine if we should search
  const shouldSearch = Boolean(
    enabled && debouncedQuery.trim().length >= minQueryLength
  );

  const query = useQuery({
    queryKey: searchKeys.leads(debouncedQuery),
    queryFn: () => {
      console.log("🔍 Searching leads for query:", debouncedQuery);
      return leadService.searchLeads(debouncedQuery);
    },
    enabled: shouldSearch,
    staleTime: 2 * 60 * 1000, // 2 minutes - search results can be cached briefly
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    ...query,
    data: query.data || [],
    isLoading: query.isLoading && shouldSearch,
    isSearching: query.isLoading && shouldSearch,
    hasResults: query.data && query.data.length > 0,
    isEmpty: shouldSearch && query.data && query.data.length === 0,
    query: debouncedQuery,
    shouldSearch,
  };
}
