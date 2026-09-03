import { useQuery } from "@tanstack/react-query";
import { leadService } from "../lib/api/services";
import { useDebouncedValue } from "./use-debounced-value";

export const searchKeys = {
  all: ["search"] as const,
  leads: (query: string) => [...searchKeys.all, "leads", query] as const,
};

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

  const debouncedQuery = useDebouncedValue(searchQuery, debounceMs);

  const shouldSearch = Boolean(
    enabled && debouncedQuery.trim().length >= minQueryLength
  );

  const query = useQuery({
    queryKey: searchKeys.leads(debouncedQuery),
    queryFn: () => leadService.searchLeads(debouncedQuery),
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
