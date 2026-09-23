// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";
import { useChatSocket } from "@/src/features/chat/hooks/useChatSocket";
import { useUnreadTotal } from "@/src/features/chat/hooks/useConversations";

// Filled when selected, outline when not — the icon carries the active state
// alongside the tint, so it still reads for colour-blind users.
const ICONS = {
  home: ["home", "home-outline"],
  sotuv: ["pricetag", "pricetag-outline"],
  chat: ["chatbubble", "chatbubble-outline"],
  about: ["information-circle", "information-circle-outline"],
  account: ["person-circle", "person-circle-outline"],
} as const;

// Each tab item is a top-aligned column with 5pt padding, so the space a label
// gets is (bar height - bottom inset - 10). It needs 44pt: the icon wrapper is
// a fixed 28pt tall whatever glyph size we pass, plus the label's 2pt margin
// and 14pt line. 58 leaves 48pt — enough, with a little headroom.
const BAR_HEIGHT = 58;

// Only scales the glyph inside that fixed 28pt wrapper; it has no effect on
// whether the label fits. 28 fills the wrapper exactly — past that the glyph
// overflows it (nothing clips, but it starts crowding the label 2pt below).
const ICON_SIZE = 28;

export default function TabsLayout() {
  useChatSocket();
  const unread = useUnreadTotal();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        // The bar belongs to the bottom edge and nowhere else. Without this,
        // Android's keyboard pushes it up and it floats mid-screen above the
        // keyboard; hidden instead, it reappears at the bottom on dismiss.
        tabBarHideOnKeyboard: true,
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
            <Ionicons
              name={ICONS.home[focused ? 0 : 1]}
              color={color}
              size={ICON_SIZE}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sotuv"
        options={{
          title: t("tabs.sale"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={ICONS.sotuv[focused ? 0 : 1]}
              color={color}
              size={ICON_SIZE}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t("tabs.chat"),
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={ICONS.chat[focused ? 0 : 1]}
              color={color}
              size={ICON_SIZE}
            />
          ),
        }}
      />
      {/* Off the bar, but still routes: Home and Account both push into these,
          so the screens stay mounted-on-demand rather than deleted. Every file
          under (tabs) becomes a tab unless it says otherwise, hence href:null
          rather than simply omitting them. */}
      <Tabs.Screen name="places" options={{ href: null }} />
      <Tabs.Screen name="saved" options={{ href: null }} />
      {/* Reached from Settings and the profile quick links, not the bar —
          the bar keeps the four things people actually live in. */}
      <Tabs.Screen name="about" options={{ href: null }} />
      <Tabs.Screen
        name="account"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={ICONS.account[focused ? 0 : 1]}
              color={color}
              size={ICON_SIZE}
            />
          ),
        }}
      />
    </Tabs>
  );
}
