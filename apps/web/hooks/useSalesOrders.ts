import { useQuery } from "@tanstack/react-query";
import { salesOrderService } from "../lib/api/services";
import { SalesOrderListItem } from "../lib/api/types";

export const salesOrderKeys = {
  all: ["sales-orders"] as const,
  lists: () => [...salesOrderKeys.all, "list"] as const,
  list: (filters: { page?: number; limit?: number }) =>
    [...salesOrderKeys.lists(), filters] as const,
  details: () => [...salesOrderKeys.all, "detail"] as const,
  detail: (id: number) => [...salesOrderKeys.details(), id] as const,
};

export function useSalesOrdersWithPagination(filters?: {
  page?: number;
  limit?: number;
}) {
  const query = useQuery({
    queryKey: salesOrderKeys.list(filters || {}),
    queryFn: () => salesOrderService.getAllOrders(filters),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
  return {
    ...query,
    data: (query.data?.data || []) as SalesOrderListItem[],
    pagination: query.data?.pagination,
  };
}

export function useSalesOrderDetail(id: number) {
  return useQuery({
    queryKey: salesOrderKeys.detail(id),
    queryFn: () => salesOrderService.getOrderById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
