import { useQuery } from "@tanstack/react-query";
import { videosApi } from "../api/videos.api";
import { useAuthStore } from "@/src/features/auth/store/auth.store";

/** While something is encoding, ask again this often. */
const PROCESSING_POLL_MS = 5000;

/**
 * The author's own shelf: every video they have, in every state.
 *
 * Polls — but only while something is actually being encoded. A video takes
 * Bunny well under a minute for a clip of this length, and the alternative to
 * polling is a push notification for an event the author is usually watching
 * the screen for. When nothing is processing the interval is off entirely.
 */
export function useMyVideos() {
  const authed = useAuthStore((s) => s.status === "authenticated");

  const query = useQuery({
    queryKey: ["videos", "mine"] as const,
    queryFn: () => videosApi.mine(50, 0),
    enabled: authed,
    refetchInterval: (q) =>
      q.state.data?.items.some((v) => v.status === "UPLOADING")
        ? PROCESSING_POLL_MS
        : false,
  });

  return { ...query, items: query.data?.items ?? [] };
}
