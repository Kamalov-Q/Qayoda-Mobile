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

/**
 * Like `requireAuth`, but also insists on a verified phone number.
 *
 * Telegram and Google prove who someone is; neither proves a reachable Uzbek
 * number. Actions other people have to live with — posting, reviewing,
 * reporting, opening a chat — are gated on one, and the server enforces the
 * same rule (403 PHONE_REQUIRED). Checking here too is what turns that into
 * "add your number" instead of a failed request.
 */
export function requirePhone(fn?: () => void) {
  const { status, user } = useAuthStore.getState();

  if (status !== "authenticated") {
    toast.successKey("auth.signInRequired");
    router.push("/(auth)/welcome");
    return;
  }
  if (user?.phoneNumber) {
    fn?.();
    return;
  }

  toast.successKey("auth.phoneRequired");
  router.push("/link-phone");
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
