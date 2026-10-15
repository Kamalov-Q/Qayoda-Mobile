// Extends app.json — everything static stays there; this file only adds what
// needs an env var.
//
// Maps need no key: they are MapLibre drawing OpenFreeMap's street tiles
// (see MAP_STYLE_URL in src/features/map/maps.ts). The MapLibre config plugin
// is a static entry in app.json.
import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  // Reversed iOS client id, e.g. com.googleusercontent.apps.1234-abcd. The
  // config plugin exists only to register it as a URL scheme so Google can
  // return to the app; Android needs no plugin (package name + SHA-1 in Google
  // Cloud is the whole setup). Unset → no plugin, and iOS Google sign-in stays
  // hidden rather than failing at prebuild.
  const googleIosScheme = process.env.GOOGLE_IOS_URL_SCHEME;

  return {
    ...(config as ExpoConfig),
    plugins: [
      ...(config.plugins ?? []),
      ...(googleIosScheme
        ? [
            [
              "@react-native-google-signin/google-signin",
              { iosUrlScheme: googleIosScheme },
            ] as [string, object],
          ]
        : []),
    ],
  };
};
