import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "../lib/api/services";

interface LeadsGeneratedParams {
  period?: "week" | "month";
  startDate?: string;
  endDate?: string;
}

export const dashboardKeys = {
  all: ["dashboard"] as const,
  leadsGenerated: (params?: LeadsGeneratedParams) =>
    [...dashboardKeys.all, "leads-generated", params || {}] as const,
  conversionRate: () => [...dashboardKeys.all, "conversion-rate"] as const,
  leadSources: () => [...dashboardKeys.all, "lead-sources"] as const,
  keyMetrics: () => [...dashboardKeys.all, "key-metrics"] as const,
};

export function useLeadsGeneratedOverTime(params?: LeadsGeneratedParams) {
  return useQuery({
    queryKey: dashboardKeys.leadsGenerated(params),
    queryFn: () => dashboardService.getLeadsGeneratedOverTime(params),
  });
}

export function useConversionRate() {
  return useQuery({
    queryKey: dashboardKeys.conversionRate(),
    queryFn: () => dashboardService.getConversionRate(),
  });
}

export function useLeadSources() {
  return useQuery({
    queryKey: dashboardKeys.leadSources(),
    queryFn: () => dashboardService.getLeadSources(),
  });
}

export function useKeyMetrics() {
  return useQuery({
    queryKey: dashboardKeys.keyMetrics(),
    queryFn: () => dashboardService.getKeyMetrics(),
  });
}
