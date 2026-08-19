import { io, Socket } from "socket.io-client";
import { API_URL } from "./env";
import { useAuthStore } from "../features/auth/store/auth.store";
import { refreshSession } from "./api-client";
let socket: Socket | null = null;
let refreshing = false;

export function getChatSocket(): Socket {
  if (socket) return socket;
  socket = io(`${API_URL}/chat`, {
    transports: ["websocket"],
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });

  socket.on("auth:expired", () => void refreshAndReconnect());
  socket.on("connect_error", (err) => {
    if (/auth|unauthorized|jwt/i.test(err.message)) void refreshAndReconnect();
  });

  return socket;
}

async function refreshAndReconnect() {
  if (refreshing || !socket) return;
  refreshing = true;
  try {
    const ok = await refreshSession();
    if (ok) {
      socket.disconnect();
      socket.connect();
    }
  } finally {
    refreshing = false;
  }
}

export function disconnectChatSocket() {
  socket?.disconnect();
  socket = null;
}
