// The five taps that are the whole review. Big targets, because this is the
// one control most people will use and then close the sheet.
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";

interface Props {
  /** 0 means "nothing chosen yet" — there is no zero-star rating. */
  value: number;
  onChange: (rating: number) => void;
  size?: number;
  disabled?: boolean;
}

export function StarPicker({ value, onChange, size = 40, disabled }: Props) {
  const { colors } = useTheme();
  const t = useT();

  return (
    <View
      style={{ flexDirection: "row", justifyContent: "center", gap: spacing.sm }}
      accessibilityRole="radiogroup"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const on = star <= value;
        return (
          <Pressable
            key={star}
            disabled={disabled}
            onPress={() => onChange(star)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled }}
            accessibilityLabel={t("reviews.starLabel", { count: star })}
            // Padding, not margin: it is the tap target, and a 40px star with
            // no slack around it is a miss waiting to happen.
            style={({ pressed }) => ({
              padding: spacing.xs,
              opacity: pressed ? 0.6 : 1,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            })}
          >
            <Ionicons
              name={on ? "star" : "star-outline"}
              size={size}
              color={on ? colors.vip : colors.textFaint}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
