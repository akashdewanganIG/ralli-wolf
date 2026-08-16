import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "../lib/api/services";
import { User, UserFilters, UserPermissions } from "../lib/api/types";

// Query keys
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

// Hooks for fetching users
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

// Hook that returns both data and pagination metadata
export function useUsersWithPagination(
  filters?: UserFilters & { page?: number; limit?: number },
  options?: { enabled?: boolean }
) {
  const queryKey = userKeys.list(filters || {});

  const query = useQuery({
    queryKey,
    queryFn: () => {
      console.log(
        "🔄 Fetching users - Page:",
        filters?.page,
        "Limit:",
        filters?.limit
      );
      return userService.getAllUsers(filters);
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

export function useUser(id: number) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => userService.getUserById(id),
    enabled: !!id,
  });
}

// Hooks for user mutations
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userService.createUser,
    meta: { successMessage: "User created successfully" },
    onSuccess: () => {
      // Invalidate and refetch users
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
      // Update the specific user in cache
      queryClient.setQueryData(userKeys.detail(updatedUser.id), updatedUser);
      // Invalidate lists to refetch
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
      // Remove the user from cache
      queryClient.removeQueries({ queryKey: userKeys.detail(deletedId) });
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

export function useUpdateUserPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      permissions,
    }: {
      id: number;
      permissions: Partial<UserPermissions>;
    }) => userService.updateUserPermissions(id, permissions),
    meta: { successMessage: "Permissions updated successfully" },
    onSuccess: (updatedPermissions, { id }) => {
      // Update the user's permissions in cache
      queryClient.setQueryData(
        userKeys.detail(id),
        (oldUser: User | undefined) => {
          if (oldUser) {
            return { ...oldUser, permissions: updatedPermissions };
          }
          return oldUser;
        }
      );
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
