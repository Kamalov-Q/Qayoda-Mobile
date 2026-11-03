#!/usr/bin/env bash
#
# Can this release go out over the air, or does it need a store build?
#
# `runtimeVersion.policy` is "fingerprint": a hash of the NATIVE project —
# native dependencies, config plugins, permissions, icons. An update is only
# ever offered to a binary whose fingerprint matches, which is what stops a
# JS bundle that needs native code the installed app lacks from crashing it.
#
# The failure mode is silent. Change anything native, publish an update, and
# EAS accepts it happily — it just reaches nobody, because no shipped build
# carries that runtime any more. That is how Android spent two weeks on an
# SDK 57 store build while updates were published against SDK 58.
#
# So: run this before every release. OTA = publish. BUILD = the store build
# is mandatory, and an `eas update` on its own would go nowhere.
#
#   npm run release:check
#
# Read-only. It builds no artefact and publishes nothing.
set -euo pipefail

# eas-cli prints an upgrade banner to STDOUT ahead of its --json payload, so
# neither output can be handed to JSON.parse whole. Slice from the first
# bracket; that is where the document starts in both cases.
hash_of() {
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s.slice(s.indexOf('{'))).hash)}catch{console.log('?')}})"
}

runtime_of() {
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const b=JSON.parse(s.slice(s.indexOf('[')))[0];const v=b&&(b.runtime&&b.runtime.version||b.fingerprint&&b.fingerprint.hash);console.log(v||'none')}catch{console.log('?')}})"
}

status=0

for platform in ios android; do
  printf '%-8s checking…\r' "$platform"

  local_fp=$(npx expo-updates fingerprint:generate --platform "$platform" 2>/dev/null | hash_of)

  store_fp=$(eas build:list \
    --profile production --platform "$platform" \
    --limit 1 --status finished --json --non-interactive 2>/dev/null | runtime_of)

  if [ "$local_fp" = "$store_fp" ]; then
    printf '%-8s OTA     %s\n' "$platform" "$local_fp"
  else
    printf '%-8s BUILD   local=%s  store=%s\n' "$platform" "$local_fp" "$store_fp"
    status=1
  fi
done

echo
if [ "$status" -eq 0 ]; then
  echo "Both match a shipped store build — eas update reaches users."
else
  echo "A platform marked BUILD needs: eas build --platform <p> --profile production"
  echo "Publishing an update for it alone would reach nobody."
fi
exit "$status"
