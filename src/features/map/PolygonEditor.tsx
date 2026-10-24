// src/features/map/PolygonEditor.tsx
// Loads the MapKit map only where the binary has it — see mapSupport.ts.
// The implementation is PolygonEditor.yandex.tsx.
import { loadMapImpl } from "./mapSupport";
import { MapUnavailable } from "./MapUnavailable";
import type * as Impl from "./PolygonEditor.yandex";

const impl = loadMapImpl(
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy, see mapSupport.ts
  () => require("./PolygonEditor.yandex").PolygonEditor,
) as typeof Impl.PolygonEditor | null;

export const PolygonEditor: typeof Impl.PolygonEditor =
  impl ?? ((() => <MapUnavailable />) as unknown as typeof Impl.PolygonEditor);

export default PolygonEditor;
