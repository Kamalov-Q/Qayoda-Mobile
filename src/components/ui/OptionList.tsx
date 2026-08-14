import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

export interface Option<T extends string> {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface Props<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Single-select rows with a trailing checkmark. Used for settings where the
 * options carry enough text that a SegmentedControl would truncate them —
 * "Системная" next to "Светлая" does not fit a third of a phone width.
 */
export function OptionList<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  const { colors } = useTheme();

  return (
    <View>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.md,
              backgroundColor: pressed ? colors.surfaceRaised : "transparent",
              // Separators between rows only — a line under the last row would
              // double up with the card's own border.
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.border,
            })}
          >
            {option.icon ? (
              <Ionicons
                name={option.icon}
                size={20}
                color={selected ? colors.primary : colors.textMuted}
              />
            ) : null}

            <Text
              style={{
                ...type.body,
                flex: 1,
                color: colors.text,
                fontWeight: selected ? "600" : "400",
              }}
            >
              {option.label}
            </Text>

            {selected ? (
              <Ionicons name="checkmark" size={20} color={colors.primary} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
