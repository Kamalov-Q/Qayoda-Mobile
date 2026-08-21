import { queryClient } from "../../../lib/query-client";
import type { Conversation } from "../api/chat.api";

/**
 * Zeroes a conversation's unread count in every cache that renders it — the
 * inbox rows and, through `useUnreadTotal`, the tab badge.
 *
 * Reading a thread used to touch only the messages cache, so the badge kept
 * its old number until something happened to refetch the conversation list.
 * Called twice on purpose: optimistically when the thread emits the read, and
 * again when the server's receipt comes back (which is also what clears the
 * badge on the user's other devices).
 */
export function clearUnread(conversationId: string): void {
  queryClient.setQueryData<Conversation[]>(
    ["chat", "conversations"],
    (old) =>
      old?.map((c) =>
        c.id === conversationId && c.unreadCount > 0
          ? { ...c, unreadCount: 0 }
          : c,
      ),
  );

  queryClient.setQueryData<Conversation>(
    ["chat", "conversation", conversationId],
    (old) => (old?.unreadCount ? { ...old, unreadCount: 0 } : old),
  );
}
