// src/features/map/MiniLocationMap.tsx
// Loads the MapLibre map only where the binary has it — see mapSupport.ts.
// The implementation is MiniLocationMap.maplibre.tsx.
import { MAP_SUPPORTED } from "./mapSupport";
import { MapUnavailable } from "./MapUnavailable";
import type * as Impl from "./MiniLocationMap.maplibre";

export const MiniLocationMap: typeof Impl.MiniLocationMap = MAP_SUPPORTED
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy, see mapSupport.ts
    require("./MiniLocationMap.maplibre").MiniLocationMap
  : () => <MapUnavailable height={170} />;

export default MiniLocationMap;
