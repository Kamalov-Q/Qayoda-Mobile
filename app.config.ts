// Extends app.json — everything static stays there; this file only adds what
// needs an env var.
//
// Nothing does, at present. Maps are MapLibre drawing OpenFreeMap's street
// tiles and Esri's imagery (see src/features/map/mapStyles.ts); neither
// takes a key, and the MapLibre config plugin is a static entry in app.json.
//
// Kept rather than deleted because the moment one secret needs to reach a
// native build, this is where it goes — and because a config that throws on
// a missing key, which is what lived here under Yandex MapKit, broke
// `expo export` and every CI build that did not source .env first.
import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => config as ExpoConfig;
