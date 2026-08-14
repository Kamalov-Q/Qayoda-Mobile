import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * Selectable pill. Replaces the Buttons and the SegmentedControl that used to
 * carry option sets: a segmented control divides a fixed width by the number of
 * options, so three long labels ("Аренда посуточно") either truncate or spill
 * out of the track. Chips size to their own text and wrap onto the next line.
 */
export const Chip = memo(function Chip({
  label,
  selected,
  onPress,
  icon,
}: ChipProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingVertical: 10,
        paddingHorizontal: spacing.md,
        borderRadius: radii.pill,
        borderWidth: 1,
        backgroundColor: selected
          ? colors.primary
          : pressed
            ? colors.surfaceRaised
            : colors.surface,
        borderColor: selected ? colors.primary : colors.border,
      })}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={15}
          color={selected ? colors.onPrimary : colors.textMuted}
        />
      ) : null}
      <Text
        style={{
          ...type.bodyStrong,
          fontSize: 14,
          color: selected ? colors.onPrimary : colors.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
});

interface ChipGroupProps<T extends string> {
  options: readonly { value: T; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
  value: T;
  onChange: (value: T) => void;
}

/** Wrapping single-select row of chips. */
function ChipGroupInner<T extends string>({
  options,
  value,
  onChange,
}: ChipGroupProps<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
    >
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          icon={o.icon}
          selected={o.value === value}
          onPress={() => onChange(o.value)}
        />
      ))}
    </View>
  );
}

export const ChipGroup = memo(ChipGroupInner) as typeof ChipGroupInner;
