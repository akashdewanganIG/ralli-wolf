import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { brevoService } from "../lib/api/services";
import {
  BrevoCampaign,
  SyncLeadsResponse,
  UpdateCampaignRequest,
} from "../lib/api/types";

/**
 * Hook for syncing leads to Brevo
 */
export function useSyncLeadsToBrevo() {
  return useMutation<SyncLeadsResponse, Error, number[]>({
    mutationFn: async (leadIds: number[]) => {
      return await brevoService.syncLeads(leadIds);
    },
  });
}

/**
 * Hook for getting Brevo analytics
 */
export function useBrevoAnalytics() {
  // This could be implemented as a query if needed
  return useMutation({
    mutationFn: async () => {
      return await brevoService.getAnalytics();
    },
  });
}

/**
 * Hook for fetching Brevo email campaigns
 */
export function useBrevoCampaigns(params?: {
  limit?: number;
  offset?: number;
  status?: string;
}) {
  const { limit = 50, offset = 0, status } = params || {};
  return useQuery<{ campaigns: BrevoCampaign[]; count: number; total: number }>(
    {
      queryKey: ["brevo", "campaigns", { limit, offset, status }],
      queryFn: async () => brevoService.getCampaigns({ limit, offset, status }),
    }
  );
}

/**
 * Hook for deleting a Brevo campaign
 */
export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (id: number) => {
      return await brevoService.deleteCampaign(id);
    },
    onSuccess: () => {
      // Invalidate campaigns query to refetch the list
      queryClient.invalidateQueries({ queryKey: ["brevo", "campaigns"] });
    },
  });
}

/**
 * Hook for updating a Brevo campaign
 */
export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation<
    BrevoCampaign,
    Error,
    { id: number; data: UpdateCampaignRequest }
  >({
    mutationFn: async ({ id, data }) => {
      return await brevoService.updateCampaign(id, data);
    },
    onSuccess: () => {
      // Invalidate campaigns query to refetch the list
      queryClient.invalidateQueries({ queryKey: ["brevo", "campaigns"] });
    },
  });
}

/**
 * Hook for updating a Brevo campaign status
 */
export function useUpdateCampaignStatus() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: number; status: string }>({
    mutationFn: async ({ id, status }) => {
      return await brevoService.updateCampaignStatus(id, status);
    },
    onSuccess: () => {
      // Invalidate campaigns query to refetch the list
      queryClient.invalidateQueries({ queryKey: ["brevo", "campaigns"] });
    },
  });
}
