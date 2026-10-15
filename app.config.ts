// Extends app.json — everything static stays there; this file only adds what
// needs an env var.
//
// Maps need no key: they are MapLibre drawing OpenFreeMap's street tiles
// (see MAP_STYLE_URL in src/features/map/maps.ts). The MapLibre config plugin
// is a static entry in app.json.
import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...(config as ExpoConfig),
    plugins: [...(config.plugins ?? [])],
  };
};
