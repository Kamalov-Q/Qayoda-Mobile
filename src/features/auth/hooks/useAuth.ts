// src/features/auth/hooks/useAuth.ts
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { Linking } from "react-native";
import { authApi, SessionResponse, TelegramStart } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";
import { useAuthFlowStore } from "../store/auth-flow.store";
import { getGoogleIdToken } from "../google";
import { secureSession } from "../../../lib/secure-session";
import { ApiError, refreshSession } from "../../../lib/api-client";
import { queryClient } from "../../../lib/query-client";
import { disconnectChatSocket } from "../../../lib/chat-socket";
import { usePreferences } from "../../../lib/preferences";
import { toast } from "../../../components/ui/Toast";
import { t } from "../../../i18n";

/** The device language rides along on every sign-in so a new account and its SMS match the UI. */
const lang = () => usePreferences.getState().language;

/**
 * Where "done with auth" lands: the intro carousel exactly once — after the
 * FIRST login on this device, and after any required steps (profile,
 * password) — then home forever after.
 */
export function goHomeAfterAuth() {
  if (!usePreferences.getState().introSeen) {
    router.replace("/intro");
    return;
  }
  router.replace("/(tabs)/home");
}

async function establishSession(session: SessionResponse) {
  await secureSession.saveRefreshToken(session.refreshToken);
  useAuthStore.getState().setSession(session.accessToken, session.user);
  useAuthFlowStore.getState().reset();

  // A new account that arrived without a full name (phone sign-ups always,
  // Telegram/Google when the provider had none) must finish onboarding
  // before anything else — otherwise every listing and chat would show an
  // anonymous owner. replace(), not push(): there is nothing to go back to.
  if (session.isNew && (!session.user.name || !session.user.surname)) {
    router.replace("/onboarding");
    toast.successKey("auth.welcomeNew");
    return;
  }
  // A phone account without a password sets one now — that password is the
  // next sign-in. (Telegram/Google-only accounts have no phone to log into.)
  if (session.user.phoneNumber && !session.user.hasPassword) {
    router.replace("/set-password");
    toast.successKey("auth.loggedIn");
    return;
  }
  goHomeAfterAuth();
  toast.successKey("auth.loggedIn");
}

// ---------------------------------------------------------------- phone

export function useRequestOtp() {
  const setPhone = useAuthFlowStore((s) => s.setPhone);
  return useMutation({
    mutationFn: (phone: string) => authApi.requestOtp(phone, lang()),
    onSuccess: (_data, phone) => {
      setPhone(phone);
      router.push("/(auth)/verify-otp");
      toast.successKey("auth.otpSent");
    },
  });
}

export function useResendOtp() {
  const phone = useAuthFlowStore((s) => s.phone);
  return useMutation({
    mutationFn: () => authApi.requestOtp(phone, lang()),
  });
}

export function useVerifyOtp() {
  const phone = useAuthFlowStore((s) => s.phone);
  return useMutation({
    mutationFn: (args: { code: string }) =>
      authApi.verifyOtp(phone, args.code, lang()),
    onSuccess: establishSession,
  });
}

export function usePhoneLogin() {
  return useMutation({
    mutationFn: (args: { phone: string; password: string }) =>
      authApi.phoneLogin(args.phone, args.password),
    onSuccess: establishSession,
  });
}

export function useSetPassword() {
  return useMutation({
    mutationFn: (password: string) => authApi.setPassword(password),
    onSuccess: () => {
      // The session user drives the "must set a password" routing — flip the
      // flag or the next establishSession would bounce back here.
      const { accessToken, user, setSession } = useAuthStore.getState();
      if (accessToken && user) {
        setSession(accessToken, { ...user, hasPassword: true });
      }
      toast.successKey("auth.passwordSet");
      goHomeAfterAuth();
    },
  });
}

/** Same request as login OTPs — the reset screen just points elsewhere. */
export function useRequestReset() {
  const setPhone = useAuthFlowStore((s) => s.setPhone);
  return useMutation({
    mutationFn: (phone: string) => authApi.requestOtp(phone, lang()),
    onSuccess: (_data, phone) => {
      setPhone(phone);
      router.push("/(auth)/reset-password");
      toast.successKey("auth.otpSent");
    },
  });
}

