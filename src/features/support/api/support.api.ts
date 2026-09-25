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
  /** Null when that account is gone — the attribution stays, the link goes. */
  forwardedFromUserId: string | null;
  createdAt: string;
}

export interface SupportThread {
  id: string;
  userId: string;
  status: "OPEN" | "CLOSED";
  lastMessageAt: string | null;
  /** When each side last read. A message is read when the other side's
   *  stamp is later than it. */
  userReadAt: string | null;
  adminReadAt: string | null;
  userUnread: number;
  adminUnread: number;
  createdAt: string;
}

export interface SupportImage {
  url: string;
  thumbUrl: string;
}

export interface SendSupportInput {
  type?: "TEXT" | "IMAGE" | "VIDEO" | "VIDEO_NOTE" | "VOICE" | "FILE";
  body?: string;
  /** The composer's own photo upload. */
  image?: SupportImage;
  /** Everything else — voice, video, files. */
  mediaUrl?: string;
  thumbUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  durationSec?: number;
  waveform?: number[];
}

export const supportApi = {
  /** `thread` is null for someone who has never written. */
  mine: () =>
    api<{ thread: SupportThread | null; messages: SupportMessage[] }>(
      "/support",
    ),

  unread: () => api<{ unread: number }>("/support/unread"),

  /**
   * Anything the chat composer can produce: text, a photo, a voice note, a
   * video or a file. The server stores it in the same shape a forwarded chat
   * message arrives in, so the desk sees one kind of thread.
   */
  send: (input: SendSupportInput) =>
    api<SupportMessage>("/support/messages", { method: "POST", body: input }),

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
