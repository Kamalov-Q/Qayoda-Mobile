// src/features/map/useMarkerTracking.ts
// Markers with custom children (a price pill, a vertex dot) are rasterised to a
// bitmap by the Google Maps SDK. Leaving tracksViewChanges on re-rasterises
// every marker on every frame of a pan — that is the jank. Setting it false
// outright is the other trap: on Android the snapshot is taken before the child
// has laid out, so the marker renders blank.
//
// So: track until the child lays out, then a beat longer — layout fires before
// the TEXT inside has drawn on Android, and stopping at that instant is how
// bubbles snapshotted mid-render ("$5" out of "$50,000") got frozen clipped.
import { Platform } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";

// Android's snapshot needs visibly longer than the layout event on budget
// hardware — freezing early is how bubbles got stuck mid-render ("$5").
const SETTLE_MS = Platform.OS === "android" ? 1500 : 500;

export function useMarkerTracking() {
  const [tracksViewChanges, setTracks] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onLayout = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTracks(false), SETTLE_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { tracksViewChanges, onLayout };
}
