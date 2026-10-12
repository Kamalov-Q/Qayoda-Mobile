import { AppState } from "react-native";
import { focusManager, MutationCache, QueryClient } from "@tanstack/react-query";
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
      // On means "when the app comes back", not "when a browser tab does"
      // — see the AppState wiring at the foot of this file. Bounded by the
      // staleTime above, so a quick switch away and back refetches nothing.
      refetchOnWindowFocus: true,
    },
  },
});

/**
 * "Focus", for a phone.
 *
 * React Query's own focus tracking listens for a browser event React Native
 * does not have, so without this `refetchOnWindowFocus` above never fires.
 * Coming back to the app is the moment to catch up on whatever changed while
 * it was away — an application approved in the dashboard, a listing sold, a
 * price moved. Only queries already past their staleTime refetch, so
 * returning twice in a minute costs nothing.
 */
AppState.addEventListener("change", (state) => {
  focusManager.setFocused(state === "active");
});
