// src/features/map/PinPicker.tsx
// Loads the MapKit map only where the binary has it — see mapSupport.ts.
// The implementation is PinPicker.yandex.tsx.
import { loadMapImpl } from "./mapSupport";
import { MapUnavailable } from "./MapUnavailable";
import type * as Impl from "./PinPicker.yandex";

const impl = loadMapImpl(
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy, see mapSupport.ts
  () => require("./PinPicker.yandex").PinPicker,
) as typeof Impl.PinPicker | null;

export const PinPicker: typeof Impl.PinPicker =
  impl ?? (({ onCancel }) => <MapUnavailable onCancel={onCancel} />);
