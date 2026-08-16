import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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

// Query keys for contact search
export const contactSearchKeys = {
  all: ["contactSearch"] as const,
  contacts: (accountId: number, query: string) =>
    [...contactSearchKeys.all, "contacts", accountId, query] as const,
};

/**
 * Custom hook for debounced contact search within a specific account
 * @param searchQuery - The search query
 * @param accountId - The account ID to search contacts within
 * @param debounceMs - Debounce delay in milliseconds (default: 500)
 * @param minQueryLength - Minimum query length to trigger search (default: 2)
 */
export function useSearchContacts(
  searchQuery: string,
  accountId: number,
  options?: {
    debounceMs?: number;
    minQueryLength?: number;
  }
) {
  const { debounceMs = 500, minQueryLength = 2 } = options || {};

  // Debounce the search query
  const debouncedQuery = useDebounce(searchQuery, debounceMs);

  // Determine if we should search
  const shouldSearch = Boolean(
    debouncedQuery.trim().length >= minQueryLength && accountId > 0
  );

  const query = useQuery({
    queryKey: contactSearchKeys.contacts(accountId, debouncedQuery),
    queryFn: () => {
      console.log(
        "🔍 Searching contacts for account",
        accountId,
        "with query:",
        debouncedQuery
      );
      return accountService.searchAccountContacts(accountId, debouncedQuery);
    },
    enabled: shouldSearch,
    staleTime: 2 * 60 * 1000, // 2 minutes - search results can be cached briefly
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return useMemo(
    () => ({
      ...query,
      data: query.data || [],
      isLoading: query.isLoading && shouldSearch,
      isSearching: query.isLoading && shouldSearch,
      hasResults: query.data && query.data.length > 0,
      isEmpty: shouldSearch && query.data && query.data.length === 0,
      query: debouncedQuery,
      shouldSearch,
    }),
    [query, shouldSearch, debouncedQuery]
  );
}
