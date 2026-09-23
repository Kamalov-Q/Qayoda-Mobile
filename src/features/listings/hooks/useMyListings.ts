import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { listingApi } from "../api/listings.api";
import { useAuthStore } from "../../auth/store/auth.store";

const PAGE_SIZE = 20;

/**
 * The caller's own listings, one page at a time — a realtor can own hundreds,
 * and loading them all froze the list screen. The hook flattens the pages so
 * the screens keep reading a single array.
 */
export function useMyListings() {
  const authed = useAuthStore((s) => s.status === "authenticated");
  const query = useInfiniteQuery({
    queryKey: ["listings", "mine"],
    queryFn: ({ pageParam }) => listingApi.getMine(PAGE_SIZE, pageParam),
    initialPageParam: 0,
    // A short page is the end; a full one may have more after it.
    getNextPageParam: (lastPage, pages) =>
      lastPage.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE,
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
 * The account screen's three numbers, from their own endpoint — the lists
 * above paginate, so their lengths stopped being the totals.
 */
export function useListingCounts() {
  const authed = useAuthStore((s) => s.status === "authenticated");
  return useQuery({
    queryKey: ["listings", "counts"],
    queryFn: listingApi.getCounts,
    staleTime: 30_000,
    enabled: authed,
  });
}
