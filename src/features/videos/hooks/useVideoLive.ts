import { useEffect } from "react";
import { onVideoStats, watchVideo } from "@/src/lib/videos-socket";
import { patchCachedVideo } from "../utils/video-cache";

/**
 * Keep the reel on screen in step with everyone else looking at it.
 *
 * A feed refetches; a reel is the one screen in this app where several
 * people are reliably watching the same thing at the same time, and a like
 * landing on a number you are staring at is the difference between a feed
 * and a broadcast.
 *
 * Subscribed for the ACTIVE page only — not for every page the pager has
 * mounted — so a phone holds one room, not three. The incoming payload
 * carries only what moved, and `patchCachedVideo` puts it into every cache
 * the video appears in.
 */
export function useVideoLive(videoId: string | undefined, active: boolean) {
  useEffect(() => {
    if (!videoId || !active) return;

    const leave = watchVideo(videoId);
    const off = onVideoStats((stats) => {
      if (stats.videoId !== videoId) return;
      const { videoId: _id, ...counters } = stats;
      patchCachedVideo(videoId, counters);
    });

    return () => {
      off();
      leave();
    };
  }, [videoId, active]);
}
