// src/features/map/PinPicker.tsx
// Loads the MapLibre map only where the binary has it — see mapSupport.ts.
// The implementation is PinPicker.maplibre.tsx.
import { MAP_SUPPORTED } from "./mapSupport";
import { MapUnavailable } from "./MapUnavailable";
import type * as Impl from "./PinPicker.maplibre";

export const PinPicker: typeof Impl.PinPicker = MAP_SUPPORTED
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy, see mapSupport.ts
    require("./PinPicker.maplibre").PinPicker
  : ({ onCancel }) => <MapUnavailable onCancel={onCancel} />;
