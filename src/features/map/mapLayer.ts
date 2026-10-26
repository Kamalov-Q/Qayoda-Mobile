// src/features/map/mapLayer.ts — which of the two maps is showing.
//
// One switch for every map in the app rather than one per screen: somebody
// who turned satellite on to check a roof in the pin picker is still
// checking roofs when they open the next listing, and a toggle that forgets
// is a toggle they have to find again every time.
//
// Not persisted. The choice lasts the session, which is the span the
// intention lasts; a satellite map restored on a cold start is a surprise.
import { create } from "zustand";
import { SATELLITE_STYLE, STREET_STYLE } from "./mapStyles";

export type MapLayer = "street" | "satellite";

interface MapLayerState {
  layer: MapLayer;
  toggle: () => void;
}

export const useMapLayerStore = create<MapLayerState>((set) => ({
  // Street by default. Satellite is the better answer to "which building is
  // this" and the worse answer to "where is this" — and the browse map, the
  // one most people open first, is asking the second question.
  layer: "street",
  toggle: () =>
    set((s) => ({ layer: s.layer === "street" ? "satellite" : "street" })),
}));

/** What to hand <Map mapStyle>. A URL for street, a style object for satellite. */
export function useMapStyle() {
  const layer = useMapLayerStore((s) => s.layer);
  return layer === "satellite" ? SATELLITE_STYLE : STREET_STYLE;
}
