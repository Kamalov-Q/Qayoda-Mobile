// src/features/notifications/push.ts
// Remote push: asking for permission, getting a token, and keeping the
// server's copy of it current.
//
// Everything here is best-effort. Push is a nice-to-have layered on an inbox
// that already works by polling — a phone that refuses permission, has no
// Play Services, or is offline when the token is minted must end up with a
// working app and a slightly later notification, never an error.
//
// ⚠️ Push does not work in Expo Go on Android (SDK 53+), and never has on a
// simulator without the right Xcode. A development build is required, which
// this project already uses for maps.
import { Platform } from "react-native";
import { PUSH_SUPPORTED } from "./pushSupport";

import Constants from "expo-constants";

/**
 * expo-notifications, or null on a binary without it.
 *
 * require(), not import: an import binds the native module at module load,
 * which throws before anything can catch it. See pushSupport.ts.
 */
/**
 * expo-device, same treatment. It was installed alongside push and binds
 * its own native module on import, so it took the app down for exactly the
 * same reason the notifications import did.
 */
const Device: typeof import("expo-device") | null =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  PUSH_SUPPORTED ? require("expo-device") : null;

const Notifications: typeof import("expo-notifications") | null =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  PUSH_SUPPORTED ? require("expo-notifications") : null;

/**
 * How a notification behaves while the app is OPEN.
 *
 * Banner and list, not `shouldShowAlert` — that field is deprecated in SDK
 * 57 and silently does nothing. A badge too, so the OS icon agrees with the
 * bell inside the app.
 *
 * Set at module scope on purpose: the handler must exist before any
 * notification can arrive, which can be before React has mounted anything.
 */
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Android needs a channel before it will even ask for permission.
 *
 * On Android 13+ the OS prompt does not appear until at least one channel
 * exists, so this has to run before the token request rather than after it.
 * The id matches `defaultChannel` in the config plugin, so a push that names
 * no channel still lands here rather than in "Miscellaneous".
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android" || !Notifications) return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility:
      Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * The EAS project the push token is minted against.
 *
 * getExpoPushTokenAsync falls back to this itself, but reading it here means
 * a missing id is a clear log line at the one place that can explain it,
 * rather than a rejected promise from inside the SDK.
 */
function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

/**
 * Permission, then a token — or null, for all the ordinary reasons there
 * might not be one.
 *
 * Never prompts twice. A user who said no cannot be asked again on Android,
 * and on iOS a second prompt never appears, so a refusal is final until they
 * change it in Settings. Nothing here nags.
 */
export async function getPushToken(): Promise<string | null> {
  // A build without the native module, which is every binary made before
  // push was added — the inbox still works by polling.
  if (!Notifications) return null;
  // A simulator has no push service to register with, and asking produces a
  // confusing error rather than a useful one.
  if (!Device?.isDevice) return null;

  const id = projectId();
  if (!id) {
    console.warn(
      "[push] No EAS projectId — run `eas init` and add extra.eas.projectId. " +
        "Skipping push registration; the in-app inbox still works.",
    );
    return null;
  }

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;

    // canAskAgain is the whole reason this is two calls: requesting when the
    // answer is already a permanent no is a no-op that still costs a round
    // trip through the OS on every launch.
    if (!granted && existing.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return null;

    const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
    return token.data;
  } catch (error) {
    // Offline, no Play Services, a project with no push credentials
    // configured — all the same to the caller, which is "not today".
    console.warn("[push] token unavailable:", (error as Error).message);
    return null;
  }
}

/** What the server stores alongside the token, to target and to prune. */
export const devicePlatform = (): "ios" | "android" | "web" =>
  Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
