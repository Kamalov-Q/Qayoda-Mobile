import { io, Socket } from "socket.io-client";
import { API_URL } from "./env";

/**
 * The public `/listings` namespace: live view counts, and nothing that needs
 * a session. Separate from the chat socket on purpose — that one carries a
 * token and disconnects anyone without one, and most people looking at a
 * listing are signed out.
 */
let socket: Socket | null = null;

export function getListingsSocket(): Socket {
  if (socket) return socket;

  socket = io(`${API_URL}/listings`, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });

  return socket;
}

export function disconnectListingsSocket() {
  socket?.disconnect();
  socket = null;
}
