import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Away from its default — tints the pill and its chevron. */
  active: boolean;
  /** Printed in a small bubble after the label, e.g. how many match. */
  count?: number;
  onPress: () => void;
  /** Caps the width, for a row of them. Omitted, the pill hugs its label. */
  maxWidth?: number | `${number}%`;
}

/**
 * A dropdown filter as a pill: the current value, not the filter's name.
 *
 * Used instead of a segmented control wherever the options are more than two
 * or their labels are long — the Russian purpose labels truncated every track
 * they were put in ("Аренда пос…"), and a pill always has room for the one
 * word that is selected.
 */
export const FilterPill = memo(function FilterPill({
  icon,
  label,
  active,
  count,
  onPress,
  maxWidth,
}: Props) {
  const { colors } = useTheme();
  const accent = active ? colors.primary : colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        height: 38,
        ...(maxWidth ? { maxWidth } : {}),
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: active ? colors.primaryBorder : colors.border,
        backgroundColor: active
          ? colors.primarySoft
          : pressed
            ? colors.surfaceRaised
            : colors.surface,
      })}
    >
      <Ionicons name={icon} size={15} color={accent} />
      <Text
        style={{
          ...type.bodyStrong,
          fontSize: 14,
          color: active ? colors.primary : colors.text,
          flexShrink: 1,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {/* Only when it adds something: a count on an unfiltered pill would
          just repeat the total printed above the list. */}
      {count != null ? (
        <View
          style={{
            minWidth: 20,
            paddingHorizontal: 5,
            paddingVertical: 1,
            borderRadius: radii.pill,
            backgroundColor: active ? colors.primary : colors.surfaceRaised,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              ...type.caption,
              fontSize: 11,
              fontWeight: "700",
              color: active ? colors.onPrimary : colors.textMuted,
            }}
          >
            {count}
          </Text>
        </View>
      ) : null}
      <Ionicons name="chevron-down" size={14} color={accent} />
    </Pressable>
  );
});
