// src/features/auth/guest.ts
//
// Guest mode: the app opens straight into browsing, and the login screen is
// only ever reached from here — the moment a guest taps something that needs
// an account (save, chat, post, profile). One helper so every gate behaves
// the same: explain with a toast, then present the auth flow.
import { router } from "expo-router";
import { useAuthStore } from "./store/auth.store";
import { toast } from "../../components/ui/Toast";

export function useIsAuthed(): boolean {
  return useAuthStore((s) => s.status === "authenticated");
}

/** Run `fn` if signed in; otherwise send the guest to the login flow. */
export function requireAuth(fn?: () => void) {
  if (useAuthStore.getState().status === "authenticated") {
    fn?.();
    return;
  }
  toast.successKey("auth.signInRequired");
  router.push("/(auth)/welcome");
}
