import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // don't refetch data younger than 1min on remount/focus
      gcTime: 5 * 60_000, // keep unused cache 5min — instant back-navigation
      retry: 1,
      refetchOnWindowFocus: false, // RN has no "window focus"; avoids surprise refetches
    },
  },
});
