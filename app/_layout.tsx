import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from "@expo-google-fonts/inter";
import { queryClient } from "../src/lib/query-client";
import { loadDeviceId } from "../src/lib/device-id";
import { useSupportLive } from "../src/features/support/hooks/useSupport";
import { usePushRegistration } from "../src/features/notifications/usePushRegistration";
import { useBlocksLive } from "../src/features/blocks/hooks/useBlocks";
import { bootstrapSession } from "../src/features/auth/hooks/useAuth";
import { hydratePreferences } from "../src/lib/preferences";
import { hydrateCategories } from "../src/features/listings/hooks/useCategories";
import { hydrateAmenities } from "../src/features/listings/hooks/useAmenities";
import { useTheme } from "../src/theme/useTheme";
import { type } from "../src/theme/tokens";
import { ToastHost } from "../src/components/ui/Toast";
import { DialogHost } from "../src/components/ui/Dialog";
import { BootScreen } from "../src/components/ui/BrandLoader";
import { useT } from "../src/i18n";

// NOTE: enableFreeze(true) was tried here and reverted — react-freeze hard-
// froze the map screen on state updates. The lag it targeted is handled by
// focus-gated queries in sotuv instead.
// Holds the native splash until there is something of our own to paint.
SplashScreen.preventAutoHideAsync();
// Cross-fades into the boot screen below instead of cutting to it. Same dark
// teal field on both sides of the hand-off, so what the fade actually shows is
// the emblem swapping a still for the animated one.
SplashScreen.setOptions({ fade: true, duration: 300 });

