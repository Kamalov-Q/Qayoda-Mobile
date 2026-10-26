// src/features/map/ListingsMap.tsx
// Loads the MapLibre map only where the binary has it — see mapSupport.ts.
// The implementation is ListingsMap.maplibre.tsx.
import { MAP_SUPPORTED } from "./mapSupport";
import { MapUnavailable } from "./MapUnavailable";
import type * as Impl from "./ListingsMap.maplibre";

export type { ListingsMapHandle, RadiusCircle } from "./ListingsMap.maplibre";

export const ListingsMap: typeof Impl.ListingsMap = MAP_SUPPORTED
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy, see mapSupport.ts
    require("./ListingsMap.maplibre").ListingsMap
  : ((() => <MapUnavailable />) as unknown as typeof Impl.ListingsMap);

export default ListingsMap;
