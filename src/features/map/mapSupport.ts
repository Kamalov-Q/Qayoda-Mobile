// src/features/map/mapSupport.ts
// Whether this binary carries Yandex MapKit's native code. Expo Go does not —
// and expo-yandex-mapkit binds its native module the moment it is imported, so
// a screen that merely imports a map threw before rendering anything. The map
// components check this and load MapKit only when it is there; without it they
// render MapUnavailable and the rest of the app works.
import { requireOptionalNativeModule } from "expo";

export const MAP_SUPPORTED =
  requireOptionalNativeModule("ExpoYandexMapKit") != null;

/**
 * Load a map implementation, or quietly give up.
 *
 * Two questions, and only one of them is answerable in advance.
 * `MAP_SUPPORTED` answers "is a native module registered under that name",
 * which is a proxy for the one that matters: "will importing the
 * implementation work". In Expo Go those two have been seen to disagree — the
 * registry says nothing is there, the require happens anyway, and the package
 * throws `Cannot find native module 'ExpoYandexMapKit'` from its own module
 * scope, which LogBox then pins on whatever file the evaluation pointer
 * happened to be inside (verification.api.ts, in one memorable case).
 *
 * So the require is tried rather than predicted. On a real build this costs a
 * try/catch that never catches; in Expo Go it is the difference between a red
 * screen and the fallback the map screens already have. It also covers the
 * other direction — a build where MapKit is present but fails to initialise,
 * which used to be a crash and is now a map that says it is unavailable.
 */
export function loadMapImpl<T>(load: () => T): T | null {
  if (!MAP_SUPPORTED) return null;
  try {
    return load();
  } catch {
    return null;
  }
}