// A boot screen that appears and vanishes inside a couple of frames reads as a
// glitch, so once it is up it stays for one full assembly of the mark. Module
// scope: the clock starts when the bundle is evaluated, which is the earliest
// honest reading of how long this cold start has taken.
const BOOT_FLOOR_MS = 1100;
const bootStartedAt = Date.now();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  // Every face tokens.fonts names. Android selects a face by family name and
  // ignores fontWeight on a custom family, so each weight is its own file.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });
  const { colors, scheme } = useTheme();
  const t = useT();
  // Registers this device for push while somebody is signed in, drops it on
  // sign-out, and turns a tap on a banner into the screen it is about. Here
  // because a cold-start tap has to be read before any screen mounts.
  usePushRegistration();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Preferences must land before the first paint or the app flashes the
    // wrong theme and language; the session decides which route we land on.
    // Categories too: the post form and filters build from them, and the
    // saved copy lets them open offline with the admin-managed list.
    Promise.all([
      hydratePreferences(),
      hydrateCategories(),
      hydrateAmenities(),
      bootstrapSession(),
      // Before the first request goes out: it rides on every one of them as
      // a header, and a request sent without it counts a guest twice.
      loadDeviceId(),
    ]).finally(() => {
      const elapsed = Date.now() - bootStartedAt;
      if (elapsed >= BOOT_FLOOR_MS) {
        setReady(true);
        return;
      }
      timer = setTimeout(() => setReady(true), BOOT_FLOOR_MS - elapsed);
    });
    return () => clearTimeout(timer);
  }, []);

  // The app opens on the data and the typeface both being in. Hiding the
  // native splash on the data alone painted one frame of system-font text that
  // then reflowed into Inter — the flash of unstyled text, on every cold
  // start. A font that fails to load is not worth trapping anyone behind: the
  // scale still carries numeric weights, so the app falls back to the system.
  const typefaceReady = fontsLoaded || !!fontError;
  const booted = ready && typefaceReady;

  // The native splash steps aside as soon as Inter is in — not when the data
  // lands. The fetches that follow are the long part of a cold start, and they
  // now happen under the boot screen's animated mark instead of under a frozen
  // PNG, which is also the only way anyone ever sees that animation.
  useEffect(() => {
    if (typefaceReady) SplashScreen.hideAsync();
  }, [typefaceReady]);

  // The support socket, for as long as someone is signed in: an answer from
  // the desk has to reach the badge whatever screen they are on.
  useSupportLive();
  // Keeps the blocked list in step across this person's own devices.
  useBlocksLive();

  // Paints the window behind the React tree, so overscroll and the gap during
  // navigation show the theme colour instead of white.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        {/* Not `null` while booting: on web there's no native splash, so an
            empty render flashes white before the first screen paints. */}
        {booted ? (
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: colors.bg },
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerTitleStyle: { ...type.heading, color: colors.text },
              // The hairline reads as grime against a flat themed header; the
              // screens below draw their own separators where they need one.
              headerShadowVisible: false,
              headerBackButtonDisplayMode: "minimal",
            }}
          >
            {/* Groups render their own chrome — tabs have a tab bar, auth has
                in-screen BackButtons — so the stack header stays off there. */}
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="intro" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* Draws its own BackButton like the auth screens; sits outside
                (auth) because linking Telegram happens while signed in, and
                that group redirects signed-in users away. */}
            <Stack.Screen name="telegram" options={{ headerShown: false }} />
            {/* No header on purpose: onboarding is the one screen a brand-new
                account must finish, so it offers no way back. */}
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />

            {/* These two were unreachable-back before: with <Slot /> there was
                no stack header and no gesture, so a push into them stranded
                the user. */}
            {/* Pushed, not presented as a modal: iOS modals have no back
                chevron, only a swipe-down, which is the same dead end these
                screens already had. */}
            {/* Names are file paths relative to this layout, so a nested
                folder keeps its "/index" — "listing/[id]" matched no route and
                the screen fell back to an untitled header. */}
            <Stack.Screen
              name="add/index"
              options={{ title: t("add.title") }}
            />
            {/* The location pickers: ordinary screens that slide up like a
                sheet. They used to be <Modal>s, and the map inside a Modal
                took no pan or pinch at all. Their own header carries the
                close/save controls, and swipe-back is off so a sideways drag
                pans the map instead of dismissing the page. */}
            <Stack.Screen
              name="add/pin"
              options={{
                headerShown: false,
                animation: "slide_from_bottom",
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="add/draw"
              options={{
                headerShown: false,
                animation: "slide_from_bottom",
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="listing/[id]/index"
              options={{ title: t("listings.detailsTitle") }}
            />
            <Stack.Screen
              name="listing/[id]/edit-images"
              options={{ title: t("listings.editImages") }}
            />
            {/* Both set their own title once the counts land; this is what
                shows while the first page is in flight. */}
            <Stack.Screen
              name="listing/[id]/reviews"
              options={{ title: t("reviews.title") }}
            />
            <Stack.Screen
              name="listing/[id]/comments"
              options={{ title: t("comments.title") }}
            />
            <Stack.Screen
              name="settings"
              options={{ title: t("settings.title") }}
            />
            {/* The three lists set their own titles; this is the hub. */}
            <Stack.Screen
              name="support"
              options={{ title: t("support.title") }}
            />
            {/* A stack screen, not a tab: it left the tab bar, and pushing a
                tab route never made a back entry — which is why "back" from
                here landed on Home instead of where you came from. */}
            <Stack.Screen name="saved" options={{ title: t("saved.title") }} />
            <Stack.Screen
              name="activity/index"
              options={{ title: t("activity.title") }}
            />
            <Stack.Screen
              name="activity/comments"
              options={{ title: t("activity.comments") }}
            />
            <Stack.Screen
              name="activity/likes"
              options={{ title: t("activity.likes") }}
            />
            <Stack.Screen
              name="activity/blocked"
              options={{ title: t("blocks.title") }}
            />
            <Stack.Screen
              name="activity/reviews"
              options={{ title: t("activity.reviews") }}
            />
            <Stack.Screen
              name="verify-profile"
              options={{ title: t("verify.title") }}
            />
            {/* Pushed over whatever the reader was doing when the phone gate
                stopped them, so it keeps the header's way back. */}
            <Stack.Screen
              name="link-phone"
              options={{ title: t("auth.linkPhoneTitle") }}
            />
            <Stack.Screen
              name="profile/edit"
              options={{ title: t("profile.edit") }}
            />
            {/* Static "edit" wins over the dynamic segment, so /profile/edit
                still reaches the form. This one swaps in the person's name
                once their card lands. */}
            <Stack.Screen
              name="profile/[id]"
              options={{ title: t("userProfile.title") }}
            />
            {/* The thread replaces the title with the peer's name and presence,
                so this only sets what it shows before the fetch lands. */}
            <Stack.Screen
              name="chat/[id]"
              options={{ title: t("chat.title") }}
            />
            <Stack.Screen
              name="wallet/index"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="wallet/history"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="wallet/transaction/[id]"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="wallet/result"
              // No swipe-back: leaving mid-check is what the button is for,
              // and it knows to go to the wallet when there is no back stack.
              options={{ headerShown: false, gestureEnabled: false }}
            />
          </Stack>
        ) : (
          // Same emblem as the native splash on the same field, so the hand-off
          // on native — and the web boot, which has no native splash at all —
          // shows one continuous logo, here splitting and gathering itself.
          <BootScreen />
        )}
        <DialogHost />
        <ToastHost />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
