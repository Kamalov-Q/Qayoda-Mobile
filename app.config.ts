// Extends app.json — everything static stays there; this file only adds what
// needs an env var.
//
// Yandex MapKit needs its key baked into the native binary, so the plugin
// lives here rather than in app.json. The key is build-time only: it never
// reaches the JS bundle, and MapKit initializes itself at startup, so nothing
// in the app calls initialize().
import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Missing key = a map that renders an empty grey field with no error, which
 * is a confusing hour to spend. Prebuild is the last place this can be caught
 * cheaply, so it is caught loudly here instead.
 */
function mapKitApiKey(): string {
  const key = process.env.YANDEX_MAPKIT_API_KEY;
  if (!key) {
    throw new Error(
      "YANDEX_MAPKIT_API_KEY is not set — every map would render blank. " +
        "Add it to .env (see .env.example).",
    );
  }
  return key;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...(config as ExpoConfig),
    plugins: [
      ...(config.plugins ?? []),
      [
        "expo-yandex-mapkit",
        {
          apiKey: mapKitApiKey(),
          // "lite" deliberately: search / suggest / routing inside the SDK
          // need the "full" flavour, which Yandex ties to the paid Advanced
          // licence. Address lookup goes over the HTTP Geocoder instead —
          // see src/features/map/geocoder.ts.
          flavor: "lite",
          // expo-location already writes the iOS usage string and the Android
          // permissions (see app.json). Declaring them here too would mean two
          // plugins fighting over the same Info.plist key.
        },
      ],
    ],
  };
};
