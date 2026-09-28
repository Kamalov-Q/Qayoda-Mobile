import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listingApi, type Listing } from "../api/listings.api";
import { getListingsSocket } from "@/src/lib/listings-socket";

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
 * Two jobs on mount: record this person's view (the server decides whether it
 * counts) and join the listing's room, so its numbers move while the page is
 * open rather than only on the next load. Views, comments and the rating all
 * arrive on one event.
 *
 * It patches the QUERY CACHE rather than returning state. The page already
 * reads `listing.viewCount`, `listing.commentCount` and `listing.ratingAvg`
 * from that cache; writing there means every one of them updates with nothing
 * else to wire up, and a comment posted on another screen — which invalidates
 * nothing here — still moves the number under the title.
 */
export function useListingLive(listingId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!listingId) return;

    let alive = true;

    const patch = (stats: StatsPatch) => {
      if (!alive) return;

      queryClient.setQueryData<Listing>(
        ["listings", "detail", listingId],
        // Only when the listing is actually cached: seeding a partial row
        // from a socket payload would hand the screen a Listing with no
        // photos, no price and no owner.
        (old) => (old ? { ...old, ...stats } : old),
      );

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
    listingApi
      .recordView(listingId)
      .then((res) => patch({ viewCount: res.viewCount }))
      .catch(() => {});

    const socket = getListingsSocket();
    const onStats = ({ listingId: id, ...rest }: ListingStats) => {
      if (id === listingId) patch(rest);
    };

    socket.on("listing:stats", onStats);
    socket.emit("listing:watch", { listingId });
    // A reconnect starts in no rooms at all, so the watch has to be re-sent.
    const rejoin = () => socket.emit("listing:watch", { listingId });
    socket.on("connect", rejoin);

    return () => {
      alive = false;
      socket.off("listing:stats", onStats);
      socket.off("connect", rejoin);
      socket.emit("listing:unwatch", { listingId });
    };
  }, [listingId, queryClient]);
}
