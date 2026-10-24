// Lets the app see which navigation apps are installed (src/lib/navigation-apps.ts).
//
// Since Android 11 an app may only ask about other apps it declares in
// <queries>. Without these entries Linking.canOpenURL answered false for every
// maps app, so the "Navigate" sheet could not tell an installed Yandex
// Navigator from a missing one. This is Android's counterpart of
// LSApplicationQueriesSchemes in app.json.
const { withAndroidManifest } = require("expo/config-plugins");

const SCHEMES = ["yandexnavi", "yandexmaps", "google.navigation"];

module.exports = function withNavAppQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries ?? [{}];
    const queries = manifest.queries[0];
    queries.intent = queries.intent ?? [];

    for (const scheme of SCHEMES) {
      const present = queries.intent.some((i) =>
        i.data?.some((d) => d.$?.["android:scheme"] === scheme),
      );
      if (present) continue;
      queries.intent.push({
        action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
        data: [{ $: { "android:scheme": scheme } }],
      });
    }
    return cfg;
  });
};
