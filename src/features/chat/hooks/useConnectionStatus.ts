// src/features/chat/hooks/useConnectionStatus.ts
// Your own online/offline, as the rest of the app sees it. The server marks a
// user online exactly while one of their chat sockets is connected, so the
// socket's own state is the truth here — not a guess from network reachability.
import { useEffect, useState } from "react";
import { getChatSocket } from "../../../lib/chat-socket";
import { useIsAuthed } from "../../auth/guest";

export type ConnectionStatus = "online" | "connecting" | "offline";

function read(): ConnectionStatus {
  const socket = getChatSocket();
  if (socket.connected) return "online";
  // `active` stays true while the client is still trying (first connect or a
  // reconnect after a drop) — worth showing as distinct from given up.
  return socket.active ? "connecting" : "offline";
}

/** `undefined` for guests: they have no socket and no presence to show. */
export function useConnectionStatus(): ConnectionStatus | undefined {
  const authed = useIsAuthed();
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    if (!authed) return;
    const socket = getChatSocket();
    const update = () => setStatus(read());
    update();
    socket.on("connect", update);
    socket.on("disconnect", update);
    socket.on("connect_error", update);
    // Reconnect attempts are reported by the manager, not the socket.
    socket.io.on("reconnect_attempt", update);
    socket.io.on("reconnect_failed", update);
    return () => {
      socket.off("connect", update);
      socket.off("disconnect", update);
      socket.off("connect_error", update);
      socket.io.off("reconnect_attempt", update);
      socket.io.off("reconnect_failed", update);
    };
  }, [authed]);

  return authed ? status : undefined;
}
