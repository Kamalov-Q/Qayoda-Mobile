import { useCallback, useEffect, useState } from "react";
import { listingApi } from "../api/listings.api";
import { getListingsSocket } from "@/src/lib/listings-socket";

interface ViewsPayload {
  listingId: string;
  viewCount: number;
}

/**
 * The live viewer count for one listing.
 *
 * Does two things on mount: records this person's view (the server decides
 * whether it counts) and joins the listing's room, so the number moves while
 * the page is open rather than only on the next load.
 *
 * `initial` comes from the listing itself, so the count is on screen
 * immediately and the request only ever corrects it.
 */
export function useListingViews(
  listingId: string | undefined,
  initial: number,
) {
  // Keyed by listing rather than reset by an effect: when `listingId`
  // changes the stored value stops matching and `initial` takes over on the
  // very next render, with no intermediate frame showing the old listing's
  // number.
  const [live, setLive] = useState<{ id: string; count: number } | null>(null);
  const count = live && live.id === listingId ? live.count : initial;
  const setCount = useCallback(
    (next: number) => {
      if (listingId) setLive({ id: listingId, count: next });
    },
    [listingId],
  );

  useEffect(() => {
    if (!listingId) return;

    let alive = true;

    // Failure here is silent on purpose: a view that did not register is not
    // something to interrupt a reader for, and the count on screen is still
    // the one the listing came with.
    listingApi
      .recordView(listingId)
      .then((res) => alive && setCount(res.viewCount))
      .catch(() => {});

    const socket = getListingsSocket();
    const onViews = (payload: ViewsPayload) => {
      if (payload.listingId === listingId) setCount(payload.viewCount);
    };

    socket.on("listing:views", onViews);
    socket.emit("listing:watch", { listingId });
    // A reconnect starts in no rooms at all, so the watch has to be re-sent.
    const rejoin = () => socket.emit("listing:watch", { listingId });
    socket.on("connect", rejoin);

    return () => {
      alive = false;
      socket.off("listing:views", onViews);
      socket.off("connect", rejoin);
      socket.emit("listing:unwatch", { listingId });
    };
  }, [listingId, setCount]);

  return count;
}
