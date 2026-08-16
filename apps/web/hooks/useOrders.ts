import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aakramanService, AakramanOrder } from "../lib/api/services";

// Query keys
export const orderKeys = {
  all: ["orders"] as const,
  lists: () => [...orderKeys.all, "list"] as const,
  list: (filters?: {
    region?: string;
    state?: string;
    city?: string;
    salesUserId?: number;
    productId?: number;
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    [
      ...orderKeys.lists(),
      { page: filters?.page, limit: filters?.limit, ...filters },
    ] as const,
  details: () => [...orderKeys.all, "detail"] as const,
  detail: (id: number) => [...orderKeys.details(), id] as const,
};

// Hook that returns both data and pagination metadata
export function useOrdersWithPagination(
  filters?: {
    region?: string;
    state?: string;
    city?: string;
    salesUserId?: number;
    productId?: number;
    search?: string;
    page?: number;
    limit?: number;
  },
  options?: { enabled?: boolean }
) {
  const queryKey = orderKeys.list(filters || {});

  const query = useQuery({
    queryKey,
    queryFn: () => {
      console.log(
        "🔄 Fetching orders - Page:",
        filters?.page,
        "Limit:",
        filters?.limit
      );
      return aakramanService.admin.getAllOrders(filters);
    },
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 5 * 60 * 1000, // 5 minutes - keep data fresh but avoid unnecessary refetches
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid unnecessary calls
    refetchOnMount: true, // Ensure lists refresh on navigation after mutations
  });

  console.log(
    "📊 Query result - Page:",
    filters?.page,
    "Data length:",
    query.data?.data?.length || 0,
    "Total pages:",
    query.data?.pagination?.totalPages
  );

  return {
    ...query,
    data: query.data?.data || [],
    pagination: query.data?.pagination,
  };
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => aakramanService.admin.getOrderById(id),
    enabled: !!id,
  });
}

// Hooks for order mutations
export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AakramanOrder> }) =>
      aakramanService.admin.updateOrder(id, data),
    meta: { successMessage: "Order updated successfully" },
    onSuccess: (response, { id }) => {
      // Update the specific order in cache
      queryClient.setQueryData(orderKeys.detail(id), response);
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}
