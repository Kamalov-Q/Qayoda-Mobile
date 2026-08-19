import { useCallback } from "react";
import * as Crypto from "expo-crypto";
import { queryClient } from "../../../lib/query-client";
import { getChatSocket } from "../../../lib/chat-socket";
import { chatApi, ChatMessage, SendMessageInput } from "../api/chat.api";
import { replyPreviewOf } from "../utils/preview";
import { useAuthStore } from "../../auth/store/auth.store";

export function useSendMessage(conversationId: string) {
  const userId = useAuthStore((s) => s.user?.id ?? "");

  return useCallback(
    (input: SendMessageInput) => {
      const clientId = Crypto.randomUUID();

      // The quote is built locally because no server payload carries it: the
      // socket echo has replyToId only, so without this the sender's own reply
      // rendered as a plain message until the thread was refetched.
      const cached = queryClient.getQueryData<ChatMessage[]>([
        "chat",
        "messages",
        conversationId,
      ]);
      const replyTarget = input.replyToId
        ? cached?.find((m) => m.id === input.replyToId)
        : undefined;

      // Optimistic bubble appears instantly
      const optimistic: ChatMessage = {
        id: `local-${clientId}`,
        conversationId,
        senderId: userId,
        type: input.type,
        body: input.body ?? null,
        mediaUrl: input.mediaUrl ?? null,
        thumbUrl: input.thumbUrl ?? null,
        fileName: input.fileName ?? null,
        fileSize: input.fileSize ?? null,
        mimeType: input.mimeType ?? null,
        durationSec: input.durationSec ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        waveform: input.waveform ?? null,
        replyToId: input.replyToId ?? null,
        replyTo: replyTarget ? replyPreviewOf(replyTarget) : null,
        editedAt: null,
        editedBy: null,
        editCount: 0,
        deletedAt: null,
        deletedBy: null,
        status: "SENT",
        deliveredAt: null,
        readAt: null,
        clientId,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      queryClient.setQueryData<ChatMessage[]>(
        ["chat", "messages", conversationId],
        (old) => [optimistic, ...(old ?? [])],
      );

      const payload = { conversationId, ...input, clientId };
      const socket = getChatSocket();

      if (socket.connected) {
        // The `message:new` echo reconciles by clientId; the ack is a bonus
        socket.emit("message:send", payload, () => {});
      } else {
        // REST fallback — the server dedupes by clientId if the socket also retries
        chatApi
          .sendMessage(conversationId, { ...input, clientId })
          .then((message) => {
            queryClient.setQueryData<ChatMessage[]>(
              ["chat", "messages", conversationId],
              (old) =>
                old?.map((m) =>
                  m.clientId === clientId
                    ? // Same as the socket echo: the REST response has no
                      // replyTo either, so the local quote has to survive it.
                      { ...message, replyTo: m.replyTo, pending: false }
                    : m,
                ),
            );
          });
      }
    },
    [conversationId, userId],
  );
}
