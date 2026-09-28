import { memo } from "react";
import { Pressable, ActivityIndicator, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, sizing } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  loading?: boolean;
  /** Filled rather than outlined — the control is a toggle and it is on. */
  active?: boolean;
  /** Placement is the caller's business — this only draws the control. */
  style?: ViewStyle;
}

/** The round control that floats over a map: locate, expand, collapse. One
 *  component so every map affordance is the same size and weight. */
export const MapIconButton = memo(function MapIconButton({
  icon,
  onPress,
  label,
  loading,
  active,
  style,
}: Props) {
  const { colors, shadow } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!loading, selected: !!active }}
      style={({ pressed }) => [
        {
          width: sizing.controlSm + 8,
          height: sizing.controlSm + 8,
          borderRadius: radii.pill,
          backgroundColor: active
            ? pressed
              ? colors.primaryPressed
              : colors.primary
            : pressed
              ? colors.surfaceRaised
              : colors.surface,
          borderWidth: 1,
          borderColor: active ? colors.primary : colors.border,
          justifyContent: "center",
          alignItems: "center",
          // Themed elevation rather than the deprecated shadow*/elevation
          // props, which RN 0.81 no longer renders on the new architecture.
          ...shadow.card,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons
          name={icon}
          size={20}
          color={active ? colors.onPrimary : colors.primary}
        />
      )}
    </Pressable>
  );
});
