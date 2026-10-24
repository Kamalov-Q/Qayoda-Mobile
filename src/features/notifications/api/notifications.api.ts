import { api } from "@/src/lib/api-client";

/** Mirrors NOTIFICATIONS_PAGE on the server. */
export const NOTIFICATIONS_PAGE = 30;

/**
 * What the app tells you about. Short on purpose: a notification is a claim
 * on attention, and the list of things worth claiming it for is shorter than
 * the list of things that happen.
 */
export type NotificationKind =
  | "VIDEO_READY"
  | "VIDEO_FAILED"
  | "VIDEO_AWAITING_PAYMENT"
  | "VIDEO_LIKE"
  | "VIDEO_COMMENT"
  | "COMMENT_REPLY"
  | "NEW_FOLLOWER"
  /** Somebody you follow published a reel. */
  | "FOLLOWED_USER_POSTED"
  // Listings — the product itself, silent until the inbox was widened.
  | "LISTING_COMMENT"
  | "LISTING_COMMENT_REPLY"
  | "LISTING_REVIEW"
  /** One row per CONVERSATION, never one per message. */
  | "CHAT_MESSAGE"
  // Money.
  | "TOPUP_SUCCEEDED"
  | "TOPUP_FAILED"
  | "TARIFF_PAID"
  | "TARIFF_EXPIRING";

export interface NotificationActor {
  id: string;
  name: string | null;
  surname: string | null;
  avatarThumbUrl: string | null;
}

export interface NotificationVideo {
  id: string;
  caption: string | null;
  status: string;
  thumbUrl: string | null;
}

/** Enough of a listing to say WHICH one; no image, by design on the server. */
export interface NotificationListing {
  id: string;
  title: string | null;
}

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  videoId: string | null;
  commentId: string | null;
  listingId: string | null;
  conversationId: string | null;
  /**
   * Amounts, providers, tariff names. Printed by the row and joined to by
   * nothing, which is why it is loose: every key here is optional and every
   * reader must cope with it being absent.
   */
  meta: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
  /** Null when the platform is the actor — a video of yours going live. */
  actor: NotificationActor | null;
  video: NotificationVideo | null;
  listing: NotificationListing | null;
}

export const notificationsApi = {
  list: (limit = NOTIFICATIONS_PAGE, offset = 0) =>
    api<{ total: number; items: AppNotification[] }>(
      `/me/notifications?limit=${limit}&offset=${offset}`,
    ),

  unreadCount: () => api<{ count: number }>("/me/notifications/unread-count"),

  /**
   * Register this device for push. Idempotent, and called on every launch:
   * the OS can rotate a token, and re-registering an existing one re-points
   * it at whoever is signed in now.
   */
  registerPushToken: (token: string, platform: string) =>
    api<void>("/me/notifications/push-tokens", {
      method: "POST",
      body: { token, platform },
    }),

  /** Sign-out. This device only. */
  unregisterPushToken: (token: string) =>
    api<void>("/me/notifications/push-tokens", {
      method: "DELETE",
      body: { token },
    }),

  /** Everything, unless told otherwise. Opening the list is what reads it. */
  markRead: (ids?: string[]) =>
    api<{ read: number }>("/me/notifications/read", {
      method: "POST",
      body: ids?.length ? { ids } : {},
    }),
};
