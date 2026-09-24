import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const KEY = "growen.deviceId";

/**
 * A stable id for this installation, so a guest's second look at a listing is
 * not counted as a second viewer.
 *
 * Deliberately not SecureStore and deliberately not a device fingerprint:
 * this identifies nobody, it only has to be the same string tomorrow. It is
 * cleared with the app's data, which is the right behaviour — a reinstall is
 * a new anonymous visitor as far as a view counter is concerned.
 *
 * Read synchronously from memory after the first load: the value is needed on
 * every request, and an await per header would put storage in the hot path.
 */
let cached: string | null = null;

export function deviceId(): string | null {
  return cached;
}

/** Called once at boot, before the first request goes out. */
export async function loadDeviceId(): Promise<string> {
  if (cached) return cached;

  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
  } catch {
    // Storage unavailable — fall through and use a per-session id rather
    // than failing. It over-counts a little; it never breaks a request.
  }

  const fresh = Crypto.randomUUID();
  cached = fresh;
  AsyncStorage.setItem(KEY, fresh).catch(() => {});
  return fresh;
}
