// Native implementation. See secure-session.web.ts for the web fallback —
// expo-secure-store does not support web.
import * as SecureStore from "expo-secure-store";

const REFRESH_KEY = "qayoda.refreshToken";

export const secureSession = {
  saveRefreshToken: (token: string): Promise<void> =>
    SecureStore.setItemAsync(REFRESH_KEY, token),
  getRefreshToken: (): Promise<string | null> =>
    SecureStore.getItemAsync(REFRESH_KEY),
  clear: (): Promise<void> => SecureStore.deleteItemAsync(REFRESH_KEY),
};
