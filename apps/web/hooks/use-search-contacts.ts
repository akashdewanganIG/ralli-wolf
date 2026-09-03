import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { accountService } from "../lib/api/services";
import { useDebouncedValue } from "./use-debounced-value";

export const contactSearchKeys = {
  all: ["contactSearch"] as const,
  contacts: (accountId: number, query: string) =>
    [...contactSearchKeys.all, "contacts", accountId, query] as const,
};

export function useSearchContacts(
  searchQuery: string,
  accountId: number,
  options?: {
    debounceMs?: number;
    minQueryLength?: number;
  }
) {
  const { debounceMs = 500, minQueryLength = 2 } = options || {};

  const debouncedQuery = useDebouncedValue(searchQuery, debounceMs);

  const shouldSearch = Boolean(
    debouncedQuery.trim().length >= minQueryLength && accountId > 0
  );

  const query = useQuery({
    queryKey: contactSearchKeys.contacts(accountId, debouncedQuery),
    queryFn: () =>
      accountService.searchAccountContacts(accountId, debouncedQuery),
    enabled: shouldSearch,
    staleTime: 2 * 60 * 1000,
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
