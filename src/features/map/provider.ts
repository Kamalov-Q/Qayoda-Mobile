// One switch for the map engine everywhere.
//
// Google's Uzbekistan cartography (building footprints, mahalla labels,
// bazaars) beats Apple's by a mile — it is what the polished local apps run
// on. The native Google SDK needs a key and, on iOS, a dev build:
//   - Android: works in Expo Go and dev builds alike (Expo Go ships it).
//   - iOS: only in dev/production builds; Expo Go iOS would crash on the
//     Google provider, so it stays on Apple there.
// No key set → Apple/default everywhere, exactly as before.
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from "react-native-maps";

const HAS_KEY = process.env.EXPO_PUBLIC_USE_GOOGLE_MAPS === "1";
const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const MAP_PROVIDER =
  HAS_KEY && !(Platform.OS === "ios" && IS_EXPO_GO)
    ? PROVIDER_GOOGLE
    : PROVIDER_DEFAULT;
