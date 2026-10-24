import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { queryClient } from "@/src/lib/query-client";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";
import {
  FOLLOW_PAGE,
  followsApi,
  type FollowPage,
  type FollowState,
} from "../api/follows.api";

const stateKey = (userId: string) => ["follows", "state", userId] as const;

/** The button's state and the two numbers under a profile's name. */
export function useFollowState(userId: string | undefined) {
  return useQuery({
    queryKey: stateKey(userId ?? ""),
    queryFn: () => followsApi.state(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/**
 * Follow and unfollow.
 *
 * Optimistic on the state and on every list row that mentions this person: a
 * follow button that waits for a round trip before changing is the one
 * interaction people reliably tap twice, and the second tap would undo the
 * first.
 */
export function useToggleFollow() {
  return useMutation({
    mutationFn: ({ userId, next }: { userId: string; next: boolean }) =>
      followsApi.setFollow(userId, next),

    onMutate: ({ userId, next }) => {
      const previous = queryClient.getQueryData<FollowState>(stateKey(userId));

      queryClient.setQueryData<FollowState>(stateKey(userId), (state) =>
        state
          ? {
              ...state,
              following: next,
              followerCount: Math.max(0, state.followerCount + (next ? 1 : -1)),
            }
          : state,
      );

      // The same person can be a row in several lists at once (their own
      // followers, somebody else's following). All of them flip.
      queryClient.setQueriesData<{
        pages: FollowPage[];
        pageParams: unknown[];
      }>({ queryKey: ["follows", "list"] }, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.map((person) =>
                  person.id === userId
                    ? { ...person, followedByMe: next }
                    : person,
                ),
              })),
            }
          : data,
      );

      return { previous };
    },

    onSuccess: (state, { userId }) => {
      queryClient.setQueryData(stateKey(userId), state);
      // The Following feed is a different set of videos now.
      void queryClient.invalidateQueries({ queryKey: ["videos", "feed"] });
    },

    onError: (error, { userId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(stateKey(userId), context.previous);
      }
      void queryClient.invalidateQueries({ queryKey: ["follows"] });
      toast.error(errorMessage(error));
    },
  });
}

/** One of the two lists on a profile, paged. */
export function useFollowList(
  userId: string | undefined,
  tab: "followers" | "following",
  /**
   * Narrows the list by name, on the server. Already debounced by the field
   * that collects it. Empty searches the whole list, which is the default
   * and the common case.
   */
  q = "",
) {
  const term = q.trim();
  const query = useInfiniteQuery({
    // The term is part of the key: clearing the box must go back to the full
    // list from cache rather than refetching it.
    queryKey: ["follows", "list", tab, userId, term] as const,
    queryFn: ({ pageParam }) =>
      tab === "followers"
        ? followsApi.followers(userId!, FOLLOW_PAGE, pageParam, term)
        : followsApi.following(userId!, FOLLOW_PAGE, pageParam, term),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.items.length < FOLLOW_PAGE
        ? undefined
        : pages.length * FOLLOW_PAGE,
    enabled: !!userId,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  return { ...query, items, total: query.data?.pages[0]?.total ?? 0 };
}
