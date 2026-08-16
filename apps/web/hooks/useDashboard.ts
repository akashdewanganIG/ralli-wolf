import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "../lib/api/services";

interface LeadsGeneratedParams {
  period?: "week" | "month";
  startDate?: string;
  endDate?: string;
}

// Query keys
export const dashboardKeys = {
  all: ["dashboard"] as const,
  leadsGenerated: (params?: LeadsGeneratedParams) =>
    [...dashboardKeys.all, "leads-generated", params || {}] as const,
  conversionRate: () => [...dashboardKeys.all, "conversion-rate"] as const,
  leadSources: () => [...dashboardKeys.all, "lead-sources"] as const,
  keyMetrics: () => [...dashboardKeys.all, "key-metrics"] as const,
};

// Hook for leads generated over time
export function useLeadsGeneratedOverTime(params?: LeadsGeneratedParams) {
  return useQuery({
    queryKey: dashboardKeys.leadsGenerated(params),
    queryFn: () => dashboardService.getLeadsGeneratedOverTime(params),
  });
}

// Hook for conversion rate
export function useConversionRate() {
  return useQuery({
    queryKey: dashboardKeys.conversionRate(),
    queryFn: () => dashboardService.getConversionRate(),
  });
}

// Hook for lead sources
export function useLeadSources() {
  return useQuery({
    queryKey: dashboardKeys.leadSources(),
    queryFn: () => dashboardService.getLeadSources(),
  });
}

// Hook for key metrics
export function useKeyMetrics() {
  return useQuery({
    queryKey: dashboardKeys.keyMetrics(),
    queryFn: () => dashboardService.getKeyMetrics(),
  });
}
