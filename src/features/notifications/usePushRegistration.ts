// src/features/notifications/usePushRegistration.ts
// Keeps the server's idea of this device in step with the signed-in user,
// and turns a tap on a push into the screen it is about.
//
// Mounted once, high in the tree. Everything it does is best-effort: push is
// a faster path to an inbox that already works by polling, so a device that
// refuses permission or cannot reach Expo must end up with a working app.
import { useEffect, useRef } from "react";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useAuthStore } from "@/src/features/auth/store/auth.store";
import { queryClient } from "@/src/lib/query-client";
import { notificationsApi } from "./api/notifications.api";
import { devicePlatform, getPushToken } from "../../features/notifications/push";

/**
 * Where a notification's payload says to go.
 *
 * The server puts the same references on the push `data` as it puts on the
 * inbox row, so this mirrors NotificationRow's `open()` — deliberately, and
 * in the same order. A tap from the lock screen and a tap in the inbox must
 * land in the same place or the app has two answers to one question.
 */
function routeFor(data: Record<string, unknown>): string | null {
  const str = (k: string) =>
    typeof data[k] === "string" ? (data[k] as string) : null;

  const kind = str("kind");
  if (
    kind === "TOPUP_SUCCEEDED" ||
    kind === "TOPUP_FAILED" ||
    kind === "TARIFF_PAID" ||
    kind === "TARIFF_EXPIRING"
  ) {
    return "/wallet";
  }
  if (kind === "VIDEO_AWAITING_PAYMENT" || kind === "VIDEO_FAILED") {
    return "/videos/mine";
  }

  const conversationId = str("conversationId");
  if (conversationId) return `/chat/${conversationId}`;
  const videoId = str("videoId");
  if (videoId) return `/videos/${videoId}`;
  const listingId = str("listingId");
  if (listingId) return `/listing/${listingId}`;
  const actorId = str("actorId");
  if (actorId) return `/profile/${actorId}`;

  // Nothing specific to open: the inbox is always a correct answer.
  return "/activity/notifications";
}

export function usePushRegistration(): void {
  const userId = useAuthStore((s) => s.user?.id);
  const authed = useAuthStore((s) => s.status === "authenticated");
  // Remembered so sign-out can unregister exactly the token it registered,
  // rather than asking the OS for one again while tearing the session down.
  const token = useRef<string | null>(null);

  // --- registration, tied to the session ---------------------------------
  useEffect(() => {
    let cancelled = false;

    if (!authed || !userId) {
      // Signing out: drop this device so the next person to use the phone
      // does not receive the last person's messages.
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
  }, [authed, userId]);

  // --- a push arriving while the app is open -----------------------------
  useEffect(() => {
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
    let handled = false;

    const go = (data: unknown) => {
      const route = routeFor((data ?? {}) as Record<string, unknown>);
      if (route) router.push(route as never);
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
