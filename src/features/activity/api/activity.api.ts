import { api } from "@/src/lib/api-client";
import type { Comment } from "@/src/features/comments/api/comments.api";
import type { Review } from "@/src/features/reviews/api/reviews.api";

export const ACTIVITY_PAGE = 20;

/** Just enough of a listing to render the row and navigate back into it. */
export interface ActivityListing {
  id: string;
  title: string | null;
  thumbUrl: string | null;
}

export interface ActivityComment extends Comment {
  listing: ActivityListing | null;
  /** A reply rather than a top-level comment. */
  isReply: boolean;
}

export interface ActivityReview extends Review {
  listing: ActivityListing | null;
}

export interface ActivityPage<T> {
  total: number;
  items: T[];
}

/**
 * Everything here is keyed by the caller's session — there is no id in any
 * path, and no way to ask for someone else's trail.
 */
export const activityApi = {
  comments: (limit = ACTIVITY_PAGE, offset = 0) =>
    api<ActivityPage<ActivityComment>>(`/me/comments?limit=${limit}&offset=${offset}`),

  likedComments: (limit = ACTIVITY_PAGE, offset = 0) =>
    api<ActivityPage<ActivityComment>>(
      `/me/comment-likes?limit=${limit}&offset=${offset}`,
    ),

  reviews: (limit = ACTIVITY_PAGE, offset = 0) =>
    api<ActivityPage<ActivityReview>>(`/me/reviews?limit=${limit}&offset=${offset}`),
};
