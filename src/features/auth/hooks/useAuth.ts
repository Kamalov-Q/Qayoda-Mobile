// src/features/auth/hooks/useAuth.ts
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { Linking } from "react-native";
import {
  authApi,
  OtpPurpose,
  SessionResponse,
  TelegramStart,
} from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";
import { useAuthFlowStore } from "../store/auth-flow.store";

import { secureSession } from "../../../lib/secure-session";
import { ApiError, refreshSession } from "../../../lib/api-client";
import { queryClient } from "../../../lib/query-client";
import { disconnectChatSocket } from "../../../lib/chat-socket";
import { usePreferences } from "../../../lib/preferences";
import { toast } from "../../../components/ui/Toast";

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

  // A new account still owes us a name — otherwise every listing and chat
  // would show an anonymous owner. Only a NAME: the surname, the avatar and
  // everything else moved to the profile screen, where they can be filled in
  // by someone who has already seen what the app is for.
  //
  // This is now the ONLY place a phone sign-up is asked its name — the
  // welcome screen no longer has a name box, so every new account arrives
  // here. A Telegram account whose provider carried no first name lands here
  // too; one that carried a name skips straight home.
  if (session.isNew && !session.user.name) {
    router.replace("/onboarding");
    toast.successKey("auth.welcomeNew");
    return;
  }
  // No password step. Signing up ends at the code: the session is a sliding
  // 30 days, so the next launch needs nothing at all, and a password can be
  // added later from Settings by whoever actually wants one.
  goHomeAfterAuth();
  toast.successKey("auth.loggedIn");
}

// ---------------------------------------------------------------- phone

export function useRequestOtp() {
  const setPhone = useAuthFlowStore((s) => s.setPhone);
  return useMutation({
    mutationFn: (args: { phone: string }) =>
      authApi.requestOtp(args.phone, lang()),
    onSuccess: (_data, args) => {
      setPhone(args.phone);
      router.push("/(auth)/verify-otp");
      toast.successKey("auth.otpSent");
    },
  });
}

/**
 * The "send it again" button. `purpose` must match the screen it sits on:
 * resending from the reset screen with the login wording would tell the user
 * someone is signing in to their account.
 */
export function useResendOtp(purpose: OtpPurpose = "login") {
  const phone = useAuthFlowStore((s) => s.phone);
  return useMutation({
    mutationFn: () => authApi.requestOtp(phone, lang(), purpose),
  });
}

export function useVerifyOtp() {
  const phone = useAuthFlowStore((s) => s.phone);
  return useMutation({
    // No name: the account is created nameless and /onboarding asks for one
    // straight after, so there is nothing to carry from the welcome screen.
    mutationFn: (args: { code: string }) =>
      authApi.verifyOtp(phone, args.code, lang()),
    onSuccess: establishSession,
  });
}

// No password hooks. Signing in is one road — a number, a code — and there
// is nothing to set, change, forget or reset at the end of it.

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

  /** Opens a session and waits on it. Touches refs only, never state, so the
   *  mount effect below can call it without a synchronous re-render. */
  const start = async () => {
    stop();
    activeToken.current = null;
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

  /** The retry button. Unlike the first run it has a failed attempt on screen
   *  to clear, which is the only reason this is not just `start`. */
  const restart = () => {
    setPhase("starting");
    setError(null);
    void start();
  };

  useEffect(() => {
    alive.current = true;
    // The state `restart` would reset is already the initial state here, so
    // nothing is set synchronously: `start` touches refs, then awaits the
    // network before it ever calls setState. The compiler's effect rule does
    // not model `await`, so it reads the whole async function as synchronous —
    // starting a request on mount and setting state when it answers is the
    // "subscribe to an external system" case the rule exists to allow.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void start();
    return () => {
      alive.current = false;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTelegram = () => {
    if (session) Linking.openURL(session.deepLink).catch(() => undefined);
  };

  return { phase, session, error, restart, openTelegram };
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
