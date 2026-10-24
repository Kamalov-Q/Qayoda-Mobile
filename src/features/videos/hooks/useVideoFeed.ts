import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  VIDEO_PAGE,
  videosApi,
  type FeedScope,
  type Video,
} from "../api/videos.api";

export const VIDEO_FEED_KEY = ["videos", "feed"] as const;

/**
 * The Videos tab's data.
 *
 * Cursor-paged rather than offset-paged, because people post into this feed
 * all day: under an offset, every upload shifts the window by one and the
 * reel you just watched comes round again while another is skipped. The
 * server hands back an opaque cursor and `null` when there is nothing left.
 *
 * Ten at a time, not twenty: each item is a poster image the pager may decide
 * to decode, and a page of a video feed is consumed one screen at a time
 * anyway.
 */
export function useVideoFeed(scope: FeedScope = "foryou", enabled = true) {
  const query = useInfiniteQuery({
    // The scope is part of the key: the two feeds are different lists, and
    // switching between them should not refetch — the one you came back to
    // is still cached, at the reel you left off on.
    queryKey: [...VIDEO_FEED_KEY, scope] as const,
    queryFn: ({ pageParam }) => videosApi.feed(pageParam, VIDEO_PAGE, scope),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // A reel feed is browsed in long sittings; refetching it under the
    // viewer's thumb would reorder the thing they are looking at.
    staleTime: 5 * 60_000,
    enabled,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  return { ...query, items };
}

/**
 * Below this a search is not a search — see MIN_USER_QUERY for the same
 * reasoning on the people side.
 */
export const MIN_VIDEO_QUERY = 2;

/**
 * Videos whose caption matches `q`.
 *
 * Its own hook rather than a `q` argument on useVideoFeed, because the two
 * are different lists with different lifetimes: the feed is a long sitting
 * that must not reorder under the viewer's thumb (staleTime 5 min), while a
 * search is a question asked and answered. Sharing a hook would mean sharing
 * a cache key shape and one of the two getting the wrong caching.
 *
 * `scope` is fixed at "foryou": searching only the people you follow is a
 * narrowing nobody asked for, and the server orders by relevance here anyway.
 */
export function useVideoSearch(q = "") {
  const raw = q.trim();
  // Below the floor the term is treated as ABSENT, not as a search for
  // nothing: the explore grid shows the feed, and backspacing out of a
  // search restores it rather than emptying the screen.
  const term = raw.length >= MIN_VIDEO_QUERY ? raw : "";

  const query = useInfiniteQuery({
    queryKey: [...VIDEO_FEED_KEY, "search", term] as const,
    queryFn: ({ pageParam }) =>
      videosApi.feed(pageParam, VIDEO_PAGE, "foryou", term || undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60_000,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  /** Whether a term is actually narrowing it, for the empty state. */
  return { ...query, items, searching: !!term };
}

/** One video, for the share-link screen and the listing page's player. */
export function useVideo(id: string | undefined, initial?: Video) {
  return useQuery({
    queryKey: ["videos", "one", id] as const,
    queryFn: () => videosApi.get(id!),
    enabled: !!id,
    // The feed already handed us the row when the reader came from there;
    // showing it immediately is the difference between a player and a spinner.
    initialData: initial,
  });
}

/** The clips on a listing page. */
export function useListingVideos(listingId: string | undefined) {
  const query = useQuery({
    queryKey: ["videos", "listing", listingId] as const,
    queryFn: () => videosApi.byListing(listingId!),
    enabled: !!listingId,
    staleTime: 60_000,
  });

  return { ...query, items: query.data?.items ?? [] };
}

/** Someone's reels, for their profile. */
export function useAuthorVideos(userId: string | undefined) {
  const query = useQuery({
    queryKey: ["videos", "author", userId] as const,
    queryFn: () => videosApi.byAuthor(userId!),
    enabled: !!userId,
  });

  return { ...query, items: query.data?.items ?? [] };
}
