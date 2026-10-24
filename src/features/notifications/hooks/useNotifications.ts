import { useMemo } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/src/lib/query-client";
import { useAuthStore } from "@/src/features/auth/store/auth.store";
import { NOTIFICATIONS_PAGE, notificationsApi } from "../api/notifications.api";

const LIST_KEY = ["notifications", "list"] as const;
const UNREAD_KEY = ["notifications", "unread"] as const;

/** How often the bell re-checks while the app is open. */
const UNREAD_POLL_MS = 60_000;

/**
 * The number on the bell.
 *
 * Polled rather than pushed: there is no device-token plumbing in this app,
 * and a minute is well inside the resolution anybody expects from a dot.
 * React Query's own refetch-on-focus does the rest — coming back to the app
 * is the moment people look.
 */
export function useUnreadNotifications() {
  const authed = useAuthStore((s) => s.status === "authenticated");

  const query = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: notificationsApi.unreadCount,
    enabled: authed,
    refetchInterval: UNREAD_POLL_MS,
    staleTime: 30_000,
  });

  return query.data?.count ?? 0;
}

/** The inbox itself, a page at a time. */
export function useNotifications() {
  const authed = useAuthStore((s) => s.status === "authenticated");

  const query = useInfiniteQuery({
    queryKey: LIST_KEY,
    queryFn: ({ pageParam }) =>
      notificationsApi.list(NOTIFICATIONS_PAGE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.items.length < NOTIFICATIONS_PAGE
        ? undefined
        : pages.length * NOTIFICATIONS_PAGE,
    enabled: authed,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  return { ...query, items, total: query.data?.pages[0]?.total ?? 0 };
}

/**
 * Marking the inbox read.
 *
 * Called when the screen opens, and optimistic on the count: the dot should
 * go the moment the list appears, not a round trip later. The list itself is
 * left as it is — rows fading from "new" to "seen" under the reader's eyes
 * is a distraction, and the next fetch will carry the real state.
 */
export function useMarkNotificationsRead() {
  return useMutation({
    mutationFn: (ids?: string[]) => notificationsApi.markRead(ids),
    onMutate: () => queryClient.setQueryData(UNREAD_KEY, { count: 0 }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
    },
  });
}
