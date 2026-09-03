import { useQuery } from "@tanstack/react-query";
import { healthService } from "../lib/api/services";

export const healthKeys = {
  status: ["health"] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: healthKeys.status,
    queryFn: healthService.checkHealth,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}
