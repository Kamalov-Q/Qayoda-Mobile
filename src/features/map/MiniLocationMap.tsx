// src/features/map/MiniLocationMap.tsx
// Loads the MapKit map only where the binary has it — see mapSupport.ts.
// The implementation is MiniLocationMap.yandex.tsx.
import { loadMapImpl } from "./mapSupport";
import { MapUnavailable } from "./MapUnavailable";
import type * as Impl from "./MiniLocationMap.yandex";

const impl = loadMapImpl(
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy, see mapSupport.ts
  () => require("./MiniLocationMap.yandex").MiniLocationMap,
) as typeof Impl.MiniLocationMap | null;

export const MiniLocationMap: typeof Impl.MiniLocationMap =
  impl ?? (() => <MapUnavailable height={170} />);

export default MiniLocationMap;
