import { api } from "@/src/lib/api-client";

/** Mirrors VIDEO_MAX_DURATION_SEC on the server. Enforced there, on the
 *  encoded file — this copy is only so the picker and the hints agree. */
export const VIDEO_MAX_DURATION_SEC = 60;
/** Mirrors VIDEO_CAPTION_MAX. */
export const VIDEO_CAPTION_MAX = 2200;
/** Mirrors VIDEO_COMMENT_MAX. */
export const VIDEO_COMMENT_MAX = 1000;
/** Mirrors VIDEO_FEED_MAX — one page of the reel feed. */
export const VIDEO_PAGE = 10;

/**
 * Where a video is in its life. Only READY is public; the other five are
 * states the author sees on their own shelf.
 *
 * AWAITING_PAYMENT is the one with a button attached: the file is encoded and
 * within the limit, but the wallet was empty when it finished, so it is kept
 * for 48 hours and published the moment it is paid for.
 */
export type VideoStatus =
  "UPLOADING" | "AWAITING_PAYMENT" | "READY" | "FAILED" | "EXPIRED" | "REMOVED";

export type VideoFailReason = "TOO_LONG" | "ENCODING_FAILED" | "ABANDONED";

/**
 * Why a video can be reported — fixed moderation policy, mirroring the
 * server's VIDEO_REPORT_REASONS. Its own list, not the listing one: a reel is
 * flagged for what it shows, not for what an advert claims, and COPYRIGHT is
 * here because borrowed music is the likeliest takedown this feature will see.
 */
export const VIDEO_REPORT_REASONS = [
  "SPAM",
  "FRAUD",
  "WRONG_INFO",
  "INAPPROPRIATE",
  "COPYRIGHT",
  "OTHER",
] as const;
export type VideoReportReason = (typeof VIDEO_REPORT_REASONS)[number];

export interface VideoAuthor {
  id: string;
  name: string | null;
  surname: string | null;
  avatarThumbUrl: string | null;
  isVerifiedRealtor: boolean;
}

/** The advert a reel points at, as its call-to-action needs it. */
export interface VideoListingCard {
  id: string;
  title: string | null;
  thumbUrl: string | null;
  /** Decimal string, cheapest active offer. Null when the listing has none. */
  price: string | null;
  currency: string | null;
  purpose: string | null;
}

export interface Video {
  id: string;
  authorId: string;
  listingId: string | null;
  status: VideoStatus;
  failReason: VideoFailReason | null;
  caption: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  /** HLS manifest. Null while the file is still being encoded. */
  hlsUrl: string | null;
  /** Poster frame — shown instantly, which is most of why the feed feels fast. */
  thumbUrl: string | null;
  /** Bunny's iframe player. The dashboard uses it; this app plays HLS itself. */
  embedUrl?: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  likedByMe: boolean;
  publishedAt: string | null;
  createdAt: string;
  author: VideoAuthor | null;
  /** Present only while the listing is still live — see the server's shaping. */
  listing: VideoListingCard | null;
}

/** Which feed: everything, or only the people you follow. */
export type FeedScope = "foryou" | "following";

export interface VideoFeedPage {
  items: Video[];
  /** Hand back as `cursor`. Null means the end of the feed. */
  nextCursor: string | null;
}

/** What the server hands back to start an upload with. */
export interface UploadTicket {
  videoId: string;
  /** So'm, as a decimal string. Null when posting is free right now. */
  price: string | null;
  upload: {
    endpoint: string;
    libraryId: string;
    /** Bunny's own id for the video — not ours. */
    videoId: string;
    signature: string;
    /** Unix seconds. The signature dies then, and so does the upload. */
    expires: number;
    metadata: { filetype: string; title: string };
  };
}

export interface VideoCommentAuthor {
  id: string;
  name: string | null;
  surname: string | null;
  avatarThumbUrl: string | null;
}

/** The photo half of a comment, as the media endpoint returned it. */
export interface VideoCommentImage {
  url: string;
  thumbUrl: string;
  width?: number;
  height?: number;
}

export interface VideoComment {
  id: string;
  videoId: string;
  parentId: string | null;
  authorId: string;
  /** May be empty when the comment is just a photo. */
  body: string;
  imageUrl: string | null;
  imageThumbUrl: string | null;
  /** Known dimensions, so the thread can hold the right space while it loads. */
  imageWidth: number | null;
  imageHeight: number | null;
  likeCount: number;
  replyCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
  author: VideoCommentAuthor | null;
}

/** A top-level comment carries the start of its own thread. */
export interface VideoCommentThread extends VideoComment {
  replies: VideoComment[];
}

export interface VideoCommentsPage {
  /** Top-level comments, not counting replies. */
  total: number;
  items: VideoCommentThread[];
}

export interface ReportedView {
  videoId: string;
  watchedMs: number;
}

