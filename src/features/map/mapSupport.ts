// src/features/map/mapSupport.ts
// Whether this binary carries MapLibre's native code. Expo Go does not — and
// @maplibre/maplibre-react-native binds its TurboModules the moment it is
// imported, so a screen that merely imports a map threw before rendering
// anything. The map components check this and load MapLibre only when it is
// there; without it they render MapUnavailable and the rest of the app works.
import { TurboModuleRegistry } from "react-native";

export const MAP_SUPPORTED = TurboModuleRegistry.get("MLRNCameraModule") != null;
