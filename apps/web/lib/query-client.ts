import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";

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
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error: unknown) => {
        const status =
          typeof error === "object" &&
          error !== null &&
          "status" in error &&
          typeof error.status === "number"
            ? error.status
            : null;

        if (
          status !== null &&
          status >= 400 &&
          status < 500 &&
          status !== 408 &&
          status !== 429
        ) {
          return false;
        }

        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
    mutations: {
      retry: false,
      onError: error => {
        toast.error(error);
      },
    },
  },
});
