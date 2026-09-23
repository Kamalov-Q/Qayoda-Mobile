// src/features/listings/hooks/useAmenities.ts
// Listing amenities, from the server — admins add, rename, reorder and hide
// them in the dashboard, so the app carries no list of its own. The exact
// sibling of useCategories, including the offline copy: the last list the
// server sent is saved on the device and loaded at boot (hydrateAmenities,
// awaited in the root layout), so the post form's chips render real amenities
// before the network answers.
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listingApi, type Amenity } from "../api/listings.api";
import { queryClient } from "../../../lib/query-client";
import { useLanguage } from "../../../i18n";

const QUERY_KEY = ["amenities"] as const;
const STORAGE_KEY = "amenities.cache.v1";

/** Fetch, and keep a copy on the device for the next cold start. */
async function fetchAmenities(): Promise<Amenity[]> {
  const list = await listingApi.amenities();
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)).catch(() => {
    // Not being able to cache just means the next cold start waits for the
    // network — never a reason to fail the fetch that did succeed.
  });
  return list;
}

/**
 * Loads the saved list into the query cache before the first screen renders.
 * Marked stale on purpose (updatedAt 0) so the first useAmenities() still
 * fetches a fresh copy straight away — the saved one only fills the gap.
 */
export async function hydrateAmenities(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as unknown;
    if (Array.isArray(saved) && saved.length) {
      queryClient.setQueryData(QUERY_KEY, saved as Amenity[], {
        updatedAt: 0,
      });
    }
  } catch {
    // Unreadable cache: start empty and let the network fill it.
  }
}

export function useAmenities() {
  const language = useLanguage();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchAmenities,
    // Amenities change rarely; a fresh app launch is soon enough.
    staleTime: 10 * 60_000,
  });

  const amenities = useMemo(() => query.data ?? [], [query.data]);

  const byKey = useMemo(
    () => new Map(amenities.map((a) => [a.key, a])),
    [amenities],
  );

  /**
   * Label in the UI language. A key missing from the list (an amenity hidden
   * or deleted since the listing was posted, or the list not loaded yet)
   * shows the key rather than a blank.
   */
  const nameOf = useCallback(
    (key: string | null | undefined) => {
      if (!key) return "";
      const a = byKey.get(key);
      if (!a) return key;
      return language === "ru" ? a.nameRu : a.nameUz;
    },
    [byKey, language],
  );

  return {
    amenities,
    byKey,
    nameOf,
    /** True only while there is nothing to show yet (no saved copy either). */
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
