// src/features/chat/hooks/usePresence.ts
// Online/offline for any one user — a profile, a listing's owner — not just
// the people already in your inbox.
//
// The socket only pushes `presence` to counterparts (people you have a
// conversation with), so for anyone else the status is asked for with
// `presence:check` and refreshed on an interval. Where a push does arrive it
// lands in the same cache entry, so a counterpart's dot flips immediately.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getChatSocket } from "../../../lib/chat-socket";
import { queryClient } from "../../../lib/query-client";
import { useIsAuthed } from "../../auth/guest";
import { t as translate } from "../../../i18n";
import type { Language } from "../../../i18n/types";

export interface Presence {
  online: boolean;
  lastSeenAt: string | null;
}

interface PresenceEvent extends Presence {
  userId: string;
}

// Long enough not to hammer the gateway from a profile left open, short
// enough that "online" is never more than a minute stale for a stranger.
const RECHECK_MS = 60_000;
const ACK_TIMEOUT_MS = 5_000;

export const presenceKey = (userId: string) => ["presence", userId] as const;

async function fetchPresence(userId: string): Promise<Presence | null> {
  const rows: PresenceEvent[] = await getChatSocket()
    .timeout(ACK_TIMEOUT_MS)
    .emitWithAck("presence:check", { userIds: [userId] });
  const row = rows.find((r) => r.userId === userId);
  return row ? { online: row.online, lastSeenAt: row.lastSeenAt } : null;
}

/**
 * Live presence for one user, or `undefined` while unknown. Signed-out viewers
 * always get `undefined`: the socket only accepts authenticated clients, and
 * showing a guess would be worse than showing nothing.
 */
export function usePresence(userId: string | undefined): Presence | null | undefined {
  const authed = useIsAuthed();
  const enabled = authed && !!userId;

  const { data } = useQuery({
    queryKey: presenceKey(userId ?? ""),
    queryFn: () => fetchPresence(userId!),
    enabled,
    refetchInterval: RECHECK_MS,
    staleTime: RECHECK_MS / 2,
  });

  useEffect(() => {
    if (!enabled) return;
    const socket = getChatSocket();
    const onPresence = (p: PresenceEvent) => {
      if (p.userId !== userId) return;
      queryClient.setQueryData<Presence | null>(presenceKey(userId), (old) => ({
        online: p.online,
        // A "came online" push carries no timestamp; keep the last one known.
        lastSeenAt: p.lastSeenAt ?? old?.lastSeenAt ?? null,
      }));
    };
    socket.on("presence", onPresence);
    return () => {
      socket.off("presence", onPresence);
    };
  }, [enabled, userId]);

  return enabled ? data : undefined;
}

/** "onlayn", "oxirgi faollik: 14:05", or "oflayn" when never seen. */
export function formatPresence(p: Presence, language: Language): string {
  if (p.online) return translate("chat.online");
  if (!p.lastSeenAt) return translate("chat.offline");
  const d = new Date(p.lastSeenAt);
  const isToday = new Date().toDateString() === d.toDateString();
  return translate("chat.lastSeen", {
    when: isToday
      ? d.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString(language),
  });
}
