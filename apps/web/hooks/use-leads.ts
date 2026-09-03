import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadService } from "../lib/api/services";
import {
  Lead,
  LeadAssignmentStats,
  LeadFilters,
  PaginatedApiResponse,
} from "../lib/api/types";

export const leadKeys = {
  all: ["leads"] as const,
  lists: () => [...leadKeys.all, "list"] as const,
  list: (filters: LeadFilters & { page?: number; limit?: number }) =>
    [
      ...leadKeys.lists(),
      { page: filters?.page, limit: filters?.limit, ...filters },
    ] as const,
  details: () => [...leadKeys.all, "detail"] as const,
  detail: (id: number) => [...leadKeys.details(), id] as const,
  assignmentStats: () => [...leadKeys.all, "assignment-stats"] as const,
};

export function useLeads(
  filters?: LeadFilters & { page?: number; limit?: number }
) {
  return useQuery({
    queryKey: leadKeys.list(filters || {}),
    queryFn: () => leadService.getAllLeads(filters),
  });
}

export function useLeadsWithPagination(
  filters?: LeadFilters & { page?: number; limit?: number },
  options?: { enabled?: boolean }
) {
  const queryKey = leadKeys.list(filters || {});

  const query = useQuery({
    queryKey,
    queryFn: () => leadService.getAllLeads(filters),
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

export function useLead(id: number) {
  return useQuery({
    queryKey: leadKeys.detail(id),
    queryFn: () => leadService.getLeadById(id),
    enabled: !!id,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leadService.createLead,
    meta: { successMessage: "Lead created successfully" },
    onSuccess: response => {
      const newLead = response.lead;

      const allListQueries = queryClient.getQueriesData<
        PaginatedApiResponse<Lead>
      >({
        queryKey: leadKeys.lists(),
      });

      allListQueries.forEach(([queryKey, oldData]) => {
        if (!oldData) return;

        const queryParams =
          Array.isArray(queryKey) &&
          queryKey.length > 2 &&
          typeof queryKey[2] === "object"
            ? (queryKey[2] as { page?: number })
            : null;
        const isPageOne =
          !queryParams ||
          queryParams.page === 1 ||
          queryParams.page === undefined;

        const updatedData: PaginatedApiResponse<Lead> = {
          ...oldData,
          data: isPageOne ? [newLead, ...oldData.data] : oldData.data,
          pagination: {
            ...oldData.pagination,
            totalItems: (oldData.pagination?.totalItems || 0) + 1,
            totalPages: oldData.pagination?.totalPages
              ? Math.ceil(
                  ((oldData.pagination.totalItems || 0) + 1) /
                    (oldData.pagination.itemsPerPage || 10)
                )
              : oldData.pagination?.totalPages,
          },
        };

        queryClient.setQueryData(queryKey, updatedData);
      });

      queryClient.refetchQueries({
        queryKey: leadKeys.lists(),
        type: "active",
      });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Lead> }) =>
      leadService.updateLead(id, data),
    meta: { successMessage: "Lead updated successfully" },
    onSuccess: response => {
      queryClient.setQueryData(
        leadKeys.detail(response.lead.id),
        response.lead
      );

      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });

      queryClient.invalidateQueries({
        queryKey: leadKeys.detail(response.lead.id),
        refetchType: "none",
      });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leadService.deleteLead,
    meta: { successMessage: "Lead deleted successfully" },
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: leadKeys.detail(deletedId) });

      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
    },
  });
}

export function useAssignLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: number }) =>
      leadService.assignLead(id, userId),
    meta: { successMessage: "Lead assigned successfully" },
    onSuccess: updatedLead => {
      queryClient.setQueryData(leadKeys.detail(updatedLead.id), updatedLead);

      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
    },
  });
}

export function useAssignLeadsBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, leadIds }: { userId: number; leadIds: number[] }) =>
      leadService.assignLeadsBulk(userId, leadIds),
    meta: { successMessage: "Leads assigned successfully" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

export function useAssignmentStats(options?: { enabled?: boolean }) {
  return useQuery<LeadAssignmentStats[]>({
    queryKey: leadKeys.assignmentStats(),
    queryFn: () => leadService.getAssignmentStats(),
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useConvertLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { keywordIds?: number[] };
    }) => leadService.convertLead(id, data),
    meta: { successMessage: "Lead converted successfully" },
    onSuccess: (_, { id: leadId }) => {
      queryClient.removeQueries({ queryKey: leadKeys.detail(leadId) });

      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });

      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useConvertLeadsBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leads: Array<{ leadId: number; keywordIds?: number[] }>) =>
      leadService.convertLeadsBulk(leads),
    meta: { successMessage: "Leads converted successfully" },
    onSuccess: (_, leads) => {
      leads.forEach(({ leadId }) => {
        queryClient.removeQueries({ queryKey: leadKeys.detail(leadId) });
      });

      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });

      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
