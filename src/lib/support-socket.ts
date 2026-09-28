import { namespaceSocket } from "./socket";

/**
 * The `/support` namespace. Authenticated like the chat socket — a support
 * thread is private — but separate from it, because "every admin on duty" is
 * a room that has no meaning in a peer-to-peer chat.
 */
const support = namespaceSocket("/support", { auth: true });

export const getSupportSocket = () => support.get();
export const disconnectSupportSocket = () => support.disconnect();
