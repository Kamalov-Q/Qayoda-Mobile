import { memo } from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { radii, sizing } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";

/**
 * For screens that run with headerShown: false (the auth flow, the Telegram
 * handshake). Pops when there is history; otherwise lands on `fallback` —
 * home by default, since browsing is public — for a deep link or a web
 * reload straight onto this screen.
 */
export const BackButton = memo(function BackButton({
  fallback = "/(tabs)/home",
}: {
  fallback?: Href;
}) {
  const { colors } = useTheme();
  const t = useT();

  return (
    <Pressable
      onPress={() =>
        router.canGoBack() ? router.back() : router.replace(fallback)
      }
      accessibilityRole="button"
      accessibilityLabel={t("common.back")}
      hitSlop={8}
      style={({ pressed }) => ({
        width: sizing.controlSm,
        height: sizing.controlSm,
        borderRadius: radii.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      })}
    >
      <Ionicons name="chevron-back" size={20} color={colors.text} />
    </Pressable>
  );
});
