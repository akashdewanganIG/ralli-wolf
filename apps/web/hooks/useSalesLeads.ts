import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { leadService } from "../lib/api/services";

// Hook to fetch leads assigned to the current user
export function useSalesLeads(options?: { enabled?: boolean }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["salesLeads", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }
      return await leadService.getLeadsByOwner(user.id);
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

// Hook to update lead status with remarks
export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      leadId,
      status,
      remark,
    }: {
      leadId: number;
      status: string;
      remark: string;
    }) => {
      // Note: Only status is saved to DB since Lead model doesn't have a remarks field
      // Remarks are kept client-side for validation only
      await leadService.updateLead(leadId, {
        status: status as any,
      });

      return { leadId, status, remark };
    },
    meta: { successMessage: "Lead status updated" },
    onSuccess: () => {
      // Invalidate sales leads list to refetch
      queryClient.invalidateQueries({ queryKey: ["salesLeads"] });
    },
  });
}
