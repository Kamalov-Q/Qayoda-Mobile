import { api } from "@/src/lib/api-client";

export const SUPPORT_MAX_LENGTH = 2000;

export interface SupportMessage {
  id: string;
  threadId: string;
  senderId: string;
  /** Which side wrote it — the only thing the bubble alignment depends on. */
  fromAdmin: boolean;
  /** TEXT, IMAGE, VOICE, VIDEO, VIDEO_NOTE or FILE. */
  type: string;
  body: string;
  imageUrl: string | null;
  imageThumbUrl: string | null;
  /** Non-image attachments — a forwarded voice note, video or file. */
  mediaUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  durationSec: number | null;
  waveform: number[] | null;
  /** Whose words these originally were, on a forward. */
  forwardedFromName: string | null;
  createdAt: string;
}

export interface SupportThread {
  id: string;
  userId: string;
  status: "OPEN" | "CLOSED";
  lastMessageAt: string | null;
  userUnread: number;
  adminUnread: number;
  createdAt: string;
}

export interface SupportImage {
  url: string;
  thumbUrl: string;
}

export const supportApi = {
  /** `thread` is null for someone who has never written. */
  mine: () =>
    api<{ thread: SupportThread | null; messages: SupportMessage[] }>(
      "/support",
    ),

  unread: () => api<{ unread: number }>("/support/unread"),

  send: (body: string, image?: SupportImage) =>
    api<SupportMessage>("/support/messages", {
      method: "POST",
      body: { ...(body ? { body } : {}), ...(image ? { image } : {}) },
    }),

  /**
   * Hands the support desk a message out of one of your chats — the evidence
   * itself rather than a description of it.
   */
  forward: (messageId: string) =>
    api<SupportMessage>("/support/forward", {
      method: "POST",
      body: { messageId },
    }),

  markRead: () =>
    api<{ success: boolean }>("/support/read", { method: "POST" }),
};
