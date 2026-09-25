import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../src/lib/query-client";
import { loadDeviceId } from "../src/lib/device-id";
import { useSupportLive } from "../src/features/support/hooks/useSupport";
import { bootstrapSession } from "../src/features/auth/hooks/useAuth";
import { hydratePreferences } from "../src/lib/preferences";
import { hydrateCategories } from "../src/features/listings/hooks/useCategories";
import { hydrateAmenities } from "../src/features/listings/hooks/useAmenities";
import { useTheme } from "../src/theme/useTheme";
import { type } from "../src/theme/tokens";
import { ToastHost } from "../src/components/ui/Toast";
import { DialogHost } from "../src/components/ui/Dialog";
import { BrandMark } from "../src/components/ui/BrandMark";
import { useT } from "../src/i18n";

// NOTE: enableFreeze(true) was tried here and reverted — react-freeze hard-
// froze the map screen on state updates. The lag it targeted is handled by
// focus-gated queries in sotuv instead.
SplashScreen.preventAutoHideAsync(); // hold native splash until session resolves — no login-screen flash

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const { colors, scheme } = useTheme();
  const t = useT();

  useEffect(() => {
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
      setReady(true);
      SplashScreen.hideAsync();
    });
  }, []);

  // The support socket, for as long as someone is signed in: an answer from
  // the desk has to reach the badge whatever screen they are on.
  useSupportLive();

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
        {ready ? (
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
            <Stack.Screen
              name="set-password"
              options={{ headerShown: false }}
            />

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
              name="activity/reviews"
              options={{ title: t("activity.reviews") }}
            />
            <Stack.Screen
              name="change-password"
              options={{ title: t("auth.changePassword") }}
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
          </Stack>
        ) : (
          // Same emblem as the native splash, so the web boot (which has no
          // native splash) and the hand-off on native show one continuous logo.
          <View
            style={{
              flex: 1,
              backgroundColor: colors.bg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BrandMark size={120} />
          </View>
        )}
        <DialogHost />
        <ToastHost />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
