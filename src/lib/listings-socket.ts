import { namespaceSocket } from "./socket";

/**
 * The public `/listings` namespace: live view counts, and nothing that needs
 * a session. Separate from the chat socket on purpose — that one carries a
 * token and disconnects anyone without one, and most people looking at a
 * listing are signed out.
 */
const listings = namespaceSocket("/listings", { auth: false });

export const getListingsSocket = () => listings.get();
export const disconnectListingsSocket = () => listings.disconnect();
