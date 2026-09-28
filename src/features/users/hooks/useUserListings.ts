import { useInfiniteQuery } from "@tanstack/react-query";
import {
  isDefaultOwnerFilters,
  OWNER_LISTINGS_PAGE,
  usersApi,
  type OwnerListingFilters,
} from "../api/users.api";

/**
 * A profile's listings, paged — and filtered, once the reader narrows them.
 *
 * Two modes, because the profile response already carries the first
 * unfiltered page:
 *
 * - Default view: this starts at offset 20 and the screen prepends what the
 *   profile gave it. Refetching page one would mean downloading the same
 *   twenty listings, with their images, twice on every profile open.
 * - Filtered: the profile's page is not this list, so this owns all of it
 *   from offset 0.
 *
 * `total` comes back per page and is the total for the filter in force, so
 * the header can say how many the reader is actually looking at.
 */
export function useUserListings(
  id: string | undefined,
  filters: OwnerListingFilters,
  /** The seller's unfiltered total, from the profile — see `enabled`. */
  unfilteredTotal: number,
) {
  const isDefault = isDefaultOwnerFilters(filters);
  const startAt = isDefault ? OWNER_LISTINGS_PAGE : 0;

  return useInfiniteQuery({
    queryKey: ["users", "listings", id, filters] as const,
    initialPageParam: startAt,
    queryFn: ({ pageParam }) =>
      usersApi.getListings(id!, filters, OWNER_LISTINGS_PAGE, pageParam),
    getNextPageParam: (last, _pages, lastOffset) => {
      const next = lastOffset + OWNER_LISTINGS_PAGE;
      return next < last.total ? next : undefined;
    },
    // In the default view a seller with three ads never makes a request here
    // at all: the profile already handed over everything they have.
    enabled: !!id && (!isDefault || unfilteredTotal > OWNER_LISTINGS_PAGE),
    staleTime: 60_000,
  });
}
