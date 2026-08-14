import { memo } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

/** Renders nothing when there's no message, so callers can drop it in bare. */
export const ErrorBanner = memo(function ErrorBanner({
  message,
}: {
  message?: string | null;
}) {
  const { colors } = useTheme();
  if (!message) return null;

  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: colors.dangerSurface,
        borderWidth: 1,
        borderColor: colors.dangerBorder,
        borderRadius: radii.md,
        padding: spacing.md,
      }}
    >
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <Text style={{ ...type.body, color: colors.danger, flex: 1 }}>
        {message}
      </Text>
    </View>
  );
});
