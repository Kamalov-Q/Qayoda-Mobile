import { namespaceSocket } from "./socket";

/** The `/chat` namespace: one-to-one conversations, typing and read receipts.
 *  Authenticated — the gateway disconnects anyone without a valid token. */
const chat = namespaceSocket("/chat", { auth: true });

export const getChatSocket = () => chat.get();
export const disconnectChatSocket = () => chat.disconnect();
