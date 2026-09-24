import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  COMMENTS_PAGE,
  commentsApi,
  type Comment,
  type CommentImage,
  type CommentThread,
  type CommentsPage,
} from "../api/comments.api";
import { queryClient } from "@/src/lib/query-client";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";

const commentsKey = (listingId: string) => ["comments", listingId] as const;
const repliesKey = (listingId: string, commentId: string) =>
  ["comments", listingId, "replies", commentId] as const;

/** The thread under a listing, a page at a time. */
export function useComments(listingId: string | undefined, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: commentsKey(listingId ?? ""),
    queryFn: ({ pageParam }) =>
      commentsApi.list(listingId!, COMMENTS_PAGE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.items.length < COMMENTS_PAGE
        ? undefined
        : pages.length * COMMENTS_PAGE,
    enabled: !!listingId && enabled,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  return { ...query, items, total: query.data?.pages[0]?.total ?? 0 };
}

/**
 * The rest of one comment's replies. Only fetched once the reader asks to
 * see them — a thread's first two arrive with the comment itself, and most
 * are never expanded.
 */
export function useReplies(
  listingId: string,
  commentId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: repliesKey(listingId, commentId),
    queryFn: () => commentsApi.replies(listingId, commentId, 50, 0),
    enabled,
  });
}

const refresh = (listingId: string) => {
  void queryClient.invalidateQueries({ queryKey: commentsKey(listingId) });
};

export function usePostComment(listingId: string) {
  return useMutation({
    mutationFn: ({
      body,
      parentId,
      image,
    }: {
      body: string;
      parentId?: string;
      image?: CommentImage;
    }) => commentsApi.create(listingId, body, parentId, image),
    onSuccess: (_comment, { parentId }) => {
      refresh(listingId);
      // A reply changes an expanded list that the thread refresh does not own.
      if (parentId) {
        void queryClient.invalidateQueries({
          queryKey: repliesKey(listingId, parentId),
        });
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useEditComment(listingId: string) {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      commentsApi.update(listingId, id, body),
    onSuccess: (comment) => {
      refresh(listingId);
      if (comment.parentId) {
        void queryClient.invalidateQueries({
          queryKey: repliesKey(listingId, comment.parentId),
        });
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useDeleteComment(listingId: string) {
  return useMutation({
    mutationFn: (comment: Comment) => commentsApi.remove(listingId, comment.id),
    onSuccess: (_res, comment) => {
      toast.successKey("comments.deleted");
      refresh(listingId);
      if (comment.parentId) {
        void queryClient.invalidateQueries({
          queryKey: repliesKey(listingId, comment.parentId),
        });
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

type Pages = { pages: CommentsPage[]; pageParams: unknown[] };

/**
 * The heart. Optimistic, because a like that waits for a round trip before
 * filling in feels broken — and it is the one action people repeat quickly.
 * Rolled back on failure; nothing is invalidated on success, since the
 * server's answer is what the optimistic write already applied.
 */
export function useToggleCommentLike(listingId: string) {
  return useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
      commentsApi.setLike(listingId, id, liked),

    onMutate: async ({ id, liked }) => {
      const key = commentsKey(listingId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Pages>(key);

      const apply = (c: Comment): Comment =>
        c.id === id
          ? {
              ...c,
              likedByMe: liked,
              likeCount: Math.max(0, c.likeCount + (liked ? 1 : -1)),
            }
          : c;

      queryClient.setQueryData<Pages>(key, (current) =>
        current
          ? {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                items: page.items.map(
                  (thread): CommentThread => ({
                    ...apply(thread),
                    replies: thread.replies.map(apply),
                  }),
                ),
              })),
            }
          : current,
      );

      return { previous };
    },

    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(commentsKey(listingId), context.previous);
      }
      toast.error(errorMessage(error));
    },
  });
}
