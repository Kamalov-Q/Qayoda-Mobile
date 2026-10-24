import { useCallback, useEffect, useRef } from "react";
import { videosApi, type ReportedView } from "../api/videos.api";

/** Flush this often while the feed is open. */
const FLUSH_MS = 10_000;
/** Mirrors VIEW_MIN_WATCH_MS: under this, nobody watched anything. */
const MIN_WATCH_MS = 3000;
/** Mirrors VIEW_BATCH_MAX. */
const BATCH_MAX = 50;

/**
 * Counting views without a request per swipe.
 *
 * A reel feed is a swipe every two seconds. One POST per view would mean one
 * POST per swipe — a lot of HTTP for a number nobody checks in real time, and
 * a reliable way to trip the app's own rate limit. So watch time is
 * accumulated in a ref, flushed every ten seconds, and flushed again when the
 * screen goes away.
 *
 * A ref, not state, on purpose: nothing here should repaint a video.
 */
export function useVideoViews() {
  const pending = useRef(new Map<string, number>());
  const sending = useRef(false);

  const flush = useCallback(async () => {
    if (sending.current || pending.current.size === 0) return;

    const batch: ReportedView[] = [...pending.current.entries()]
      .filter(([, watchedMs]) => watchedMs >= MIN_WATCH_MS)
      .slice(0, BATCH_MAX)
      .map(([videoId, watchedMs]) => ({ videoId, watchedMs }));
    if (!batch.length) return;

    sending.current = true;
    // Cleared before the request, not after: a failed flush is a lost view,
    // which is cheaper than a batch that is retried forever because the app
    // keeps adding to it.
    for (const { videoId } of batch) pending.current.delete(videoId);

    try {
      await videosApi.reportViews(batch);
    } catch {
      // Views are the one number in the app that may quietly be short.
    } finally {
      sending.current = false;
    }
  }, []);

  /** Called by a reel when it stops being the one playing. */
  const record = useCallback((videoId: string, watchedMs: number) => {
    if (watchedMs < MIN_WATCH_MS) return;
    const best = pending.current.get(videoId) ?? 0;
    // Longest watch wins — the server keeps the maximum too, and a viewer who
    // comes back to a reel watched it longer, not twice.
    if (watchedMs > best) pending.current.set(videoId, watchedMs);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => void flush(), FLUSH_MS);
    return () => {
      clearInterval(timer);
      // Leaving the screen is exactly when the last view is worth sending.
      void flush();
    };
  }, [flush]);

  return { record, flush };
}
