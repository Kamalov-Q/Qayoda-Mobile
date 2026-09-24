import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  REVIEWS_PAGE,
  reviewsApi,
  type Review,
  type ReviewsPage,
} from "../api/reviews.api";
import { queryClient } from "@/src/lib/query-client";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";

const reviewsKey = (listingId: string) => ["reviews", listingId] as const;

/**
 * One listing's reviews. Infinite, because a popular listing's reviews are a
 * list like any other; the summary rides on page one, so the header and the
 * first rows arrive together instead of in two requests.
 */
export function useReviews(listingId: string | undefined, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: reviewsKey(listingId ?? ""),
    queryFn: ({ pageParam }) =>
      reviewsApi.list(listingId!, REVIEWS_PAGE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.items.length < REVIEWS_PAGE
        ? undefined
        : pages.length * REVIEWS_PAGE,
    enabled: !!listingId && enabled,
  });

  const first = query.data?.pages[0];
  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  return {
    ...query,
    items,
    /** The header's numbers — from page one, which always carries them. */
    summary: first
      ? {
          count: first.count,
          average: first.average,
          distribution: first.distribution,
        }
      : null,
    mine: first?.mine ?? null,
  };
}

/**
 * Everything a rating change has to repaint: the reviews themselves, the
 * listing (its `ratingAvg` moved) and the lists whose cards show stars.
 */
function invalidateAfterWrite(listingId: string) {
  void queryClient.invalidateQueries({ queryKey: reviewsKey(listingId) });
  void queryClient.invalidateQueries({
    queryKey: ["listings", "detail", listingId],
  });
  void queryClient.invalidateQueries({ queryKey: ["listings", "feed"] });
  void queryClient.invalidateQueries({ queryKey: ["listings", "latest"] });
}

interface SubmitInput {
  rating: number;
  comment?: string;
  /** Only changes the toast: the server upserts either way. */
  isEdit?: boolean;
}

/** Leave a review or edit the one you left — the same call either way. */
export function useSubmitReview(listingId: string) {
  return useMutation({
    mutationFn: ({ rating, comment }: SubmitInput) =>
      reviewsApi.submit(listingId, rating, comment),
    onSuccess: (_review, vars) => {
      // Wording follows what the reader actually did, so an edit does not
      // thank them for a review they left last week.
      toast.successKey(vars.isEdit ? "reviews.updated" : "reviews.sent");
      invalidateAfterWrite(listingId);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

/** Withdraw your own review. */
export function useDeleteReview(listingId: string) {
  return useMutation({
    mutationFn: () => reviewsApi.remove(listingId),
    onSuccess: () => {
      toast.successKey("reviews.removed");
      invalidateAfterWrite(listingId);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export type { Review, ReviewsPage };
