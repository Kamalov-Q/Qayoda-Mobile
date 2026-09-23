// src/features/listings/hooks/useCategories.ts
// Property categories, from the server — admins add, rename, reorder and hide
// them in the dashboard, so the app carries no list of its own.
//
// Offline and cold-start: the last list the server sent is saved on the device
// and loaded at boot (hydrateCategories, awaited in the root layout), so the
// post form and filters open with real categories — including ones an admin
// added after this build shipped — before the network answers.
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listingApi, type Category } from "../api/listings.api";
import { queryClient } from "../../../lib/query-client";
import { useLanguage } from "../../../i18n";
import { categoryGlyph } from "../utils/icons";

const QUERY_KEY = ["categories"] as const;
const STORAGE_KEY = "categories.cache.v1";

/** Fetch, and keep a copy on the device for the next cold start. */
async function fetchCategories(): Promise<Category[]> {
  const list = await listingApi.categories();
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)).catch(() => {
    // Not being able to cache just means the next cold start waits for the
    // network — never a reason to fail the fetch that did succeed.
  });
  return list;
}

/**
 * Loads the saved list into the query cache before the first screen renders.
 * Marked stale on purpose (updatedAt 0) so the first useCategories() still
 * fetches a fresh copy straight away — the saved one only fills the gap.
 */
export async function hydrateCategories(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as unknown;
    if (Array.isArray(saved) && saved.length) {
      queryClient.setQueryData(QUERY_KEY, saved as Category[], {
        updatedAt: 0,
      });
    }
  } catch {
    // Unreadable cache: start empty and let the network fill it.
  }
}

export function useCategories() {
  const language = useLanguage();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchCategories,
    // Categories change rarely; a fresh app launch is soon enough.
    staleTime: 10 * 60_000,
  });

  const categories = useMemo(() => query.data ?? [], [query.data]);

  const bySlug = useMemo(
    () => new Map(categories.map((c) => [c.slug, c])),
    [categories],
  );

  /**
   * Name in the UI language. A slug missing from the list (a category hidden
   * since the listing was posted, or the list not loaded yet) shows the slug
   * rather than a blank.
   */
  const nameOf = useCallback(
    (slug: string | null | undefined) => {
      if (!slug) return "";
      const c = bySlug.get(slug);
      if (!c) return slug;
      return language === "ru" ? c.nameRu : c.nameUz;
    },
    [bySlug, language],
  );

  const iconOf = useCallback(
    (slug: string) => categoryGlyph(bySlug.get(slug)?.icon),
    [bySlug],
  );

  /** Whether listings in this category have floors (unknown → no). */
  const hasFloors = useCallback(
    (slug: string) => bySlug.get(slug)?.floorCapable ?? false,
    [bySlug],
  );

  return {
    categories,
    bySlug,
    nameOf,
    iconOf,
    hasFloors,
    /** True only while there is nothing to show yet (no saved copy either). */
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
