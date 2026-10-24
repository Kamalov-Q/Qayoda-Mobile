// src/features/map/ListingsMap.tsx
// Loads the MapKit map only where the binary has it — see mapSupport.ts.
// The implementation is ListingsMap.yandex.tsx.
import { loadMapImpl } from "./mapSupport";
import { MapUnavailable } from "./MapUnavailable";
import type * as Impl from "./ListingsMap.yandex";

export type { ListingsMapHandle, RadiusCircle } from "./ListingsMap.yandex";

const impl = loadMapImpl(
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy, see mapSupport.ts
  () => require("./ListingsMap.yandex").ListingsMap,
) as typeof Impl.ListingsMap | null;

export const ListingsMap: typeof Impl.ListingsMap =
  impl ?? ((() => <MapUnavailable />) as unknown as typeof Impl.ListingsMap);

export default ListingsMap;
