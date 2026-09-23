import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Listing, listingApi } from "../api/listings.api";
import { queryClient } from "@/src/lib/query-client";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";
import { useAuthStore } from "../../auth/store/auth.store";

const SAVED_KEY = ["listings", "saved"] as const;
/**
 * The hearts' backing store: just the ids. Separate from the paginated list
 * so a heart deep in the feed knows its state even for a listing that is
 * pages away from being loaded in the Saved tab — and so toggling stays a
 * cheap rewrite of a string array.
 */
const SAVED_IDS_KEY = ["listings", "savedIds"] as const;

const PAGE_SIZE = 20;

type SavedPages = { pages: Listing[][]; pageParams: unknown[] };

/** The Saved tab's list, one page at a time; flattened for the screen. */
export function useSavedListings() {
  const authed = useAuthStore((s) => s.status === "authenticated");
  const query = useInfiniteQuery({
    queryKey: SAVED_KEY,
    queryFn: ({ pageParam }) => listingApi.getSaved(PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE,
    // The endpoint needs a session; firing it logged-out would only burn the
    // 401 refresh path.
    enabled: authed,
  });

  const data = useMemo(() => query.data?.pages.flat(), [query.data]);

  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}

/**
 * Whether this listing is in the saved set. Its own query subscription with
 * `select`, NOT scanning the saved list: `select` narrows the subscription to
 * one boolean, so only the toggled heart repaints — the lesson of the feed
 * stutter. Reads the ids endpoint, which is complete at any page depth.
 */
export function useIsSaved(listingId: string): boolean {
  const authed = useAuthStore((s) => s.status === "authenticated");
  const { data } = useQuery({
    queryKey: SAVED_IDS_KEY,
    queryFn: listingApi.getSavedIds,
    enabled: authed,
    select: (ids) => ids.includes(listingId),
  });
  return !!data;
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
 * One toggle for both directions. Optimistic on the ids (the hearts) and on
 * the loaded pages of the Saved tab; both are re-fetched once the server
 * answers, so the pages re-align with real save order.
 */
export function useToggleSave() {
  return useMutation({
    mutationFn: ({ listingId, next }: ToggleSaveInput) =>
      next ? listingApi.save(listingId) : listingApi.unsave(listingId),

    onMutate: async ({ listingId, listing, next }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: SAVED_IDS_KEY }),
        queryClient.cancelQueries({ queryKey: SAVED_KEY }),
      ]);
      const previousIds = queryClient.getQueryData<string[]>(SAVED_IDS_KEY);
      const previousList = queryClient.getQueryData<SavedPages>(SAVED_KEY);

      queryClient.setQueryData<string[]>(SAVED_IDS_KEY, (ids = []) => {
        const without = ids.filter((id) => id !== listingId);
        return next ? [listingId, ...without] : without;
      });

      queryClient.setQueryData<SavedPages>(SAVED_KEY, (current) => {
        if (!current) return current;
        const pages = current.pages.map((page) =>
          page.filter((l) => l.id !== listingId),
        );
        if (next && listing && pages.length) {
          pages[0] = [listing, ...pages[0]];
        }
        return { ...current, pages };
      });

      return { previousIds, previousList };
    },

    onError: (error, _vars, context) => {
      if (context?.previousIds)
        queryClient.setQueryData(SAVED_IDS_KEY, context.previousIds);
      if (context?.previousList)
        queryClient.setQueryData(SAVED_KEY, context.previousList);
      toast.error(errorMessage(error));
    },

    onSuccess: (_data, { next }) => {
      toast.successKey(next ? "saved.added" : "saved.removed");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SAVED_IDS_KEY });
      queryClient.invalidateQueries({ queryKey: SAVED_KEY });
      queryClient.invalidateQueries({ queryKey: ["listings", "counts"] });
    },
  });
}
