import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { brevoService } from "../lib/api/services";
import {
  BrevoCampaign,
  SyncLeadsResponse,
  UpdateCampaignRequest,
} from "../lib/api/types";

export function useSyncLeadsToBrevo() {
  return useMutation<SyncLeadsResponse, Error, number[]>({
    mutationFn: async (leadIds: number[]) => {
      return await brevoService.syncLeads(leadIds);
    },
  });
}

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

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (id: number) => {
      return await brevoService.deleteCampaign(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brevo", "campaigns"] });
    },
  });
}

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
      queryClient.invalidateQueries({ queryKey: ["brevo", "campaigns"] });
    },
  });
}
