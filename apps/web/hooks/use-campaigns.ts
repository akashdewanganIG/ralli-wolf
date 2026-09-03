import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { campaignService } from "../lib/api/services";
import { Campaign, CampaignFilters } from "../lib/api/types";

export const campaignKeys = {
  all: ["campaigns"] as const,
  lists: () => [...campaignKeys.all, "list"] as const,
  list: (filters: CampaignFilters) =>
    [...campaignKeys.lists(), filters] as const,
  details: () => [...campaignKeys.all, "detail"] as const,
  detail: (id: number) => [...campaignKeys.details(), id] as const,
};

export function useCampaigns(filters?: CampaignFilters) {
  return useQuery({
    queryKey: campaignKeys.list(filters || {}),
    queryFn: () => campaignService.getAllCampaigns(filters),
  });
}

export function useCampaign(id: number) {
  return useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: () => campaignService.getCampaignById(id),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: campaignService.createCampaign,
    meta: { successMessage: "Campaign created successfully" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.all });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Campaign> }) =>
      campaignService.updateCampaign(id, data),
    meta: { successMessage: "Campaign updated successfully" },
    onSuccess: updatedCampaign => {
      queryClient.setQueryData(
        campaignKeys.detail(updatedCampaign.id),
        updatedCampaign
      );

      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: campaignService.deleteCampaign,
    meta: { successMessage: "Campaign deleted successfully" },
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: campaignKeys.detail(deletedId) });

      queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
    },
  });
}
