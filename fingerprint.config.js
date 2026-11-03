/**
 * What counts as a NATIVE change, for the fingerprint runtime version.
 *
 * `runtimeVersion.policy` in app.json is "fingerprint": a hash of the native
 * project. An EAS update is only ever offered to a binary whose fingerprint
 * matches, which is what stops a JS bundle that needs native code the
 * installed app lacks from being handed to it.
 *
 * The default hashes the WHOLE of package.json — `scripts` included. So
 * adding a developer convenience like `"release:check": "bash scripts/…"`
 * silently changes the runtime version, and every app already installed
 * stops receiving updates until a new store build ships. Nothing warns
 * about it. That is how the Android store build sat on SDK 57 for two
 * weeks while updates were published against SDK 58 and reached nobody.
 *
 * PackageJsonScriptsAll drops `scripts` from the hash. Dependencies, config
 * plugins, permissions, icons and native modules all still count — those
 * genuinely change the binary, and an update published across one of them
 * SHOULD be withheld.
 *
 * ⚠ The one thing this gives up: EAS Build runs the `eas-build-*` hooks out
 * of package.json `scripts` (pre-install, post-install, on-success). Adding
 * or changing one of those now changes the build without changing the
 * fingerprint. There are none today; if one is ever added, bump a native
 * input deliberately or drop this skip.
 *
 * Check the effect of any change here with:  bash scripts/release-check.sh
 */
const { SourceSkips } = require('@expo/fingerprint');

module.exports = {
  sourceSkips: SourceSkips.PackageJsonScriptsAll,
};
