import { useInfiniteQuery } from "@tanstack/react-query";
import { OWNER_LISTINGS_PAGE, usersApi } from "../api/users.api";

/**
 * The pages of a profile's listings AFTER the first.
 *
 * The profile response already carries page one, so this starts where that
 * ends — refetching it would mean downloading the same twenty listings, with
 * their images, twice on every profile open.
 *
 * Idle until there is more to fetch: a seller with three ads never makes a
 * request here at all.
 */
export function useUserListings(id: string | undefined, total: number) {
  return useInfiniteQuery({
    queryKey: ["users", "listings", id],
    initialPageParam: OWNER_LISTINGS_PAGE,
    queryFn: ({ pageParam }) =>
      usersApi.getListings(id!, OWNER_LISTINGS_PAGE, pageParam),
    // A short page is the last page — no count query needed to know.
    getNextPageParam: (last, _pages, lastOffset) =>
      last.length < OWNER_LISTINGS_PAGE ? undefined : lastOffset + OWNER_LISTINGS_PAGE,
    enabled: !!id && total > OWNER_LISTINGS_PAGE,
  });
}
