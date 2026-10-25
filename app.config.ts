// Extends app.json — everything static stays there; this file only adds what
// needs an env var.
//
// Yandex MapKit needs its key baked into the native binary, so the plugin
// lives here rather than in app.json. The key is build-time only: it never
// reaches the JS bundle, and MapKit initializes itself at startup, so nothing
// in the app calls initialize().
import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * The MapKit key, or undefined.
 *
 * It does NOT throw when absent, and that is deliberate. EAS CLI evaluates
 * this file with EXPO_NO_DOTENV=1 — it manages environment variables itself
 * through `eas env` — so .env is not loaded for `eas init`, `eas env:*`,
 * `eas build` or any other command that reads the config. A hard throw here
 * made every one of them fail with a bare "config --json exited with
 * non-zero code: 1", which points nowhere near the cause.
 *
 * The protection that matters is kept: on a real cloud build the secret IS
 * injected, so a missing key there is a genuine misconfiguration and still
 * stops the build rather than shipping an app whose every map is blank.
 * Everywhere else it is a loud warning and the build carries on.
 */
function mapKitApiKey(): string | undefined {
  const key = process.env.YANDEX_MAPKIT_API_KEY;
  if (key) return key;

  if (process.env.EAS_BUILD === "true") {
    throw new Error(
      "YANDEX_MAPKIT_API_KEY is not set for this build — every map would " +
        "render blank. Add it with: eas env:set --name YANDEX_MAPKIT_API_KEY",
    );
  }

  // Silent under EXPO_NO_DOTENV, which is how EAS CLI reads this file: .env
  // is not loaded there BY DESIGN, so a missing key is expected and warning
  // about it just prints a scary line four times during `eas init`.
  if (!process.env.EXPO_NO_DOTENV) {
    console.warn(
      "[app.config] YANDEX_MAPKIT_API_KEY is not set — a prebuild from here " +
        "produces a binary whose maps are blank. Add it to .env.",
    );
  }
  return undefined;
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
