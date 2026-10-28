// src/features/notifications/notificationTarget.ts
//
// Where a notification goes when you tap it.
//
// One function, because there are two places a tap can happen — a row in the
// inbox and a banner on the lock screen — and they must land in the same
// place. They used to be two copies of the same ladder of ifs, in two files,
// written from two different shapes (an AppNotification row and the loose
// `data` bag off a push). Keeping them in step was manual, and the drift had
// already started: the row sent money kinds to /wallet before looking at
// conversationId, the push handler looked at conversationId first.
import type { NotificationKind } from "./api/notifications.api";

/**
 * The references a destination is decided from — the intersection of what an
 * inbox row carries and what the push `data` carries, which the server keeps
 * identical on purpose.
 */
export interface NotificationTarget {
  kind: NotificationKind | string | null;
  videoId?: string | null;
  listingId?: string | null;
  conversationId?: string | null;
  actorId?: string | null;
}

/**
 * Reads a target out of a push payload.
 *
 * Everything in `data` is untyped — it survived a round trip through JSON and
 * two operating systems — so every field is checked rather than asserted. A
 * malformed payload becomes a target with nothing on it, which routes to the
 * inbox instead of crashing the tap handler.
 */
export function targetFromPushData(
  data: Record<string, unknown> | null | undefined,
): NotificationTarget & { notificationId: string | null } {
  const str = (k: string): string | null =>
    typeof data?.[k] === "string" ? (data[k] as string) : null;

  return {
    kind: str("kind"),
    notificationId: str("notificationId"),
    videoId: str("videoId"),
    listingId: str("listingId"),
    conversationId: str("conversationId"),
    actorId: str("actorId"),
  };
}

/**
 * The route. Never null: a notification that cannot be opened is a toast
 * that outlived its welcome, so the inbox is the fallback — it is always a
 * correct answer to "show me what this was about".
 *
 * Order matters, and is the order below:
 *
 *  1. Kinds whose destination is a SCREEN rather than a thing. A video that
 *     failed or is waiting to be paid for opens the shelf with the button on
 *     it, not the video — the video is the problem, not the fix. Money opens
 *     the wallet for the same reason.
 *  2. The thread, before anything else referenced. A chat row carries no
 *     video or listing today, but a bid row carries both a listing and a
 *     conversation and belongs in the conversation: that is where the card
 *     with Accept on it is drawn.
 *  3. The thing itself — video, then listing.
 *  4. The person, when the event was about them and nothing else (a follow).
 */
export function notificationRoute(target: NotificationTarget): string {
  const { kind } = target;

  if (kind === "VIDEO_AWAITING_PAYMENT" || kind === "VIDEO_FAILED") {
    return "/videos/mine";
  }
  if (
    kind === "TOPUP_SUCCEEDED" ||
    kind === "TOPUP_FAILED" ||
    kind === "TARIFF_PAID" ||
    kind === "TARIFF_EXPIRING"
  ) {
    return "/wallet";
  }

  if (target.conversationId) return `/chat/${target.conversationId}`;
  // A bid whose thread has gone — the conversation was deleted, or the row
  // predates bids carrying one. The listing is still the subject.
  if (target.videoId) return `/videos/${target.videoId}`;
  if (target.listingId) return `/listing/${target.listingId}`;
  if (target.actorId) return `/profile/${target.actorId}`;

  return "/activity/notifications";
}
