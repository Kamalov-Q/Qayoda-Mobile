// Web counterpart of secure-session.ts — expo-secure-store is native-only
// (Android/iOS/tvOS), so on web we fall back to localStorage.
//
// NOTE: localStorage is readable by any script on the origin, so the refresh
// token is XSS-exposed here in a way it is not on native. Acceptable for dev;
// production web should move refresh tokens to an httpOnly cookie.

const REFRESH_KEY = "uynest.refreshToken";

// Guarded for static rendering (no window during SSR) and for browsers that
// throw on storage access in private mode.
function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const secureSession = {
  saveRefreshToken: async (token: string) => {
    storage()?.setItem(REFRESH_KEY, token);
  },
  getRefreshToken: async (): Promise<string | null> =>
    storage()?.getItem(REFRESH_KEY) ?? null,
  clear: async () => {
    storage()?.removeItem(REFRESH_KEY);
  },
};