export function useResetPassword() {
  const phone = useAuthFlowStore((s) => s.phone);
  return useMutation({
    mutationFn: (args: { code: string; password: string }) =>
      authApi.resetPassword(phone, args.code, args.password),
    onSuccess: establishSession,
  });
}

// ---------------------------------------------------------------- google

export function useGoogleSignIn() {
  return useMutation({
    mutationFn: async () => {
      const g = await getGoogleIdToken();
      if (g.type === "unavailable") throw new Error(t("auth.googleUnavailable"));
      if (g.type === "cancelled") return null;
      return authApi.googleSignIn(g.idToken, lang());
    },
    onSuccess: (session) => {
      if (session) return establishSession(session);
    },
  });
}

// ---------------------------------------------------------------- telegram

export type TelegramPhase = "starting" | "waiting" | "expired" | "error";

const POLL_MS = 2000;

/**
 * Drives the whole Telegram handshake: start a session, hand the deep link to
 * the OS, poll until the bot confirms. `linking` swaps the start endpoint for
 * the link one; the poll then resolves to LINKED instead of a session.
 */
export function useTelegramSignIn(linking = false) {
  const [phase, setPhase] = useState<TelegramPhase>("starting");
  const [session, setSession] = useState<TelegramStart | null>(null);
  const [error, setError] = useState<unknown>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  // The session this screen is currently waiting on. Retry starts a new one,
  // but a poll for the old token may still be in flight — clearing the timer
  // can't cancel a request already sent. Every step checks it still owns the
  // screen, so a stale loop can't flip a fresh session to "expired" or keep
  // polling a token nobody is looking at.
  const activeToken = useRef<string | null>(null);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const poll = (token: string) => {
    const current = () => alive.current && activeToken.current === token;
    timer.current = setTimeout(async () => {
      if (!current()) return;
      try {
        const res = await authApi.telegramPoll(token);
        if (!current()) return;
        if (res.status === "PENDING") return poll(token);
        if (res.status === "EXPIRED") return setPhase("expired");
        if (res.status === "LINKED") {
          queryClient.invalidateQueries({ queryKey: ["auth", "identities"] });
          toast.successKey("auth.telegramLinked");
          router.back();
          return;
        }
        await establishSession(res);
      } catch (e) {
        if (!current()) return;
        // A consumed/unknown session means this token is spent; anything
        // else (offline blip) is worth another try.
        if (e instanceof ApiError && (e.status === 401 || e.status === 404)) {
          setPhase("expired");
        } else if (e instanceof ApiError) {
          setError(e);
          setPhase("error");
        } else {
          poll(token);
        }
      }
    }, POLL_MS);
  };

  const start = async () => {
    stop();
    activeToken.current = null;
    setPhase("starting");
    setError(null);
    try {
      const s = linking
        ? await authApi.linkTelegram()
        : await authApi.telegramStart();
      if (!alive.current) return;
      activeToken.current = s.token;
      setSession(s);
      setPhase("waiting");
      Linking.openURL(s.deepLink).catch(() => undefined);
      poll(s.token);
    } catch (e) {
      if (!alive.current) return;
      setError(e);
      setPhase("error");
    }
  };

  useEffect(() => {
    alive.current = true;
    start();
    return () => {
      alive.current = false;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTelegram = () => {
    if (session) Linking.openURL(session.deepLink).catch(() => undefined);
  };

  return { phase, session, error, restart: start, openTelegram };
}

// ---------------------------------------------------------------- session

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      // Must run before the store is cleared: the request is authorised with
      // the access token still held there. A failure here is not fatal to the
      // local logout — the device is signed out either way.
      await authApi.logout().catch(() => {});
      // Before the store is cleared, and before the query cache is: the socket
      // authenticates with the access token held there and reconnects on its
      // own, so leaving it up would keep streaming the old account's messages
      // into a signed-out app.
      disconnectChatSocket();
      await secureSession.clear();
      useAuthStore.getState().clear();
      queryClient.clear(); // wipe cached personal data — prevents cross-account leaks
    },
    onSuccess: () => {
      // Signed out ≠ locked out: browsing is public, so land on the feed.
      router.replace("/(tabs)/home");
      toast.successKey("auth.loggedOut");
    },
  });
}

/** Cold-start silent refresh — reuses the same single-flight path as 401 handling */
export async function bootstrapSession() {
  const ok = await refreshSession();
  if (!ok) useAuthStore.getState().setUnauthenticated();
}
