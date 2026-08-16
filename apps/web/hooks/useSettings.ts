import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsService } from "@/lib/api/services";

export const settingsKeys = {
  all: ["settings"] as const,
  global: () => [...settingsKeys.all, "global"] as const,
};

export function useGlobalSettings() {
  return useQuery({
    queryKey: settingsKeys.global(),
    queryFn: () => settingsService.getGlobalSettings(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
}

export function useUpdateGlobalSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      settingsService.updateGlobalSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.global() });
    },
  });
}
