// src/features/map/mapLogging.ts
// Keeps MapLibre's own chatter out of the red error overlay.
//
// Importing this file installs the filter; there is nothing to call. It is
// imported by the `.maplibre` implementations rather than from anywhere
// higher up, because reaching into the library binds its TurboModules — the
// exact thing mapSupport.ts exists to avoid on a binary without them.
//
// WHY THIS IS NEEDED
//
// MapLibre Native logs two things at ERROR level that are not errors, and
// LogManager turns anything at that level into `console.error` — which in a
// development build is a full-screen LogBox over the app:
//
//   [Mbgl-LocationComponent] Failed to obtain last location update
//     The location component asked Android for a CACHED fix and there is not
//     one yet. It happens on every emulator, on a cold GPS, and any time
//     location permission has not been granted — and it resolves itself the
//     moment a real fix arrives. Nothing is broken and nothing is retried.
//
//   [Mbgl] Invalid geometry in <...> layer
//     A tile from OpenFreeMap carries a geometry the renderer skips. It is a
//     property of the data, not of this app, and the map draws correctly
//     without that one feature.
//
// Neither is actionable, and both fire often enough to bury a real error
// under a stack of dismissals — which is the actual cost: an overlay nobody
// reads is an overlay that hides the next genuine bug.
//
// They are DOWNGRADED, not dropped: each still prints through console.info,
// so `adb logcat` and the Metro console keep the full record. Anything this
// does not recognise is handed back to the library untouched.
//
// The library does the same thing one level down — see `effectiveLevel`,
// which demotes cancelled HTTP requests from warn to info.
import { LogManager } from "@maplibre/maplibre-react-native";

/**
 * Known-benign entries, as [tag, message prefix].
 *
 * Matched on a PREFIX rather than the whole string: both messages carry a
 * trailing detail (a layer name, a provider error) that varies, and a rule
 * that only matches one phrasing would quietly stop working.
 */
const BENIGN: readonly (readonly [string, string])[] = [
  ["Mbgl-LocationComponent", "Failed to obtain last location update"],
  ["Mbgl", "Invalid geometry in"],
];

LogManager.onLog(({ level, tag, message }) => {
  const benign = BENIGN.some(
    ([t, prefix]) => tag === t && message.startsWith(prefix),
  );
  if (!benign) return false;

  // Kept in the log stream, just not at a level that interrupts anybody.
  console.info(`MapLibre Native [${level}] [${tag}] ${message}`);
  return true;
});
