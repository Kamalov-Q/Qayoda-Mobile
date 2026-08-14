import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../src/lib/query-client";
import { bootstrapSession } from "../src/features/auth/hooks/useAuth";
import { hydratePreferences } from "../src/lib/preferences";
import { useTheme } from "../src/theme/useTheme";
import { type } from "../src/theme/tokens";
import { ToastHost } from "../src/components/ui/Toast";
import { DialogHost } from "../src/components/ui/Dialog";
import { useT } from "../src/i18n";

SplashScreen.preventAutoHideAsync(); // hold native splash until session resolves — no login-screen flash

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const { colors, scheme } = useTheme();
  const t = useT();

  useEffect(() => {
    // Preferences must land before the first paint or the app flashes the
    // wrong theme and language; the session decides which route we land on.
    Promise.all([hydratePreferences(), bootstrapSession()]).finally(() => {
      setReady(true);
      SplashScreen.hideAsync();
    });
  }, []);

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
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

            {/* These two were unreachable-back before: with <Slot /> there was
                no stack header and no gesture, so a push into them stranded
                the user. */}
            {/* Pushed, not presented as a modal: iOS modals have no back
                chevron, only a swipe-down, which is the same dead end these
                screens already had. */}
            {/* Names are file paths relative to this layout, so a nested
                folder keeps its "/index" — "listing/[id]" matched no route and
                the screen fell back to an untitled header. */}
            <Stack.Screen name="add/index" options={{ title: t("add.title") }} />
            <Stack.Screen
              name="listing/[id]/index"
              options={{ title: t("listings.detailsTitle") }}
            />
            <Stack.Screen
              name="listing/[id]/edit-images"
              options={{ title: t("listings.editImages") }}
            />
          </Stack>
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.bg }} />
        )}
        <DialogHost />
        <ToastHost />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
