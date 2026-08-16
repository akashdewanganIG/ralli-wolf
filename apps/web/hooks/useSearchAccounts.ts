import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { accountService } from "../lib/api/services";

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

// Query keys for account search
export const accountSearchKeys = {
  all: ["accountSearch"] as const,
  accounts: (query: string) =>
    [...accountSearchKeys.all, "accounts", query] as const,
};

/**
 * Custom hook for debounced account search
 * @param searchQuery - The search query
 * @param debounceMs - Debounce delay in milliseconds (default: 500)
 */
export function useSearchAccounts(
  searchQuery: string,
  options?: {
    debounceMs?: number;
    enabled?: boolean;
  }
) {
  const { debounceMs = 500, enabled = true } = options || {};

  // Debounce the search query
  const debouncedQuery = useDebounce(searchQuery, debounceMs);

  // Determine if we should search
  const shouldSearch = Boolean(
    enabled && debouncedQuery && debouncedQuery.length > 0
  );

  const query = useQuery({
    queryKey: accountSearchKeys.accounts(debouncedQuery),
    queryFn: () => {
      console.log("🔍 Searching accounts for query:", debouncedQuery);
      return accountService.searchAccounts(debouncedQuery);
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
