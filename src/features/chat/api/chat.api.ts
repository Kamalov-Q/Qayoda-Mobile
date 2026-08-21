import { api } from "@/src/lib/api-client";

export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "VOICE"
  | "VIDEO_NOTE"
  | "FILE";
export type MessageStatus = "SENT" | "DELIVERED" | "READ";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  body: string | null;
  mediaUrl: string | null;
  thumbUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  waveform: number[] | null;
  replyToId: string | null;
  replyTo?: {
    id: string;
    senderId: string;
    type: MessageType;
    preview: string;
  } | null;
  editedAt: string | null;
  editedBy: string | null;
  editCount: number;
  deletedAt: string | null;
  deletedBy: string | null;
  status: MessageStatus;
  deliveredAt: string | null;
  readAt: string | null;
  clientId: string | null;
  createdAt: string;
  /** local-only: true while awaiting server ack */
  pending?: boolean;
}

export interface Conversation {
  id: string;
  listingId: string;
  listingTitle: string | null;
  role: "host" | "guest";
  other: {
    id: string;
    name: string | null;
    surname: string | null;
    /** Prefer this one; `avatarThumbUrl` is the fallback. Both may be null. */
    avatarUrl?: string | null;
    avatarThumbUrl?: string | null;
    phoneNumber?: string | null;
    online: boolean;
    lastSeenAt: string | null;
  };
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

export interface SendMessageInput {
  type: MessageType;
  body?: string;
  mediaUrl?: string;
  thumbUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  durationSec?: number;
  width?: number;
  height?: number;
  waveform?: number[];
  replyToId?: string;
  clientId?: string;
}

export const chatApi = {
  listConversations: () => api<Conversation[]>(`/chat/conversations`),

  getConversation: (id: string) =>
    api<Conversation>(`/chat/conversations/${id}`),

  startConversation: (listingId: string, message: SendMessageInput) =>
    api<{ conversation: Conversation; message: ChatMessage }>(
      `/chat/conversations`,
      {
        method: "POST",
        body: { listingId, message },
      },
    ),

  listMessages: (conversationId: string, before?: string, limit = 30) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set("before", before);

    return api<ChatMessage[]>(
      `/chat/conversations/${conversationId}/messages?${params}`,
    );
  },

  sendMessage: (conversationId: string, input: SendMessageInput) =>
    api<ChatMessage>(`/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      body: input,
    }),

  markRead: (conversationId: string) =>
    api<{ conversationId: string; readAt: string }>(
      `/chat/conversations/${conversationId}/read`,
      { method: "POST" },
    ),
};
