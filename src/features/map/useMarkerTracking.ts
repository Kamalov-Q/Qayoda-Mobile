// src/features/map/useMarkerTracking.ts
// Markers with custom children (a price pill, a vertex dot) are rasterised to a
// bitmap by the Google Maps SDK. Leaving tracksViewChanges on re-rasterises
// every marker on every frame of a pan — that is the jank. Setting it false
// outright is the other trap: on Android the snapshot is taken before the child
// has laid out, so the marker renders blank.
//
// So: track until the child reports its first layout, then stop.
import { useCallback, useState } from "react";

export function useMarkerTracking() {
  const [tracksViewChanges, setTracks] = useState(true);
  const onLayout = useCallback(() => setTracks(false), []);
  return { tracksViewChanges, onLayout };
}
