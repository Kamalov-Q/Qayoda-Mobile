// src/features/profile/components/CompleteProfileGate.tsx
// Decides whether to offer the profile sheet, and offers it once.
//
// Its own component so the home screen does not grow another concern: home
// renders it, and everything about WHEN to ask lives here.
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { useAuthStore } from "../../auth/store/auth.store";
import { usePreferences } from "../../../lib/preferences";
import { useProfile } from "../hooks/useProfile";
import { shouldPromptCompletion } from "../lib/completeness";
import { CompleteProfileSheet } from "./CompleteProfileSheet";

/**
 * Asked once, to signed-in accounts whose profile is nearly empty.
 *
 * Not on the first frame after sign-in: landing on home and being handed a
 * sheet before the app has drawn reads as a wall. A beat later it reads as
 * an offer, which is what it is.
 */
const DELAY_MS = 1200;

export function CompleteProfileGate() {
  const authed = useAuthStore((s) => s.status === "authenticated");
  const asked = usePreferences((s) => s.profileAsked);
  const setAsked = usePreferences((s) => s.setProfileAsked);
  // Only fetched when there is a session; the hook is a no-op for guests.
  const { data: profile } = useProfile();
  const [visible, setVisible] = useState(false);

  const eligible = authed && !asked && shouldPromptCompletion(profile);

  useEffect(() => {
    if (!eligible) return;
    const timer = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, [eligible]);

  // Marked asked on either answer: "later" is an answer, and asking again
  // tomorrow would make it a worse one.
  const close = () => {
    setVisible(false);
    setAsked();
  };

  if (!eligible && !visible) return null;

  return (
    <CompleteProfileSheet
      visible={visible}
      onDismiss={close}
      onStart={() => {
        close();
        router.push("/profile/complete");
      }}
    />
  );
}
