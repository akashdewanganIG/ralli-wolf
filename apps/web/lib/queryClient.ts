import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { parseApiError } from "@/lib/api/errorHandler";

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      const message = mutation.meta?.successMessage;
      if (typeof message === "string" && message.trim()) {
        toast.success(message);
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors except 408, 429
        if (
          error?.status >= 400 &&
          error?.status < 500 &&
          error?.status !== 408 &&
          error?.status !== 429
        ) {
          return false;
        }
        // Reduced retries since backend handles retries for Brevo API calls
        // Only retry once for network/timeout errors that might slip through
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
    mutations: {
      retry: false,
      onError: error => {
        const parsed = parseApiError(error);
        console.error("[RQ mutation error]", { parsed, raw: error });
        toast.error(error);
      },
      onSuccess: _data => {
        // Success toasts should be handled per-mutation where needed
      },
    },
  },
});
