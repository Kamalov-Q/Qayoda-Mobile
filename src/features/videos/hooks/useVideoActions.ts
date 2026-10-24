import { useCallback } from "react";
import { Share } from "react-native";
import * as Linking from "expo-linking";
import { useMutation } from "@tanstack/react-query";
import { videosApi, type Video } from "../api/videos.api";
import { patchCachedVideo, dropCachedVideo } from "../utils/video-cache";
import { queryClient } from "@/src/lib/query-client";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";
import { requireAuth } from "@/src/features/auth/guest";

/**
 * The heart.
 *
 * Optimistic, and deliberately so: a like is the cheapest interaction in the
 * app and the one people fire fastest. It flips in every cache the video
 * appears in before the request leaves, and the server's own count replaces
 * the guess when it answers — which is how a double tap during a slow
 * request still ends on the right number.
 */
export function useToggleVideoLike() {
  const mutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      videosApi.setLike(id, next),

    onMutate: ({ id, next }) => {
      const previous = findCached(id);
      patchCachedVideo(id, {
        likedByMe: next,
        likeCount: Math.max(0, (previous?.likeCount ?? 0) + (next ? 1 : -1)),
      });
      return { previous };
    },

    onSuccess: ({ liked, likeCount }, { id }) => {
      patchCachedVideo(id, { likedByMe: liked, likeCount });
    },

    onError: (error, { id }, context) => {
      if (context?.previous) {
        patchCachedVideo(id, {
          likedByMe: context.previous.likedByMe,
          likeCount: context.previous.likeCount,
        });
      }
      toast.error(errorMessage(error));
    },
  });

  /** Guests get the sign-in prompt instead of a heart that forgets itself. */
  const toggle = useCallback(
    (video: Pick<Video, "id" | "likedByMe">) =>
      requireAuth(() =>
        mutation.mutate({ id: video.id, next: !video.likedByMe }),
      ),
    [mutation],
  );

  return { toggle, isPending: mutation.isPending };
}

/**
 * The native share sheet.
 *
 * The link is a deep link into the app's own single-video screen, so a reel
 * sent to a friend opens the reel rather than the feed.
 *
 * Nothing is counted. The sheet never reports whether anything was actually
 * sent, so a "shares" number counts the opening of a menu while being read as
 * reach — and no screen in this app was going to act on it either way.
 */
export function useShareVideo() {
  return useCallback(async (video: Video) => {
    const url = Linking.createURL(`/videos/${video.id}`);

    try {
      await Share.share({
        title: video.caption ?? undefined,
        message: `${video.caption ?? ""}\n${url}`.trim(),
      });
    } catch {
      // Dismissing the sheet rejects on some platforms; not an error.
    }
  }, []);
}

/**
 * Editing a published video: its caption, and the listing it points at.
 *
 * Both are things a seller gets wrong at two in the morning and wants to fix
 * at nine — a typo in the caption, or a clip they forgot to attach to the
 * advert it was filmed for. The video itself is never re-uploaded: that is a
 * different file, a different encode and a different charge.
 */
export function useUpdateVideo() {
  return useMutation({
    mutationFn: ({
      id,
      caption,
      listingId,
    }: {
      id: string;
      caption?: string;
      listingId?: string | null;
    }) => videosApi.update(id, { caption, listingId }),

    onSuccess: (video) => {
      // The server answers with the whole row, listing card included, so the
      // feed and the shelf can both take it as-is.
      patchCachedVideo(video.id, video);
      toast.successKey("videos.saved");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

/** The author taking their own video down. */
export function useDeleteVideo() {
  return useMutation({
    mutationFn: (id: string) => videosApi.remove(id),
    onSuccess: (_result, id) => {
      dropCachedVideo(id);
      void queryClient.invalidateQueries({ queryKey: ["videos", "mine"] });
      toast.successKey("videos.deleted");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

/**
 * Pay for a video that was waiting: the file is encoded and valid, the wallet
 * was empty when it finished. The 402 is handled by the caller so it can
 * offer the top-up.
 */
export function usePublishVideo() {
  return useMutation({
    mutationFn: (id: string) => videosApi.publish(id),
    onSuccess: (video) => {
      patchCachedVideo(video.id, video);
      void queryClient.invalidateQueries({ queryKey: ["videos"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

/** The cached copy of a video, from whichever list happens to hold it. */
function findCached(id: string): Video | undefined {
  for (const [, data] of queryClient.getQueriesData({ queryKey: ["videos"] })) {
    const found = search(data, id);
    if (found) return found;
  }
  return undefined;
}

function search(data: unknown, id: string): Video | undefined {
  if (!data || typeof data !== "object") return undefined;

  if ("pages" in data && Array.isArray((data as { pages: unknown[] }).pages)) {
    for (const page of (data as { pages: unknown[] }).pages) {
      const found = search(page, id);
      if (found) return found;
    }
    return undefined;
  }

  if ("items" in data && Array.isArray((data as { items: Video[] }).items)) {
    return (data as { items: Video[] }).items.find((v) => v.id === id);
  }

  if ("id" in data && (data as Video).id === id) return data as Video;
  return undefined;
}
