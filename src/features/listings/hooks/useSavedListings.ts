import { useMutation, useQuery } from "@tanstack/react-query";
import { Listing, listingApi } from "../api/listings.api";
import { queryClient } from "@/src/lib/query-client";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";
import { useAuthStore } from "../../auth/store/auth.store";

const SAVED_KEY = ["listings", "saved"] as const;

export function useSavedListings() {
  const authed = useAuthStore((s) => s.status === "authenticated");
  return useQuery({
    queryKey: SAVED_KEY,
    queryFn: listingApi.getSaved,
    // The endpoint needs a session; firing it logged-out would only burn the
    // 401 refresh path.
    enabled: authed,
  });
}

/** Whether this listing is in the saved set, from the cached saved feed. */
export function useIsSaved(listingId: string): boolean {
  const { data } = useSavedListings();
  return !!data?.some((l) => l.id === listingId);
}

interface ToggleSaveInput {
  listingId: string;
  /** The full listing when the caller has it (detail screen) — lets a save
   *  appear in the Saved tab instantly. Feed rows only hold a slim row model,
   *  so they omit it and the tab fills in on the refetch instead. */
  listing?: Listing;
  next: boolean;
}

/**
 * One toggle for both directions. Optimistic: the heart flips immediately by
 * rewriting the cached saved list, and rolls back if the request fails.
 */
export function useToggleSave() {
  return useMutation({
    mutationFn: ({ listingId, next }: ToggleSaveInput) =>
      next ? listingApi.save(listingId) : listingApi.unsave(listingId),

    onMutate: async ({ listingId, listing, next }) => {
      await queryClient.cancelQueries({ queryKey: SAVED_KEY });
      const previous = queryClient.getQueryData<Listing[]>(SAVED_KEY);
      queryClient.setQueryData<Listing[]>(SAVED_KEY, (current = []) => {
        const without = current.filter((l) => l.id !== listingId);
        return next && listing ? [listing, ...without] : without;
      });
      return { previous };
    },

    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(SAVED_KEY, context.previous);
      toast.error(errorMessage(error));
    },

    onSuccess: (_data, { next }) => {
      toast.successKey(next ? "saved.added" : "saved.removed");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SAVED_KEY });
    },
  });
}
