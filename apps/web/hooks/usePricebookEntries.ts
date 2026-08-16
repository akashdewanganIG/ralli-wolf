import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pricebookEntryService } from "../lib/api/services";
import { PriceBookEntry } from "../lib/api/types";

// Query keys
export const pricebookEntryKeys = {
  all: ["pricebookEntries"] as const,
  lists: () => [...pricebookEntryKeys.all, "list"] as const,
  list: (filters: { productId: number }) =>
    [...pricebookEntryKeys.lists(), filters] as const,
  listByPriceBookId: (filters: { priceBookId: number }) =>
    [...pricebookEntryKeys.lists(), filters] as const,
  details: () => [...pricebookEntryKeys.all, "detail"] as const,
  detail: (id: number) => [...pricebookEntryKeys.details(), id] as const,
};

// Hooks for fetching pricebook entries
export function usePricebookEntries(filters: { productId: number }) {
  return useQuery({
    queryKey: pricebookEntryKeys.list(filters),
    queryFn: () => pricebookEntryService.getAllPriceBookEntries(filters),
    enabled: !!filters.productId,
  });
}

export function usePricebookEntriesByPriceBookId(filters: {
  priceBookId: number;
}) {
  return useQuery({
    queryKey: pricebookEntryKeys.listByPriceBookId(filters),
    queryFn: () =>
      pricebookEntryService.getPriceBookEntriesByPriceBookId(filters),
    enabled: !!filters.priceBookId,
  });
}

export function usePricebookEntry(id: number) {
  return useQuery({
    queryKey: pricebookEntryKeys.detail(id),
    queryFn: () => pricebookEntryService.getPriceBookEntryById(id),
    enabled: !!id,
  });
}

export function useCreatePricebookEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<PriceBookEntry>) =>
      pricebookEntryService.createPriceBookEntry(data),
    meta: { successMessage: "Price book entry created successfully" },
    onSuccess: newEntry => {
      queryClient.invalidateQueries({ queryKey: pricebookEntryKeys.lists() });
      queryClient.setQueryData(
        pricebookEntryKeys.detail(newEntry.id),
        newEntry
      );
    },
  });
}

export function useUpdatePricebookEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PriceBookEntry> }) =>
      pricebookEntryService.updatePriceBookEntry(id, data),
    meta: { successMessage: "Price book entry updated successfully" },
    onSuccess: updatedEntry => {
      queryClient.invalidateQueries({ queryKey: pricebookEntryKeys.lists() });
      queryClient.setQueryData(
        pricebookEntryKeys.detail(updatedEntry.id),
        updatedEntry
      );
    },
  });
}

export function useDeletePricebookEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pricebookEntryService.deletePriceBookEntry,
    meta: { successMessage: "Price book entry deleted successfully" },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: pricebookEntryKeys.lists() });
      queryClient.removeQueries({
        queryKey: pricebookEntryKeys.detail(deletedId),
      });
    },
  });
}
