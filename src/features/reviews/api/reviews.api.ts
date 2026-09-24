import { api } from "@/src/lib/api-client";

/** How many reviews one page of the list holds. */
export const REVIEWS_PAGE = 20;

/** The most a review may say — mirrors REVIEW_MAX_LENGTH on the server. */
export const REVIEW_MAX_LENGTH = 1000;

export interface ReviewAuthor {
  id: string;
  name: string | null;
  surname: string | null;
  avatarThumbUrl: string | null;
}

export interface Review {
  id: string;
  authorId: string;
  /** 1–5. */
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  /** Null when the account has since been deleted — the review outlives it. */
  author: ReviewAuthor | null;
}

/** Counts per star, all five buckets present even when empty. */
export type RatingDistribution = Record<"1" | "2" | "3" | "4" | "5", number>;

export interface ReviewsPage {
  /** How many reviews exist in total, not how many this page holds. */
  count: number;
  /** Null until somebody rates it. */
  average: number | null;
  distribution: RatingDistribution;
  /** The caller's own review, when they are signed in and have left one. */
  mine: Review | null;
  items: Review[];
}

export const reviewsApi = {
  /**
   * Public: guests get everything but `mine`. Page one is also what carries
   * the summary the header draws.
   */
  list: (listingId: string, limit = REVIEWS_PAGE, offset = 0) =>
    api<ReviewsPage>(
      `/listings/${listingId}/reviews?limit=${limit}&offset=${offset}`,
    ),

  /** Leave a review, or replace the one you left — the server upserts. */
  submit: (listingId: string, rating: number, comment?: string) =>
    api<Review>(`/listings/${listingId}/reviews/mine`, {
      method: "PUT",
      body: { rating, ...(comment ? { comment } : {}) },
    }),

  /** Idempotent — withdrawing a review you never left succeeds. */
  remove: (listingId: string) =>
    api<{ success: boolean }>(`/listings/${listingId}/reviews/mine`, {
      method: "DELETE",
    }),
};
