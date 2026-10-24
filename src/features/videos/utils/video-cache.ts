import { queryClient } from "@/src/lib/query-client";
import type { Video } from "../api/videos.api";

/**
 * Patch one video everywhere it is cached.
 *
 * A reel shows up in four differently shaped caches — the feed (pages of
 * `{ items, nextCursor }`), a single video, "my videos" and a listing's
 * videos (`{ items, total }`) — and a like that only updates the one on
 * screen means the number changes back when you swipe away and return.
 *
 * So rather than four hand-written updaters, one walk over every query under
 * the "videos" key that knows the three shapes those caches come in.
 */
export function patchCachedVideo(id: string, patch: Partial<Video>): void {
  queryClient.setQueriesData({ queryKey: ["videos"] }, (data: unknown) =>
    mapVideos(data, (video) =>
      video.id === id ? { ...video, ...patch } : video,
    ),
  );
}

/** Drop a video from every list it is in — after the author deletes it. */
export function dropCachedVideo(id: string): void {
  queryClient.setQueriesData({ queryKey: ["videos"] }, (data: unknown) =>
    filterVideos(data, (video) => video.id !== id),
  );
}

type Mapper = (video: Video) => Video;

function mapVideos(data: unknown, map: Mapper): unknown {
  if (!data || typeof data !== "object") return data;

  // An infinite query: pages of whatever one page is shaped like.
  if ("pages" in data && Array.isArray((data as { pages: unknown[] }).pages)) {
    const page = data as { pages: unknown[] };
    return { ...page, pages: page.pages.map((p) => mapVideos(p, map)) };
  }

  if ("items" in data && Array.isArray((data as { items: unknown[] }).items)) {
    const list = data as { items: Video[] };
    return { ...list, items: list.items.map(map) };
  }

  // A single video, which is what the detail query holds.
  if ("id" in data && "status" in data) return map(data as Video);

  return data;
}

function filterVideos(data: unknown, keep: (video: Video) => boolean): unknown {
  if (!data || typeof data !== "object") return data;

  if ("pages" in data && Array.isArray((data as { pages: unknown[] }).pages)) {
    const page = data as { pages: unknown[] };
    return { ...page, pages: page.pages.map((p) => filterVideos(p, keep)) };
  }

  if ("items" in data && Array.isArray((data as { items: unknown[] }).items)) {
    const list = data as { items: Video[]; total?: number };
    const items = list.items.filter(keep);
    return {
      ...list,
      items,
      // Only when the list carries one, and only by what actually went.
      ...(list.total != null
        ? {
            total: Math.max(0, list.total - (list.items.length - items.length)),
          }
        : {}),
    };
  }

  return data;
}
