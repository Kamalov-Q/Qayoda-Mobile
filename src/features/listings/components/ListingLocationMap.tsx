// src/features/listings/components/ListingLocationMap.tsx
// Loads the MapKit map only where the binary has it — see mapSupport.ts.
// The implementation is ListingLocationMap.yandex.tsx.
import { loadMapImpl } from "../../map/mapSupport";
import { MapUnavailable } from "../../map/MapUnavailable";
import type * as Impl from "./ListingLocationMap.yandex";

const impl = loadMapImpl(
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy, see mapSupport.ts
  () => require("./ListingLocationMap.yandex").ListingLocationMap,
) as typeof Impl.ListingLocationMap | null;

export const ListingLocationMap: typeof Impl.ListingLocationMap =
  impl ?? (() => <MapUnavailable height={170} />);
