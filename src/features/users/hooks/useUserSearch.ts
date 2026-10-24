import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { USER_SEARCH_PAGE, usersApi } from "../api/users.api";

/**
 * Below this, a term is treated as absent rather than as a search.
 *
 * One character matches most of any real directory, so the server would rank
 * thousands of rows to answer a question nobody has finished asking — and
 * showing "nothing found" to someone mid-word is the wrong answer anyway.
 * The browse list is what they see instead.
 */
export const MIN_USER_QUERY = 2;

/**
 * The sellers directory: everyone with a live listing, busiest first, and
 * narrowed by name once somebody types.
 *
 * Browse and search are ONE query rather than two hooks, because they are
 * one screen: the list is always there and typing filters it. Dropping below
 * the minimum restores the full list instead of emptying it, which is what
 * backspacing out of a search should do.
 *
 * The caller passes an already-debounced string — DebouncedTextField does
 * that at the field, so nothing here owns a timer.
 */
export function useUserSearch(q = "") {
  const raw = q.trim();
  const term = raw.length >= MIN_USER_QUERY ? raw : "";

  const query = useInfiniteQuery({
    // The term is part of the key, so clearing the box returns to the full
    // list from cache rather than refetching it.
    queryKey: ["users", "directory", term] as const,
    queryFn: ({ pageParam }) =>
      usersApi.search(term, USER_SEARCH_PAGE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.items.length < USER_SEARCH_PAGE
        ? undefined
        : pages.length * USER_SEARCH_PAGE,
    // A directory does not change while somebody scrolls it, and backspacing
    // a letter should hit the cache rather than the network.
    staleTime: 60_000,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  return {
    ...query,
    items,
    total: query.data?.pages[0]?.total ?? 0,
    /** Whether a name is actually narrowing the list, for the empty state. */
    searching: !!term,
  };
}
