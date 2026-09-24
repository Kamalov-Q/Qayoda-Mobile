import { api } from "@/src/lib/api-client";

/** How many top-level comments one page holds. */
export const COMMENTS_PAGE = 20;

/** Mirrors COMMENT_MAX_LENGTH on the server. */
export const COMMENT_MAX_LENGTH = 1000;

export interface CommentAuthor {
  id: string;
  name: string | null;
  surname: string | null;
  avatarThumbUrl: string | null;
}

/** The photo half of a comment, as the media endpoint returned it. */
export interface CommentImage {
  url: string;
  thumbUrl: string;
  width?: number;
  height?: number;
}

export interface Comment {
  id: string;
  listingId: string;
  /** Null for a top-level comment; otherwise the one it replies to. */
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
  /** False for guests — they can read the count but not whose it is. */
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
  /** Null when the account has since been deleted. */
  author: CommentAuthor | null;
}

/** A top-level comment carries the start of its own thread. */
export interface CommentThread extends Comment {
  replies: Comment[];
}

export interface CommentsPage {
  /** Top-level comments in total, not counting replies. */
  total: number;
  items: CommentThread[];
}

export interface RepliesPage {
  total: number;
  items: Comment[];
}

export const commentsApi = {
  /** Public; a token only adds `likedByMe`. */
  list: (listingId: string, limit = COMMENTS_PAGE, offset = 0) =>
    api<CommentsPage>(
      `/listings/${listingId}/comments?limit=${limit}&offset=${offset}`,
    ),

  replies: (
    listingId: string,
    commentId: string,
    limit = COMMENTS_PAGE,
    offset = 0,
  ) =>
    api<RepliesPage>(
      `/listings/${listingId}/comments/${commentId}/replies?limit=${limit}&offset=${offset}`,
    ),

  create: (
    listingId: string,
    body: string,
    parentId?: string,
    image?: CommentImage,
  ) =>
    api<Comment>(`/listings/${listingId}/comments`, {
      method: "POST",
      body: {
        ...(body ? { body } : {}),
        ...(parentId ? { parentId } : {}),
        ...(image ? { image } : {}),
      },
    }),

  update: (listingId: string, commentId: string, body: string) =>
    api<Comment>(`/listings/${listingId}/comments/${commentId}`, {
      method: "PATCH",
      body: { body },
    }),

  /** Author, listing owner or admin. Takes replies with it. */
  remove: (listingId: string, commentId: string) =>
    api<{ success: boolean }>(`/listings/${listingId}/comments/${commentId}`, {
      method: "DELETE",
    }),

  /** Both directions idempotent, so a double tap can't error. */
  setLike: (listingId: string, commentId: string, liked: boolean) =>
    api<{ liked: boolean; likeCount: number }>(
      `/listings/${listingId}/comments/${commentId}/like`,
      { method: liked ? "PUT" : "DELETE" },
    ),
};
