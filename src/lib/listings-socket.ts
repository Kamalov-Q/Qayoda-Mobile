import type { Socket } from "socket.io-client";
import { namespaceSocket } from "./socket";

/**
 * The public `/listings` namespace: live counts on a listing, and nothing
 * that needs a session. Separate from the chat socket on purpose — that one
 * carries a token and disconnects anyone without one, and most people looking
 * at a listing are signed out.
 */
const listings = namespaceSocket("/listings", { auth: false });

export const getListingsSocket = () => listings.get();
export const disconnectListingsSocket = () => listings.disconnect();

/**
 * How many things on screen are watching each listing.
 *
 * Counted, because more than one can be: tapping a card on the map opens its
 * preview, and opening the listing from there pushes the detail page while
 * the map stays mounted underneath. Both watch the same room. Without a count
 * the first of them to unmount would emit `listing:unwatch` and leave the
 * other one subscribed to nothing — silently, since the socket stays
 * connected and simply stops delivering that listing's updates.
 */
const watching = new Map<string, number>();

/** Re-sent on every reconnect: a fresh socket starts in no rooms at all. */
let rejoinBound: Socket | null = null;

function bindRejoin(socket: Socket) {
  if (rejoinBound === socket) return;
  rejoinBound = socket;

  socket.on("connect", () => {
    for (const listingId of watching.keys()) {
      socket.emit("listing:watch", { listingId });
    }
  });
}

/**
 * Joins a listing's room and returns the way out. Emits to the server only
 * when the count crosses zero — the room itself is joined once however many
 * screens are interested.
 */
export function watchListing(listingId: string): () => void {
  const socket = getListingsSocket();
  bindRejoin(socket);

  const before = watching.get(listingId) ?? 0;
  watching.set(listingId, before + 1);
  if (before === 0) socket.emit("listing:watch", { listingId });

  let released = false;
  return () => {
    // Guarded: React may run a cleanup twice in development, and a double
    // release would take the count below what is actually on screen.
    if (released) return;
    released = true;

    const count = (watching.get(listingId) ?? 1) - 1;
    if (count > 0) {
      watching.set(listingId, count);
      return;
    }

    watching.delete(listingId);
    socket.emit("listing:unwatch", { listingId });
  };
}
