import { useQuery } from "@tanstack/react-query";
import { accountService } from "../lib/api/services";
import { useDebouncedValue } from "./use-debounced-value";

export const accountSearchKeys = {
  all: ["accountSearch"] as const,
  accounts: (query: string) =>
    [...accountSearchKeys.all, "accounts", query] as const,
};

export function useSearchAccounts(
  searchQuery: string,
  options?: {
    debounceMs?: number;
    enabled?: boolean;
  }
) {
  const { debounceMs = 500, enabled = true } = options || {};

  const debouncedQuery = useDebouncedValue(searchQuery, debounceMs);

  const shouldSearch = Boolean(
    enabled && debouncedQuery && debouncedQuery.length > 0
  );

  const query = useQuery({
    queryKey: accountSearchKeys.accounts(debouncedQuery),
    queryFn: () => accountService.searchAccounts(debouncedQuery),
    enabled: shouldSearch,
    staleTime: 2 * 60 * 1000,
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
