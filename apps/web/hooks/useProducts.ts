import { productService } from "@/lib/api/services";
import { useQuery } from "@tanstack/react-query";
import type { Product } from "@/lib/api/types";

export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  // list: (filters: LeadFilters & { page?: number; limit?: number }) => [...productKeys.lists(), { page: filters?.page, limit: filters?.limit, ...filters }] as const,
  details: () => [...productKeys.all, "detail"] as const,
  detail: (id: number) => [...productKeys.details(), id] as const,
  complete: () => [...productKeys.all, "complete"] as const,
  assignmentStats: () => [...productKeys.all, "assignment-stats"] as const,
};
export function useProduct(id: number) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => productService.getProductById(id),
    enabled: !!id,
  });
}

export function useActiveProducts() {
  return useQuery({
    queryKey: [...productKeys.lists(), "active"],
    queryFn: () => productService.getActiveProducts(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    select: res => res.data as Product[],
  });
}
