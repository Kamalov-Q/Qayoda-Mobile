import { useEffect } from "react";
import { queryClient } from "../../../lib/query-client";
import { getChatSocket } from "../../../lib/chat-socket";
import { useAuthStore } from "../../auth/store/auth.store";
import { ChatMessage, Conversation } from "../api/chat.api";
import { hydrateReply } from "../utils/preview";
import { clearUnread } from "../utils/cache";

/**
 * Mount ONCE while authenticated (in the tabs layout). Routes every socket
 * event into the TanStack Query caches so any mounted screen updates live.
 */
export function useChatSocket() {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (status !== "authenticated") return;
    const socket = getChatSocket();

    const upsertMessage = (incoming: ChatMessage) => {
      queryClient.setQueryData<ChatMessage[]>(
        ["chat", "messages", incoming.conversationId],
        (old) => {
          if (!old) return old;
          const message = hydrateReply(incoming, old);
          const i = old.findIndex(
            (m) =>
              m.id === message.id ||
              (message.clientId && m.clientId === message.clientId),
          );
          if (i >= 0) {
            const next = [...old];
            // Keep the quote the optimistic copy already had: the echo would
            // otherwise blank it out on the sender's own screen.
            next[i] = {
              ...message,
              replyTo: message.replyTo ?? old[i].replyTo,
              pending: false,
            };
            return next;
          }
          return [message, ...old]; // newest-first
        },
      );
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    };

    const onRead = (p: {
      conversationId: string;
      readAt: string;
      readBy: string;
    }) => {
      queryClient.setQueryData<ChatMessage[]>(
        ["chat", "messages", p.conversationId],
        (old) =>
          old?.map((m) =>
            // The sweep only touches what the reader did NOT send, so the
            // receipt says nothing about the reader's own messages — blanket
            // -marking every message READ backdated the wrong half of the
            // thread on whichever side received the event.
            m.readAt || m.senderId === p.readBy
              ? m
              : {
                  ...m,
                  status: "READ",
                  readAt: p.readAt,
                  deliveredAt: m.deliveredAt ?? p.readAt,
                },
          ),
      );

      // Our own read, possibly from another device: drop the badge here too,
      // or it survives until something refetches the conversation list.
      if (p.readBy === userId) clearUnread(p.conversationId);
    };

    const onDeleted = (p: {
      id: string;
      conversationId: string;
      deletedBy: string;
    }) => {
      queryClient.setQueryData<ChatMessage[]>(
        ["chat", "messages", p.conversationId],
        (old) =>
          old?.map((m) =>
            m.id === p.id
              ? {
                  ...m,
                  deletedAt: new Date().toISOString(),
                  deletedBy: p.deletedBy,
                  body: null,
                  mediaUrl: null,
                  thumbUrl: null,
                  waveform: null,
                }
              : m,
          ),
      );
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    };

    const onTyping = (p: {
      conversationId: string;
      userId: string;
      isTyping: boolean;
      kind: string;
    }) => {
      queryClient.setQueryData(
        ["chat", "typing", p.conversationId],
        p.isTyping ? p : null,
      );
    };

    const onPresence = (p: {
      userId: string;
      online: boolean;
      lastSeenAt: string | null;
    }) => {
      queryClient.setQueryData<Conversation[]>(
        ["chat", "conversations"],
        (old) =>
          old?.map((c) =>
            c.other.id === p.userId
              ? {
                  ...c,
                  other: {
                    ...c.other,
                    online: p.online,
                    lastSeenAt: p.lastSeenAt ?? c.other.lastSeenAt,
                  },
                }
              : c,
          ),
      );
      // Thread headers read the single-conversation cache too
      queryClient.invalidateQueries({ queryKey: ["chat", "conversation"] });
    };

    // Names match the gateway exactly: it broadcasts "message:edit" and
    // "message:delete" (the same names it accepts), not the past-tense forms
    // this used to listen for — so edits and deletions reached no screen at
    // all, and with messages cached indefinitely they never turned up later.
    socket.on("message:new", upsertMessage);
    socket.on("message:edit", upsertMessage);
    socket.on("message:read", onRead);
    socket.on("message:delete", onDeleted);
    socket.on("typing", onTyping);
    socket.on("presence", onPresence);

    return () => {
      socket.off("message:new", upsertMessage);
      socket.off("message:edit", upsertMessage);
      socket.off("message:read", onRead);
      socket.off("message:delete", onDeleted);
      socket.off("typing", onTyping);
      socket.off("presence", onPresence);
    };
  }, [status, userId]);
}
