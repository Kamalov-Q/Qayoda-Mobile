import { useMemo } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/src/lib/query-client";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";
import {
  videosApi,
  type VideoComment,
  type VideoCommentImage,
  type VideoCommentThread,
  type VideoCommentsPage,
} from "../api/videos.api";
import { patchCachedVideo } from "../utils/video-cache";

const PAGE = 20;

/**
 * Move the comment count on the video itself.
 *
 * The rail's number lives on the video row, not in the thread, so posting a
 * comment has to touch both — and the one people are looking at while they
 * press send is the rail.
 */
function bumpCommentCount(videoId: string, by: number) {
  const current = queryClient
    .getQueriesData<unknown>({ queryKey: ["videos"] })
    .flatMap(([, data]) => findCount(data, videoId))
    .find((n) => n != null);
  if (current == null) return;
  patchCachedVideo(videoId, { commentCount: Math.max(0, current + by) });
}

/** The cached comment count for one video, from whichever list holds it. */
function findCount(data: unknown, id: string): (number | null)[] {
  if (!data || typeof data !== "object") return [];
  if ("pages" in data && Array.isArray((data as { pages: unknown[] }).pages)) {
    return (data as { pages: unknown[] }).pages.flatMap((p) =>
      findCount(p, id),
    );
  }
  if ("items" in data && Array.isArray((data as { items: unknown[] }).items)) {
    const hit = (
      data as { items: { id: string; commentCount?: number }[] }
    ).items.find((v) => v.id === id);
    return hit?.commentCount != null ? [hit.commentCount] : [];
  }
  const one = data as { id?: string; commentCount?: number };
  return one.id === id && one.commentCount != null ? [one.commentCount] : [];
}

const commentsKey = (videoId: string) =>
  ["videos", "comments", videoId] as const;
const repliesKey = (videoId: string, commentId: string) =>
  ["videos", "comments", videoId, "replies", commentId] as const;

/**
 * The thread under a reel, a page at a time.
 *
 * Every page carries the same total, so the count on the video's own action
 * rail is corrected from whichever page lands — which is what keeps "14
 * comments" from surviving a deletion.
 */
export function useVideoComments(videoId: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: commentsKey(videoId ?? ""),
    queryFn: async ({ pageParam }) => {
      const page = await videosApi.comments(videoId!, PAGE, pageParam);
      patchCachedVideo(videoId!, { commentCount: page.total });
      return page;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.items.length < PAGE ? undefined : pages.length * PAGE,
    enabled: !!videoId,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  return { ...query, items, total: query.data?.pages[0]?.total ?? 0 };
}

/**
 * The rest of one comment's replies — fetched only when somebody asks. Two
 * arrive with the comment itself and most threads are never expanded.
 */
export function useVideoReplies(
  videoId: string,
  commentId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: repliesKey(videoId, commentId),
    queryFn: () => videosApi.replies(videoId, commentId, 50, 0),
    enabled,
  });
}

/**
 * Posting, with the count moving the moment you press send.
 *
 * The number on the reel's rail used to wait for the thread's next page to
 * land and report its total — which is a round trip after a round trip, and
 * reads as a counter that does not work. It is now nudged locally and
 * reconciled from the server's own total when the refetch arrives.
 */
export function usePostVideoComment(videoId: string) {
  return useMutation({
    mutationFn: ({
      body,
      parentId,
      image,
    }: {
      body: string;
      parentId?: string;
      image?: VideoCommentImage;
    }) => videosApi.comment(videoId, body, parentId, image),

    onMutate: () => bumpCommentCount(videoId, 1),

    onSuccess: (_comment, { parentId }) => {
      void queryClient.invalidateQueries({ queryKey: commentsKey(videoId) });
      // A reply lands inside a list that may already be expanded on screen.
      if (parentId) {
        void queryClient.invalidateQueries({
          queryKey: repliesKey(videoId, parentId),
        });
      }
    },

    onError: (error) => {
      bumpCommentCount(videoId, -1);
      toast.error(errorMessage(error));
    },
  });
}

/** Editing your own words. The photo on a comment is not up for changing. */
export function useEditVideoComment(videoId: string) {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      videosApi.editComment(videoId, id, body),

    onSuccess: (comment) => {
      // Patch in place rather than refetch: an edit changes one string, and
      // a thread that jumps back to the top to show it is worse than the typo.
      const patch = (c: VideoComment): VideoComment =>
        c.id === comment.id ? { ...c, ...comment } : c;

      queryClient.setQueryData<{
        pages: VideoCommentsPage[];
        pageParams: unknown[];
      }>(commentsKey(videoId), (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.map((thread) => ({
                  ...patch(thread),
                  replies: thread.replies.map(patch),
                })) as VideoCommentThread[],
              })),
            }
          : data,
      );
      queryClient.setQueriesData<{ total: number; items: VideoComment[] }>(
        { queryKey: ["videos", "comments", videoId, "replies"] },
        (data) => (data ? { ...data, items: data.items.map(patch) } : data),
      );
    },

    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useDeleteVideoComment(videoId: string) {
  return useMutation({
    mutationFn: (comment: VideoComment) =>
      videosApi.removeComment(videoId, comment.id),

    // A top-level comment takes its replies with it, so the count moves by
    // more than one. The refetch below corrects the guess either way.
    onMutate: (comment) =>
      bumpCommentCount(videoId, -(1 + (comment.replyCount || 0))),

    onSuccess: (_result, comment) => {
      void queryClient.invalidateQueries({ queryKey: commentsKey(videoId) });
      if (comment.parentId) {
        void queryClient.invalidateQueries({
          queryKey: repliesKey(videoId, comment.parentId),
        });
      }
      toast.successKey("comments.deleted");
    },

    onError: (error, comment) => {
      bumpCommentCount(videoId, 1 + (comment.replyCount || 0));
      toast.error(errorMessage(error));
    },
  });
}

/**
 * The heart on a comment. Optimistic across the thread and any expanded
 * replies, because the only thing slower than a like is a like that waits.
 */
export function useToggleVideoCommentLike(videoId: string) {
  return useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
      videosApi.setCommentLike(videoId, id, liked),

    onMutate: ({ id, liked }) => {
      const patch = (c: VideoComment): VideoComment =>
        c.id === id
          ? {
              ...c,
              likedByMe: liked,
              likeCount: Math.max(0, c.likeCount + (liked ? 1 : -1)),
            }
          : c;

      queryClient.setQueryData<{
        pages: VideoCommentsPage[];
        pageParams: unknown[];
      }>(commentsKey(videoId), (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.map((thread) => ({
                  ...patch(thread),
                  replies: thread.replies.map(patch),
                })) as VideoCommentThread[],
              })),
            }
          : data,
      );

      queryClient.setQueriesData<{ total: number; items: VideoComment[] }>(
        { queryKey: ["videos", "comments", videoId, "replies"] },
        (data) => (data ? { ...data, items: data.items.map(patch) } : data),
      );
    },

    onError: (error) => {
      // The counts are re-read rather than rolled back by hand: the thread is
      // the only place they are shown, and one refetch is simpler to trust.
      void queryClient.invalidateQueries({ queryKey: commentsKey(videoId) });
      toast.error(errorMessage(error));
    },
  });
}
