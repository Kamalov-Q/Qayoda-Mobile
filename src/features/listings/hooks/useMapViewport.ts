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
        bbox: {
          west: +bbox.west.toFixed(4),
          south: +bbox.south.toFixed(4),
          east: +bbox.east.toFixed(4),
          north: +bbox.north.toFixed(4),
        },
        zoom: Math.round(zoom),
      });
    }, DEBOUNCE_MS);
  }, []);

  // Normalised so `{}` and `{ address: "" }` share a cache entry.
  const address = filters.address?.trim() || "";

  const query = useQuery({
    queryKey: ["listings", "viewport", purpose, viewport, address],
    queryFn: () =>
      listingApi.getViewport(viewport.bbox, viewport.zoom, purpose, {
        address: address || undefined,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  return { ...query, viewport, onRegionChange };
}