export const videosApi = {
  /**
   * The feed. Public — a guest can watch, and the `X-Device-Id` header the
   * client already sends is what lets "not yet watched" mean something for
   * them too.
   */
  feed: (
    cursor?: string | null,
    limit = VIDEO_PAGE,
    scope: FeedScope = "foryou",
    /**
     * Free text, matched against the caption. A search rather than a new
     * endpoint: the result set is the same shape, pages the same way and is
     * rendered by the same reel pager — the only difference is which rows
     * come back, which is what a filter is. The server ignores `scope`
     * ranking while this is set and orders by relevance instead.
     */
    q?: string,
  ) =>
    api<VideoFeedPage>(
      `/videos?limit=${limit}&scope=${scope}` +
        (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "") +
        (q?.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""),
    ),

  get: (id: string) => api<Video>(`/videos/${id}`),

  byListing: (listingId: string) =>
    api<{ items: Video[] }>(`/listings/${listingId}/videos`),

  byAuthor: (userId: string, limit = 20, offset = 0) =>
    api<{ total: number; items: Video[] }>(
      `/users/${userId}/videos?limit=${limit}&offset=${offset}`,
    ),

  /** Every status, so the author can see what is still encoding. */
  mine: (limit = 20, offset = 0) =>
    api<{ total: number; items: Video[] }>(
      `/videos/mine?limit=${limit}&offset=${offset}`,
    ),

  /**
   * Reserve a Bunny video and get a signed ticket for it. Fails before any
   * bytes move on the daily limit, listing ownership and balance.
   */
  createUploadTicket: (input: {
    listingId?: string;
    caption?: string;
    mimeType?: string;
  }) =>
    api<UploadTicket>("/videos/upload-ticket", {
      method: "POST",
      body: input,
    }),

  /** For a video in AWAITING_PAYMENT: pay the fee and publish it. */
  publish: (id: string) =>
    api<Video>(`/videos/${id}/publish`, { method: "POST" }),

  update: (
    id: string,
    patch: { caption?: string; listingId?: string | null },
  ) => api<Video>(`/videos/${id}`, { method: "PATCH", body: patch }),

  remove: (id: string) =>
    api<{ success: boolean }>(`/videos/${id}`, { method: "DELETE" }),

  /** Both directions idempotent, so an impatient double tap cannot error. */
  setLike: (id: string, liked: boolean) =>
    api<{ liked: boolean; likeCount: number }>(`/videos/${id}/like`, {
      method: liked ? "PUT" : "DELETE",
    }),

  /** A batch, not one call per reel. See useVideoViews. */
  reportViews: (views: ReportedView[]) =>
    api<{ counted: number }>("/videos/views", {
      method: "POST",
      body: { views },
    }),

  /** One per person per video; the second answers 409 ALREADY_REPORTED. */
  report: (id: string, reason: VideoReportReason, comment?: string) =>
    api<{ success: boolean }>(`/videos/${id}/report`, {
      method: "POST",
      body: { reason, ...(comment ? { comment } : {}) },
    }),

  /** One per person per comment; the second answers 409 ALREADY_REPORTED. */
  reportComment: (
    id: string,
    commentId: string,
    reason: VideoReportReason,
    comment?: string,
  ) =>
    api<{ success: boolean }>(`/videos/${id}/comments/${commentId}/report`, {
      method: "POST",
      body: { reason, ...(comment ? { comment } : {}) },
    }),

  comments: (id: string, limit = 20, offset = 0) =>
    api<VideoCommentsPage>(
      `/videos/${id}/comments?limit=${limit}&offset=${offset}`,
    ),

  replies: (id: string, commentId: string, limit = 50, offset = 0) =>
    api<{ total: number; items: VideoComment[] }>(
      `/videos/${id}/comments/${commentId}/replies?limit=${limit}&offset=${offset}`,
    ),

  comment: (
    id: string,
    body: string,
    parentId?: string,
    image?: VideoCommentImage,
  ) =>
    api<VideoComment>(`/videos/${id}/comments`, {
      method: "POST",
      body: {
        ...(body ? { body } : {}),
        ...(parentId ? { parentId } : {}),
        ...(image ? { image } : {}),
      },
    }),

  /** The words only — a photo cannot be swapped under an edit. */
  editComment: (id: string, commentId: string, body: string) =>
    api<VideoComment>(`/videos/${id}/comments/${commentId}`, {
      method: "PATCH",
      body: { body },
    }),

  removeComment: (id: string, commentId: string) =>
    api<{ success: boolean }>(`/videos/${id}/comments/${commentId}`, {
      method: "DELETE",
    }),

  setCommentLike: (id: string, commentId: string, liked: boolean) =>
    api<{ liked: boolean; likeCount: number }>(
      `/videos/${id}/comments/${commentId}/like`,
      { method: liked ? "PUT" : "DELETE" },
    ),
};
