import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pricebookService } from "../lib/api/services";
import { PriceBook } from "../lib/api/types";

// Query keys
export const pricebookKeys = {
  all: ["pricebooks"] as const,
  lists: () => [...pricebookKeys.all, "list"] as const,
  list: (filters: { page?: number; limit?: number }) =>
    [
      ...pricebookKeys.lists(),
      { page: filters?.page, limit: filters?.limit },
    ] as const,
  details: () => [...pricebookKeys.all, "detail"] as const,
  detail: (id: number) => [...pricebookKeys.details(), id] as const,
};

// Hooks for fetching pricebooks
export function usePricebooks(filters?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: pricebookKeys.list(filters || {}),
    queryFn: () => pricebookService.getAllPriceBooks(filters),
  });
}

// Hook that returns both data and pagination metadata
export function usePricebooksWithPagination(
  filters?: { page?: number; limit?: number },
  options?: { enabled?: boolean }
) {
  const queryKey = pricebookKeys.list(filters || {});

  const query = useQuery({
    queryKey,
    queryFn: () => {
      return pricebookService.getAllPriceBooks(filters);
    },
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    ...query,
    data: query.data?.data || [],
    pagination: query.data?.pagination,
  };
}

export function usePricebook(id: number) {
  return useQuery({
    queryKey: pricebookKeys.detail(id),
    queryFn: () => pricebookService.getPriceBookById(id),
    enabled: !!id,
  });
}

export function useCreatePricebook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<PriceBook>) =>
      pricebookService.createPriceBook(data),
    meta: { successMessage: "Pricebook created successfully" },
    onSuccess: newPricebook => {
      queryClient.invalidateQueries({ queryKey: pricebookKeys.lists() });
      queryClient.setQueryData(
        pricebookKeys.detail(newPricebook.id),
        newPricebook
      );
    },
  });
}

export function useDeletePricebook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pricebookService.deletePriceBook,
    meta: { successMessage: "Pricebook deleted successfully" },
    onSuccess: (_: any, deletedId: number) => {
      // Remove the pricebook detail cache
      queryClient.removeQueries({ queryKey: pricebookKeys.detail(deletedId) });
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: pricebookKeys.lists() });
    },
  });
}

export function useUpdatePricebook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PriceBook> }) =>
      pricebookService.updatePriceBook(id, data),
    meta: { successMessage: "Pricebook updated successfully" },
    onSuccess: updated => {
      queryClient.setQueryData(pricebookKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: pricebookKeys.lists() });
    },
  });
}
