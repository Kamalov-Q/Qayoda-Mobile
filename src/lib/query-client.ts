import { MutationCache, QueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ApiError } from "./api-client";
import { toast } from "../components/ui/Toast";

/**
 * The phone gate, caught centrally. Most callers ask `requirePhone()` before
 * they start, but not every write does — posting a listing is several screens
 * of work before the first request — and a plain "403" toast at the end of
 * that would tell the writer nothing about how to fix it. Whoever gets the
 * code, wherever it comes from, lands in the same add-a-number flow.
 */
const mutationCache = new MutationCache({
  onError: (error) => {
    if (error instanceof ApiError && error.code === "PHONE_REQUIRED") {
      toast.errorKey("auth.phoneRequired");
      router.push("/link-phone");
    }
  },
});

export const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 60_000, // don't refetch data younger than 1min on remount/focus
      gcTime: 5 * 60_000, // keep unused cache 5min — instant back-navigation
      retry: 1,
      refetchOnWindowFocus: false, // RN has no "window focus"; avoids surprise refetches
    },
  },
});
