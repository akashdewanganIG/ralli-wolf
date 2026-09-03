import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "../lib/api/services";
import { User, UserFilters } from "../lib/api/types";

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: UserFilters & { page?: number; limit?: number }) =>
    [
      ...userKeys.lists(),
      { page: filters?.page, limit: filters?.limit, ...filters },
    ] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: number) => [...userKeys.details(), id] as const,
};

export function useUsers(
  filters?: UserFilters & { page?: number; limit?: number },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: userKeys.list(filters || {}),
    queryFn: () => userService.getAllUsers(filters),
    enabled: options?.enabled ?? true,
  });
}

export function useUsersWithPagination(
  filters?: UserFilters & { page?: number; limit?: number },
  options?: { enabled?: boolean }
) {
  const queryKey = userKeys.list(filters || {});

  const query = useQuery({
    queryKey,
    queryFn: () => userService.getAllUsers(filters),
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  return {
    ...query,
    data: query.data?.data || [],
    pagination: query.data?.pagination,
  };
}

export function useUser(id: number) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => userService.getUserById(id),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userService.createUser,
    meta: { successMessage: "User created successfully" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) =>
      userService.updateUser(id, data),
    meta: { successMessage: "User updated successfully" },
    onSuccess: updatedUser => {
      queryClient.setQueryData(userKeys.detail(updatedUser.id), updatedUser);

      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userService.deleteUser,
    meta: { successMessage: "User deleted successfully" },
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: userKeys.detail(deletedId) });

      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
