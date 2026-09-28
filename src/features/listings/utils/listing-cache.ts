import { queryClient } from "@/src/lib/query-client";
import type { Listing } from "../api/listings.api";

/** The counters that move under a listing without the listing itself changing. */
export type ListingCounters = Partial<
  Pick<Listing, "viewCount" | "commentCount" | "ratingAvg" | "ratingCount">
>;

/**
 * The same listing is cached in a dozen places — the detail page, the feed,
 * the grid, the map's card, Saved, a profile, "more like this" — each under
 * its own query key. A count written to one of them leaves the other eleven
 * showing the old number, which is what made a listing say "1 view" while its
 * own card said 0.
 */
const isListing = (value: unknown): value is Listing =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  "ownerId" in value &&
  "offers" in value;

/** The keys under which a cached value may be holding listings. */
const CONTAINERS = ["pages", "items", "listings"] as const;

/**
 * Rewrites the listing wherever it appears in one cached value, and returns
 * the value UNCHANGED (same reference) when it appears nowhere — which is how
 * react-query knows not to re-render the screens reading it.
 */
function patchValue(
  value: unknown,
  id: string,
  next: (listing: Listing) => ListingCounters,
): unknown {
  if (isListing(value)) {
    return value.id === id ? { ...value, ...next(value) } : value;
  }

  if (Array.isArray(value)) {
    let changed = false;
    const mapped = value.map((entry) => {
      const patched = patchValue(entry, id, next);
      if (patched !== entry) changed = true;
      return patched;
    });
    return changed ? mapped : value;
  }

  if (typeof value === "object" && value !== null) {
    // Only the wrappers that actually hold listings — a blind walk would
    // recurse through every cached comment and message looking for an `id`.
    let changed = false;
    const copy: Record<string, unknown> = { ...(value as object) };
    for (const key of CONTAINERS) {
      if (!(key in copy)) continue;
      const patched = patchValue(copy[key], id, next);
      if (patched !== copy[key]) {
        copy[key] = patched;
        changed = true;
      }
    }
    return changed ? copy : value;
  }

  return value;
}

/**
 * Writes new counters for one listing into every cache that holds it.
 *
 * `patch` may be a function of the listing as it stands, for the counts that
 * move by a delta rather than arriving whole — a comment posted is "one more
 * than whatever it was", while a socket broadcast carries the real number.
 */
export function patchCachedListing(
  listingId: string,
  patch: ListingCounters | ((listing: Listing) => ListingCounters),
): void {
  const next = typeof patch === "function" ? patch : () => patch;

  queryClient.setQueriesData(
    {
      // Bounded to the two roots that cache listings. The viewport queries
      // under `listings` hold map features rather than listings and simply
      // come back untouched.
      predicate: (query) => {
        const [root, branch] = query.queryKey as unknown[];
        return (
          root === "listings" ||
          (root === "users" && (branch === "listings" || branch === "profile"))
        );
      },
    },
    (old) => patchValue(old, listingId, next),
  );
}
