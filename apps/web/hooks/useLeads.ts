import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadService } from "../lib/api/services";
import {
  Lead,
  LeadAssignmentStats,
  LeadFilters,
  PaginatedApiResponse,
} from "../lib/api/types";

// Query keys
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
  complete: () => [...leadKeys.all, "complete"] as const,
  assignmentStats: () => [...leadKeys.all, "assignment-stats"] as const,
};

// Hooks for fetching leads
export function useLeads(
  filters?: LeadFilters & { page?: number; limit?: number }
) {
  return useQuery({
    queryKey: leadKeys.list(filters || {}),
    queryFn: () => leadService.getAllLeads(filters),
  });
}

// Hook that returns both data and pagination metadata
export function useLeadsWithPagination(
  filters?: LeadFilters & { page?: number; limit?: number },
  options?: { enabled?: boolean }
) {
  const queryKey = leadKeys.list(filters || {});

  const query = useQuery({
    queryKey,
    queryFn: () => {
      console.log(
        "🔄 Fetching leads - Page:",
        filters?.page,
        "Limit:",
        filters?.limit
      );
      return leadService.getAllLeads(filters);
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

export function useLeadsComplete(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: leadKeys.complete(),
    queryFn: leadService.getAllLeadsComplete,
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
}

export function useLead(id: number) {
  return useQuery({
    queryKey: leadKeys.detail(id),
    queryFn: () => leadService.getLeadById(id),
    enabled: !!id,
  });
}

// Hooks for lead mutations
export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leadService.createLead,
    meta: { successMessage: "Lead created successfully" },
    onSuccess: response => {
      const newLead = response.lead;

      // Optimistically update list queries to include the new lead
      // This ensures the UI updates immediately without waiting for refetch
      const allListQueries = queryClient.getQueriesData<
        PaginatedApiResponse<Lead>
      >({
        queryKey: leadKeys.lists(),
      });

      allListQueries.forEach(([queryKey, oldData]) => {
        if (!oldData) return;

        // Check if this is a page 1 query (new leads appear on first page)
        // Page defaults to 1 if not specified
        const queryParams =
          Array.isArray(queryKey) &&
          queryKey.length > 2 &&
          typeof queryKey[2] === "object"
            ? (queryKey[2] as any)
            : null;
        const isPageOne =
          !queryParams ||
          queryParams.page === 1 ||
          queryParams.page === undefined;

        // Add the new lead to the beginning of the data array for page 1
        // For other pages, just update pagination counts
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

      // Force refetch active queries to ensure data consistency
      // This will update the UI with server data after the optimistic update
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
      // Update the specific lead in cache with the lead from response
      // This ensures the UI updates immediately with the latest data including convertedToContactId
      queryClient.setQueryData(
        leadKeys.detail(response.lead.id),
        response.lead
      );
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
      // Invalidate the specific lead detail query but don't refetch immediately
      // The cache update above ensures UI is updated, and this marks it as stale for next access
      queryClient.invalidateQueries({
        queryKey: leadKeys.detail(response.lead.id),
        refetchType: "none", // Don't refetch immediately, use cached data
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
      // Remove the lead from cache
      queryClient.removeQueries({ queryKey: leadKeys.detail(deletedId) });
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
    },
  });
}

// Filter and search hooks
export function useFilterLeads(filters: LeadFilters) {
  return useQuery({
    queryKey: [...leadKeys.lists(), "filter", filters],
    queryFn: () => leadService.filterLeads(filters),
  });
}

export function useSearchLeads(query: string) {
  return useQuery({
    queryKey: [...leadKeys.lists(), "search", query],
    queryFn: () => leadService.searchLeads(query),
    enabled: !!query && query.length > 2,
  });
}

export function useLeadsByStatus(status: string) {
  return useQuery({
    queryKey: [...leadKeys.lists(), "status", status],
    queryFn: () => leadService.getLeadsByStatus(status),
    enabled: !!status,
  });
}

export function useLeadsBySource(source: string) {
  return useQuery({
    queryKey: [...leadKeys.lists(), "source", source],
    queryFn: () => leadService.getLeadsBySource(source),
    enabled: !!source,
  });
}

export function useLeadsByOwner(
  ownerId: number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [...leadKeys.lists(), "owner", ownerId],
    queryFn: () => {
      console.log("🔍 useLeadsByOwner → fetching for ownerId:", ownerId);
      return leadService.getLeadsByOwner(ownerId);
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!ownerId,
  });
}

export function useLeadsByScore(minScore?: number, maxScore?: number) {
  return useQuery({
    queryKey: [...leadKeys.lists(), "score", { minScore, maxScore }],
    queryFn: () => leadService.getLeadsByScore(minScore, maxScore),
  });
}

// Assignment hooks
export function useAssignLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: number }) =>
      leadService.assignLead(id, userId),
    meta: { successMessage: "Lead assigned successfully" },
    onSuccess: updatedLead => {
      // Update the specific lead in cache
      queryClient.setQueryData(leadKeys.detail(updatedLead.id), updatedLead);
      // Invalidate lists to refetch
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
      // Invalidate all lead queries
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

// Claim hooks
export function useClaimLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leadService.claimLead,
    meta: { successMessage: "Lead claimed successfully" },
    onSuccess: updatedLead => {
      // Update the specific lead in cache
      queryClient.setQueryData(leadKeys.detail(updatedLead.id), updatedLead);
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
    },
  });
}

export function useClaimLeadsBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, leadIds }: { userId: number; leadIds: number[] }) =>
      leadService.claimLeadsBulk({ userId, leadIds }),
    meta: { successMessage: "Leads claimed successfully" },
    onSuccess: () => {
      // Invalidate all lead queries
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

// Conversion hooks
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
    onSuccess: (response, { id: leadId }) => {
      console.log("Lead conversion successful, invalidating caches:", {
        leadId,
        response,
      });
      // Remove the lead from cache as it's now converted
      queryClient.removeQueries({ queryKey: leadKeys.detail(leadId) });
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
      // Invalidate contacts as well
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      console.log("Cache invalidation completed");
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
      // Remove converted leads from cache
      leads.forEach(({ leadId }) => {
        queryClient.removeQueries({ queryKey: leadKeys.detail(leadId) });
      });
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
      // Invalidate contacts as well
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useConversionHistory(leadId: number) {
  return useQuery({
    queryKey: [...leadKeys.detail(leadId), "conversion-history"],
    queryFn: () => leadService.getConversionHistory(leadId),
    enabled: !!leadId,
  });
}

// Scoring hooks
export function useUpdateLeadScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, score }: { id: number; score: number }) =>
      leadService.updateLeadScore(id, score),
    meta: { successMessage: "Lead score updated" },
    onSuccess: updatedLead => {
      // Update the specific lead in cache
      queryClient.setQueryData(leadKeys.detail(updatedLead.id), updatedLead);
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
    },
  });
}
