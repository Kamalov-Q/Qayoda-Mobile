import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listingApi } from "../api/listings.api";
import { patchCachedListing } from "../utils/listing-cache";
import { getListingsSocket, watchListing } from "@/src/lib/listings-socket";

/**
 * What the server pushes when one of a listing's counters moves. Every field
 * is optional: a broadcast says only what changed.
 */
export interface ListingStats {
  listingId: string;
  viewCount?: number;
  commentCount?: number;
  ratingAvg?: number;
  ratingCount?: number;
}

/** The fields a broadcast may patch, i.e. everything but the id. */
type StatsPatch = Omit<ListingStats, "listingId">;

/**
 * Keeps an open listing live.
 *
 * Joins the listing's room, so its numbers move while it is on screen rather
 * than only on the next load — views, comments and the rating all arrive on
 * one event — and, unless told otherwise, records this person's view first.
 *
 * It patches the QUERY CACHE rather than returning state, and patches it
 * EVERYWHERE the listing is cached rather than only on the detail page. The
 * same listing sits in the feed, the grid, the map's card, Saved and a
 * profile under five different keys; writing to one of them is what let a
 * listing say "1 view" while its own card in the feed said 0.
 */
export function useListingLive(
  listingId: string | undefined,
  /** False for a card that merely previews the listing — a glance at a card
   *  on the map is not a visit, and should not count as one. */
  { recordView = true }: { recordView?: boolean } = {},
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!listingId) return;

    let alive = true;

    const patch = (stats: StatsPatch) => {
      if (!alive) return;

      patchCachedListing(listingId, stats);

      // A moved counter means the list behind it moved too, so the rows are
      // refetched as well as the number. Deliberately NOT done for views:
      // that one fires for every person who opens the page, and nothing on
      // screen depends on who they were.
      if (stats.commentCount !== undefined) {
        void queryClient.invalidateQueries({
          queryKey: ["comments", listingId],
        });
      }
      if (stats.ratingAvg !== undefined || stats.ratingCount !== undefined) {
        void queryClient.invalidateQueries({
          queryKey: ["reviews", listingId],
        });
      }
    };

    // Failure here is silent on purpose: a view that did not register is not
    // something to interrupt a reader for, and the count on screen is still
    // the one the listing came with.
    if (recordView) {
      listingApi
        .recordView(listingId)
        .then((res) => patch({ viewCount: res.viewCount }))
        .catch(() => {});
    }

    const socket = getListingsSocket();
    const onStats = ({ listingId: id, ...rest }: ListingStats) => {
      if (id === listingId) patch(rest);
    };

    socket.on("listing:stats", onStats);
    // Counted rather than emitted here: the map's card and the detail page
    // can watch the same listing at once, and whichever closed first used to
    // leave the other subscribed to nothing.
    const unwatch = watchListing(listingId);

    return () => {
      alive = false;
      socket.off("listing:stats", onStats);
      unwatch();
    };
  }, [listingId, recordView, queryClient]);
}
