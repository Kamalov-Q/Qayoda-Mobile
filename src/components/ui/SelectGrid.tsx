import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

export interface SelectGridOption<T extends string> {
  value: T;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface Props<T extends string> {
  options: readonly SelectGridOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Tiles per row. Three fits the six property types as two even rows. */
  columns?: number;
}

/**
 * Single-select tile grid for the form's identity choices — what the property
 * IS and what it is FOR. Chips carried these before: six of them wrapped into
 * a ragged 4+2 block that read as a tag cloud rather than a decision, and a
 * bare word gives nothing to recognise at a glance. Tiles are even, tappable
 * across their whole area, and carry an icon.
 *
 * Filters keep using chips: those are quick toggles over a longer list, where
 * compactness matters more than legibility of any single option.
 */
function SelectGridInner<T extends string>({
  options,
  value,
  onChange,
  columns = 3,
}: Props<T>) {
  const { colors } = useTheme();

  // flexBasis a little under an even share, then grow: the row fills the width
  // whatever the gap resolves to, and a long label wraps instead of pushing a
  // tile onto its own line.
  const basis = `${100 / columns - 4}%` as const;

  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: basis,
              minHeight: 78,
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.xs,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.sm,
              borderRadius: radii.lg,
              borderWidth: selected ? 1.5 : 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected
                ? colors.primarySoft
                : pressed
                  ? colors.surfaceRaised
                  : colors.surface,
              transform: [{ scale: pressed && !selected ? 0.98 : 1 }],
            })}
          >
            <Ionicons
              name={option.icon}
              size={22}
              color={selected ? colors.primary : colors.textMuted}
            />
            <Text
              style={{
                ...type.caption,
                fontWeight: selected ? "700" : "500",
                color: selected ? colors.primary : colors.text,
                textAlign: "center",
              }}
              numberOfLines={2}
            >
              {option.label}
            </Text>

            {/* Selection is carried by a mark as well as by tint, so it still
                reads without colour vision. */}
            {selected ? (
              <View
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                }}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={colors.primary}
                />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export const SelectGrid = memo(SelectGridInner) as typeof SelectGridInner;
