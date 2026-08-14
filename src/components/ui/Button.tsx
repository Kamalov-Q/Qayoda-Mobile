import { memo } from "react";
import { Pressable, Text, View, ActivityIndicator, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, sizing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

type Variant = "primary" | "secondary" | "ghost" | "link" | "danger";
type Size = "md" | "sm";

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

export const Button = memo(function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
  size = "md",
  icon,
  style,
}: Props) {
  const { colors, shadow } = useTheme();
  const isDisabled = disabled || loading;
  const isLink = variant === "link";
  const height = size === "sm" ? sizing.controlMd : sizing.control;

  const bg = (pressed: boolean) => {
    switch (variant) {
      case "primary":
        return pressed ? colors.primaryPressed : colors.primary;
      case "danger":
        return pressed ? colors.dangerSurface : colors.dangerSurface;
      case "secondary":
        return pressed ? colors.surfaceRaised : colors.surface;
      default:
        return pressed ? colors.surfaceRaised : "transparent";
    }
  };

  const fg =
    variant === "primary"
      ? colors.onPrimary
      : variant === "danger"
        ? colors.danger
        : variant === "secondary"
          ? colors.text
          : colors.primary;

  const bordered = variant === "secondary" || variant === "danger";

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          height: isLink ? undefined : height,
          paddingVertical: isLink ? spacing.sm : 0,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.md,
          backgroundColor: isLink ? "transparent" : bg(pressed),
          borderWidth: bordered ? 1 : 0,
          borderColor: variant === "danger" ? colors.dangerBorder : colors.border,
          // A press that moves is more legible than one that only recolours,
          // especially for the filled variant where the tint shift is subtle.
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
          // Disabled must stay legible on near-black, so dim less than the
          // usual 0.5 — at that level the label vanishes into the background.
          opacity: isDisabled ? 0.45 : 1,
          ...(variant === "primary" && !isDisabled ? shadow.control : null),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text
            style={{
              ...type.bodyStrong,
              fontSize: isLink ? 15 : 16,
              color: fg,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
});
