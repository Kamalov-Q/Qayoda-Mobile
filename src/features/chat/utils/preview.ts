import type { ChatMessage } from "../api/chat.api";

/**
 * Mirror of the server's `previewFor` (chat.service.ts), used to fill in reply
 * previews the socket does not carry — see `hydrateReply`. It is deliberately
 * not translated: these exact strings come back from the API on the next
 * fetch, and a localised local version would visibly rewrite itself.
 */
export function previewFor(m: ChatMessage): string {
  switch (m.type) {
    case "TEXT":
      return (m.body ?? "").slice(0, 160);
    case "IMAGE":
      return "📷 Rasm";
    case "VIDEO":
      return "🎬 Video";
    case "VIDEO_NOTE":
      return "🎥 Video xabar";
    case "VOICE":
      return "🎤 Ovozli xabar";
    case "FILE":
      return `📎 ${m.fileName ?? "Fayl"}`;
    default:
      return "";
  }
}

/**
 * Builds the quoted-message block a reply renders from another message that is
 * already in the thread.
 */
export function replyPreviewOf(target: ChatMessage): ChatMessage["replyTo"] {
  return {
    id: target.id,
    senderId: target.senderId,
    type: target.type,
    preview: target.deletedAt ? "Deleted message" : previewFor(target),
  };
}

/**
 * The socket payload is `toMessageDto`, which carries `replyToId` but no
 * `replyTo` — only the REST message page joins that in. Without this, a reply
 * showed its quote to whoever loaded the thread over HTTP and to nobody else,
 * so the sender never saw their own. The target is by definition another
 * message in the same thread, so the cache can supply the preview.
 */
export function hydrateReply(
  message: ChatMessage,
  cached: ChatMessage[] | undefined,
): ChatMessage {
  if (message.replyTo || !message.replyToId) return message;

  const target = cached?.find((m) => m.id === message.replyToId);
  return target
    ? { ...message, replyTo: replyPreviewOf(target) }
    : { ...message, replyTo: null };
}
