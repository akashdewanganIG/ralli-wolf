import { useMutation, useQuery } from "@tanstack/react-query";
import { healthService, webhookService } from "../lib/api/services";
import { WebhookPayload } from "../lib/api/types";

// Query keys
export const webhookKeys = {
  health: ["health"] as const,
  webhookTest: ["webhook", "test"] as const,
};

// Health check hook
export function useHealth() {
  return useQuery({
    queryKey: webhookKeys.health,
    queryFn: healthService.checkHealth,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

// Webhook test hook
export function useWebhookTest() {
  return useMutation({
    mutationFn: webhookService.testLandingiWebhook,
    meta: { successMessage: "Webhook test triggered" },
  });
}

// Webhook payload submission hook
export function useWebhookSubmission() {
  return useMutation({
    mutationFn: (payload: WebhookPayload) =>
      webhookService.handleLandingiWebhook(payload),
    meta: { successMessage: "Webhook submitted" },
  });
}
