// Extends app.json — everything static stays there; this file only adds what
// needs an env var. react-native-maps reads the Google Maps key from the native
// binary (not at runtime), so it is injected here at config time from
// GOOGLE_MAPS_API_KEY in .env, which is never committed.
//
// Expo Go bundles its own key, so this is only required for dev/production
// builds: without it the map renders as a blank grey grid.
import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
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
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        ...(apiKey ? { googleMapsApiKey: apiKey } : {}),
      },
    },
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        ...(apiKey ? { googleMaps: { apiKey } } : {}),
      },
    },
  };
};
