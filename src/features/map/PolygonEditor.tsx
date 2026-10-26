// src/features/map/PolygonEditor.tsx
// Loads the MapLibre map only where the binary has it — see mapSupport.ts.
// The implementation is PolygonEditor.maplibre.tsx.
import { MAP_SUPPORTED } from "./mapSupport";
import { MapUnavailable } from "./MapUnavailable";
import type * as Impl from "./PolygonEditor.maplibre";

export const PolygonEditor: typeof Impl.PolygonEditor = MAP_SUPPORTED
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy, see mapSupport.ts
    require("./PolygonEditor.maplibre").PolygonEditor
  : ((() => <MapUnavailable />) as unknown as typeof Impl.PolygonEditor);

export default PolygonEditor;
