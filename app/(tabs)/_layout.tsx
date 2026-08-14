// app/(tabs)/_layout.tsx
import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/features/auth/store/auth.store";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";

// Filled when selected, outline when not — the icon carries the active state
// alongside the tint, so it still reads for colour-blind users.
const ICONS = {
  home: ["home", "home-outline"],
  sotuv: ["pricetag", "pricetag-outline"],
  places: ["business", "business-outline"],
  saved: ["heart", "heart-outline"],
  about: ["information-circle", "information-circle-outline"],
  account: ["person-circle", "person-circle-outline"],
} as const;

// Each tab item is a top-aligned column with 5pt padding, so the space a label
// gets is (bar height - bottom inset - 10). It needs 44pt: the icon wrapper is
// a fixed 28pt tall whatever glyph size we pass, plus the label's 2pt margin
// and 14pt line. 58 leaves 48pt — enough, with a little headroom.
const BAR_HEIGHT = 58;

// Only scales the glyph inside that fixed 28pt wrapper; it has no effect on
// whether the label fits.
const ICON_SIZE = 24;

export default function TabsLayout() {
  const status = useAuthStore((s) => s.status);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();

  if (status === "unauthenticated") return <Redirect href="/(auth)/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          // Only the bottom inset is padded here. Any extra vertical padding
          // comes straight out of the item's usable space and cuts the label
          // off, which is exactly what an earlier paddingTop/Bottom pair did.
          height: BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 14, // pinned so the label's box can't vary by platform
          fontWeight: "600",
          marginTop: 2,
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={ICONS.home[focused ? 0 : 1]} color={color} size={ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="sotuv"
        options={{
          title: t("tabs.sale"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={ICONS.sotuv[focused ? 0 : 1]} color={color} size={ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="places"
        options={{
          title: t("tabs.myListings"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={ICONS.places[focused ? 0 : 1]} color={color} size={ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: t("tabs.saved"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={ICONS.saved[focused ? 0 : 1]} color={color} size={ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: t("tabs.about"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={ICONS.about[focused ? 0 : 1]} color={color} size={ICON_SIZE} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={ICONS.account[focused ? 0 : 1]} color={color} size={ICON_SIZE} />
          ),
        }}
      />
    </Tabs>
  );
}
