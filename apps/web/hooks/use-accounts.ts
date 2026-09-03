import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountService } from "../lib/api/services";
import { Account } from "../lib/api/types";

export const accountKeys = {
  all: ["accounts"] as const,
  lists: () => [...accountKeys.all, "list"] as const,
  list: (filters: { page?: number; limit?: number }) =>
    [
      ...accountKeys.lists(),
      { page: filters?.page, limit: filters?.limit },
    ] as const,
  details: () => [...accountKeys.all, "detail"] as const,
  detail: (id: number) => [...accountKeys.details(), id] as const,
};

export function useAccounts(filters?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: accountKeys.list(filters || {}),
    queryFn: () => accountService.getAllAccounts(filters),
  });
}

export function useAccountsWithPagination(
  filters?: { page?: number; limit?: number },
  options?: { enabled?: boolean }
) {
  const queryKey = accountKeys.list(filters || {});

  const query = useQuery({
    queryKey,
    queryFn: () => accountService.getAllAccounts(filters),
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    ...query,
    data: query.data?.data || [],
    pagination: query.data?.pagination,
  };
}

export function useAccount(id: number) {
  return useQuery({
    queryKey: accountKeys.detail(id),
    queryFn: () => accountService.getAccountDetails(id),
    enabled: !!id,
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: accountService.deleteAccount,
    meta: { successMessage: "Account deleted successfully" },
    onSuccess: (_: void, deletedId: number) => {
      queryClient.removeQueries({ queryKey: accountKeys.detail(deletedId) });

      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Account> }) =>
      accountService.updateAccount(id, data),
    meta: { successMessage: "Account updated successfully" },
    onSuccess: updated => {
      queryClient.setQueryData(accountKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
    },
  });
}
