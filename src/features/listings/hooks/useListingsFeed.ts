import { useInfiniteQuery } from "@tanstack/react-query";
import { listingApi, type FeedFilters } from "../api/listings.api";

export const FEED_PAGE_SIZE = 20;

/**
 * The list/grid views' data, paged: 20 at a time, the next page pulled as the
 * user nears the bottom. A short page means the end — no count endpoint
 * needed.
 */
export function useListingsFeed(filters: FeedFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["listings", "feed", filters] as const,
    queryFn: ({ pageParam }) =>
      listingApi.getFeed(filters, FEED_PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _all, lastOffset) =>
      lastPage.length === FEED_PAGE_SIZE
        ? lastOffset + FEED_PAGE_SIZE
        : undefined,
    staleTime: 30_000,
    gcTime: 120_000,
    enabled,
  });
}
