import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  ACTIVITY_PAGE,
  activityApi,
  type ActivityComment,
  type ActivityPage,
  type ActivityReview,
} from "../api/activity.api";
import { useAuthStore } from "@/src/features/auth/store/auth.store";

export type ActivityKind = "comments" | "likes" | "reviews";

/** What a row of each list holds. Likes are comments — someone else's. */
interface ItemOf {
  comments: ActivityComment;
  likes: ActivityComment;
  reviews: ActivityReview;
}

const FETCHERS = {
  comments: activityApi.comments,
  likes: activityApi.likedComments,
  reviews: activityApi.reviews,
} as const;

/**
 * One hook for all three lists: they differ only in which endpoint they read
 * and what a row looks like, and three near-identical hooks would be three
 * places to fix the next paging bug.
 */
export function useActivity<K extends ActivityKind>(kind: K) {
  // The lookup's own type is the union of three return types, which no single
  // call signature satisfies. The map is keyed by the same literal that picks
  // the item type, so narrowing it here is sound and keeps the call sites
  // fully typed.
  const fetch = FETCHERS[kind] as (
    limit: number,
    offset: number,
  ) => Promise<ActivityPage<ItemOf[K]>>;

  const authed = useAuthStore((s) => s.status === "authenticated");

  const query = useInfiniteQuery({
    queryKey: ["activity", kind] as const,
    queryFn: ({ pageParam }) => fetch(ACTIVITY_PAGE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.items.length < ACTIVITY_PAGE
        ? undefined
        : pages.length * ACTIVITY_PAGE,
    enabled: authed,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  return { ...query, items, total: query.data?.pages[0]?.total ?? 0 };
}
