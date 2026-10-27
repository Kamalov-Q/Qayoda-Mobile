// Over-the-air updates.
//
// The client installs one APK/IPA and then every JavaScript-only change
// reaches them through EAS Update instead of a reinstall. Native changes — a
// new native module, an icon, a permission, an SDK bump — still need a real
// build; the fingerprint runtime version in app.json is what draws that line,
// so an update published against a different native shape is simply never
// offered to an older binary rather than crashing it.
//
// expo-updates already fetches in the background on cold start and applies on
// the *next* launch. That is invisible to the person using the app, which is
// the whole complaint: they stay on yesterday's build until they happen to
// kill it. This hook makes the hand-off explicit — fetch, then ask.
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import * as Updates from "expo-updates";
import { showDialog } from "../../components/ui/Dialog";

// A foreground is cheap but a check is a network round-trip, and iOS fires
// `active` for every passing control-centre swipe. Once every ten minutes is
// often enough to catch a release within one coffee break.
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Watches for a published update and offers to restart into it.
 *
 * No-ops in Expo Go and in development builds — `Updates.isEnabled` is false
 * there, and calling checkForUpdateAsync anyway throws on every launch.
 */
export function useAppUpdate(enabled: boolean) {
  // Survives re-renders so the throttle is per-session, not per-mount, and
  // guards against two checks overlapping on a slow connection.
  const lastCheckedAt = useRef(0);
  const inFlight = useRef(false);
  // One prompt per launch. Declining means "not now", and re-asking on the
  // next foreground would turn a courtesy into nagging.
  const prompted = useRef(false);

  useEffect(() => {
    if (!enabled || !Updates.isEnabled) return;

    let cancelled = false;

    const check = async () => {
      if (inFlight.current || prompted.current) return;
      if (Date.now() - lastCheckedAt.current < CHECK_INTERVAL_MS) return;
      inFlight.current = true;
      lastCheckedAt.current = Date.now();
      try {
        const result = await Updates.checkForUpdateAsync();
        if (cancelled || !result.isAvailable) return;
        // Download before asking: a "restart now" that then stalls on a
        // download is worse than no prompt at all, and on a bad connection
        // this quietly gives up instead.
        const fetched = await Updates.fetchUpdateAsync();
        if (cancelled || !fetched.isNew) return;
        prompted.current = true;
        showDialog({
          titleKey: "appUpdate.title",
          messageKey: "appUpdate.message",
          confirmKey: "appUpdate.restart",
          cancelKey: "appUpdate.later",
          // Already on disk, so this is a reload, not a download. Declining
          // costs nothing either: expo-updates applies it on the next cold
          // start regardless.
          onConfirm: () => {
            Updates.reloadAsync().catch(() => {});
          },
        });
      } catch {
        // Offline, a sleeping update server, a half-written manifest — none
        // of it is the user's problem, and the app they already have works.
      } finally {
        inFlight.current = false;
      }
    };

    check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [enabled]);
}
