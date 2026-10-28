// src/features/notifications/usePushRegistration.ts
// Keeps the server's idea of this device in step with the signed-in user,
// and turns a tap on a push into the screen it is about.
//
// Mounted once, high in the tree. Everything it does is best-effort: push is
// a faster path to an inbox that already works by polling, so a device that
// refuses permission or cannot reach Expo must end up with a working app.
import { useEffect, useRef } from "react";
import { router } from "expo-router";
import { useAuthStore } from "@/src/features/auth/store/auth.store";
import { usePreferences } from "@/src/lib/preferences";
import { PUSH_SUPPORTED } from "./pushSupport";
import { queryClient } from "@/src/lib/query-client";
import { notificationsApi } from "./api/notifications.api";
import { markNotificationsRead } from "./hooks/useNotifications";
import { devicePlatform, getPushToken } from "./push";
import {
  notificationRoute,
  targetFromPushData,
} from "./notificationTarget";

/**
 * expo-notifications, or null without its native module — see pushSupport.
 * This hook is mounted in the ROOT layout, so a throwing import here is an
 * app that will not open at all.
 */
const Notifications: typeof import("expo-notifications") | null =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  PUSH_SUPPORTED ? require("expo-notifications") : null;


export function usePushRegistration(): void {
  const userId = useAuthStore((s) => s.user?.id);
  const authed = useAuthStore((s) => s.status === "authenticated");
  // Switched off in the profile. Dropping the token is the whole mechanism:
  // the server keeps sending to whoever is registered, so a device with no
  // token registered is a device it cannot reach.
  const pushEnabled = usePreferences((s) => s.pushEnabled);
  // Remembered so sign-out can unregister exactly the token it registered,
  // rather than asking the OS for one again while tearing the session down.
  const token = useRef<string | null>(null);

  // --- registration, tied to the session ---------------------------------
  useEffect(() => {
    let cancelled = false;

    if (!authed || !userId || !pushEnabled) {
      // Signing out, or switched off: drop this device. On sign-out it stops
      // the next person to use the phone receiving the last person's
      // messages; on a switch-off it is what makes the phone go quiet.
      const previous = token.current;
      token.current = null;
      if (previous) {
        notificationsApi.unregisterPushToken(previous).catch(() => {});
      }
      return;
    }

    void (async () => {
      const next = await getPushToken();
      if (cancelled || !next) return;
      token.current = next;
      try {
        await notificationsApi.registerPushToken(next, devicePlatform());
      } catch {
        // A device that could not register still gets its notifications by
        // polling. Nothing to tell the user about.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authed, userId, pushEnabled]);

  // --- a push arriving while the app is open -----------------------------
  useEffect(() => {
    if (!Notifications) return;
    const received = Notifications.addNotificationReceivedListener(() => {
      // The row is already on the server; this just stops the bell waiting
      // out the rest of its sixty-second poll to agree with the banner the
      // user is looking at.
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
    return () => received.remove();
  }, []);

  // --- a tap, warm or cold ----------------------------------------------
  useEffect(() => {
    if (!Notifications) return;
    let handled = false;

    const go = (data: unknown) => {
      const target = targetFromPushData(
        (data ?? {}) as Record<string, unknown>,
      );

      // The row is read the moment its banner is tapped. Without this the
      // bell kept claiming one unread after the user had read exactly that
      // thing, and the inbox — reached some other way later — still showed
      // it washed as new. Best-effort, and deliberately not awaited: the
      // navigation below must not wait on a request, and a failed mark just
      // leaves the row unread until the inbox is opened.
      //
      // Optimistic too, through the same mutation the inbox uses, so the
      // bell drops immediately rather than at the end of its poll.
      if (target.notificationId) {
        markNotificationsRead([target.notificationId]);
      }

      router.push(notificationRoute(target) as never);
    };

    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      handled = true;
      go(r.notification.request.content.data);
    });

    // Cold start: the tap that LAUNCHED the app was delivered before this
    // listener existed, so it has to be asked for. getLastNotificationResponse
    // is deprecated in SDK 57 — the Async form is the one that still works.
    void Notifications.getLastNotificationResponseAsync().then((last) => {
      if (last && !handled) go(last.notification.request.content.data);
    });

    return () => sub.remove();
  }, []);
}
