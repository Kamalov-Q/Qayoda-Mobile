import {
  io,
  type ManagerOptions,
  type Socket,
  type SocketOptions,
} from "socket.io-client";
import { API_URL } from "./env";
import { useAuthStore } from "../features/auth/store/auth.store";
import { refreshSession } from "./api-client";

/** Shared across every namespace: websocket only (no long-poll fallback —
 *  the server speaks both, but a phone that cannot hold a socket cannot hold
 *  a chat either), and a backoff that tops out at ten seconds. */
const OPTIONS = {
  transports: ["websocket"],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10_000,
} satisfies Partial<ManagerOptions & SocketOptions>;

export interface NamespaceSocket {
  /** Connects on first use and returns the same instance thereafter. */
  get(): Socket;
  /** Drops it — the next `get()` builds a fresh one. Used on sign-out, where
   *  the old socket still holds the previous account's token. */
  disconnect(): void;
}

/**
 * One lazily-created socket per namespace.
 *
 * Authenticated namespaces re-hand the access token on every (re)connect and
 * repair themselves when it expires: the server says so explicitly with
 * `auth:expired`, and also refuses the handshake, so both routes lead to one
 * refresh-and-reconnect guarded against running twice.
 *
 * Written as closures rather than a class so `const { get } = …` keeps
 * working — the call sites are plain function exports.
 */
export function namespaceSocket(
  namespace: string,
  { auth }: { auth: boolean },
): NamespaceSocket {
  let socket: Socket | null = null;
  let refreshing = false;

  const refreshAndReconnect = async () => {
    if (refreshing || !socket) return;
    refreshing = true;
    try {
      if (await refreshSession()) {
        socket.disconnect();
        socket.connect();
      }
    } finally {
      refreshing = false;
    }
  };

  return {
    get() {
      if (socket) return socket;

      socket = io(`${API_URL}${namespace}`, {
        ...OPTIONS,
        ...(auth
          ? {
              auth: (cb: (data: { token: string | null }) => void) =>
                cb({ token: useAuthStore.getState().accessToken }),
            }
          : {}),
      });

      if (auth) {
        socket.on("auth:expired", () => void refreshAndReconnect());
        socket.on("connect_error", (err: Error) => {
          if (/auth|unauthorized|jwt/i.test(err.message)) {
            void refreshAndReconnect();
          }
        });
      }

      return socket;
    },

    disconnect() {
      socket?.disconnect();
      socket = null;
    },
  };
}
