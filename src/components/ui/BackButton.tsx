import { memo } from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { radii, sizing } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";

/**
 * The auth stack runs with headerShown: false, so sub-screens had no way back
 * to welcome. Falls back to the welcome route when there's nothing to pop
 * (deep link, or a reload straight onto this screen on web).
 */
export const BackButton = memo(function BackButton() {
  const { colors } = useTheme();
  const t = useT();

  return (
    <Pressable
      onPress={() =>
        router.canGoBack() ? router.back() : router.replace("/(auth)/welcome")
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
