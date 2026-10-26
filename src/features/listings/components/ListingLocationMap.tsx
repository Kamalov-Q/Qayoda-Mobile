// src/features/listings/components/ListingLocationMap.tsx
// Loads the MapLibre map only where the binary has it — see
// map/mapSupport.ts. The implementation is ListingLocationMap.maplibre.tsx.
import { MAP_SUPPORTED } from "../../map/mapSupport";
import { MapUnavailable } from "../../map/MapUnavailable";
import type * as Impl from "./ListingLocationMap.maplibre";

export const ListingLocationMap: typeof Impl.ListingLocationMap = MAP_SUPPORTED
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy, see mapSupport.ts
    require("./ListingLocationMap.maplibre").ListingLocationMap
  : () => <MapUnavailable height={170} />;
