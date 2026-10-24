// What a guest gets where a personal screen would be: the login screen.
//
// This used to be a card in the middle of the empty screen — a title, a line
// of explanation and a "Sign in" button — which made every gated screen a
// dead end with one exit, and made signing in take two taps from a screen
// that could do nothing else. The screens that need an account need it
// before they can draw anything at all, so there is nothing to look at while
// deciding, and a thing to look at is all that card was.
//
// Redirect, not push: the gated screen is not somewhere to come back to
// while still signed out. Back from the login screen lands on whatever the
// person was actually reading, which is the thing they will want again if
// they change their mind.
import { useEffect } from "react";
import { Redirect } from "expo-router";
import { toast } from "../../../components/ui/Toast";
import type { TranslationKey } from "../../../i18n";

export function RedirectToSignIn({
  /** Why this screen needed an account — the same line the card used to carry. */
  reasonKey = "auth.signInRequired",
}: {
  reasonKey?: TranslationKey;
}) {
  // A silent bounce to a login screen reads as the app losing the tap. One
  // toast says which door you just went through and why.
  useEffect(() => {
    toast.successKey(reasonKey);
  }, [reasonKey]);

  return <Redirect href="/(auth)/welcome" />;
}
