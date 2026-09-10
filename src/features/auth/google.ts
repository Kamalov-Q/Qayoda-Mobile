// Thin wrapper over the native Google Sign-In SDK.
//
// The SDK is a native module, so it does not exist inside Expo Go — importing
// it at the top level would crash the whole app there. It is required lazily
// instead: in Expo Go `getGoogleIdToken()` resolves to `unavailable` and the
// welcome screen simply hides the Google button. Dev/production builds carry
// the module and everything works.
//
// Client ids come from the same Google Cloud project as the server's
// GOOGLE_CLIENT_ID_* — the token's audience must be one of those or the
// server answers GOOGLE_TOKEN_INVALID.
import { Platform, TurboModuleRegistry } from "react-native";

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

type GoogleResult =
  | { type: "success"; idToken: string }
  | { type: "cancelled" }
  | { type: "unavailable" };

type GoogleModule = typeof import("@react-native-google-signin/google-signin");

let mod: GoogleModule | null | undefined;
let configured = false;

/**
 * Is the native module actually in this binary? Asked through the registry's
 * non-enforcing getter, which answers null instead of throwing. Requiring the
 * package to find out was worse: in Expo Go the package's own import calls
 * `getEnforcing`, which logs a red-box error *before* throwing — so even
 * though the throw was caught, every render of the welcome screen spammed
 * "RNGoogleSignin could not be found".
 */
function nativeModulePresent(): boolean {
  if (Platform.OS === "web") return false;
  try {
    return TurboModuleRegistry.get("RNGoogleSignin") != null;
  } catch {
    return false;
  }
}

function load(): GoogleModule | null {
  if (mod !== undefined) return mod;
  if (!nativeModulePresent()) {
    mod = null;
    return mod;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("@react-native-google-signin/google-signin") as GoogleModule;
  } catch {
    mod = null;
  }
  return mod;
}

export function isGoogleSignInAvailable(): boolean {
  return !!WEB_CLIENT_ID && load() !== null;
}

export async function getGoogleIdToken(): Promise<GoogleResult> {
  const g = load();
  if (!g || !WEB_CLIENT_ID) return { type: "unavailable" };

  if (!configured) {
    g.GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      ...(IOS_CLIENT_ID ? { iosClientId: IOS_CLIENT_ID } : {}),
    });
    configured = true;
  }

  await g.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await g.GoogleSignin.signIn();
  if (res.type !== "success") return { type: "cancelled" };

  const idToken = res.data.idToken;
  if (!idToken) throw new Error("Google returned no ID token");

  // The server owns the session from here; the SDK's cached Google session is
  // not needed and signing out keeps the account chooser showing next time.
  await g.GoogleSignin.signOut().catch(() => undefined);
  return { type: "success", idToken };
}
