import { useCallback, useRef, useState } from "react";
import {
  BBox,
  listingApi,
  OfferPurpose,
  ViewportFilters,
} from "../api/listings.api";
import { DEFAULT_BBOX, DEFAULT_ZOOM } from "../utils/geo";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

const DEBOUNCE_MS = 300;

/** `filters` participates in the query key, so the caller should hand in a
 *  debounced value — every distinct object is a refetch. */
export function useMapViewport(
  purpose: OfferPurpose,
  filters: ViewportFilters = {},
  /** Pass the screen's focus — an off-screen map must not refetch. */
  enabled = true,
) {
  const [viewport, setViewport] = useState<{ bbox: BBox; zoom: number }>({
    bbox: DEFAULT_BBOX,
    zoom: DEFAULT_ZOOM,
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onRegionChange = useCallback((bbox: BBox, zoom: number) => {
    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      setViewport({
        // 3 decimals (~110m), not 4: at 4 every finger-twitch pan minted a
        // fresh cache entry holding hundreds of geo-features.
        bbox: {
          west: +bbox.west.toFixed(3),
          south: +bbox.south.toFixed(3),
          east: +bbox.east.toFixed(3),
          north: +bbox.north.toFixed(3),
        },
        zoom: Math.round(zoom),
      });
    }, DEBOUNCE_MS);
  }, []);

  // Normalised so `{}` and `{ address: "" }` share a cache entry. ALL
  // filters participate — category/price used to be silently dropped here,
  // so the map ignored them while the list obeyed.
  const address = filters.address?.trim() || "";
  const effective: ViewportFilters = {
    address: address || undefined,
    category: filters.category,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
  };

  const query = useQuery({
    queryKey: ["listings", "viewport", purpose, viewport, effective],
    // Truncated HERE, not just at render: an old server can still answer with
    // 1000 features, and untruncated they'd sit in the cache (one entry per
    // viewport) until iOS kills the app for memory.
    queryFn: async () => {
      const res = await listingApi.getViewport(
        viewport.bbox,
        viewport.zoom,
        purpose,
        effective,
      );
      return res.features.length > 200
        ? ({ ...res, features: res.features.slice(0, 200) } as typeof res)
        : res;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    // A minute, not the global 5: a zoom session mints an entry per viewport,
    // each holding up to hundreds of polygons — the default gcTime let them
    // pile up until iOS force-quit the app for memory.
    gcTime: 60_000,
    enabled,
  });

  return { ...query, viewport, onRegionChange };
}
