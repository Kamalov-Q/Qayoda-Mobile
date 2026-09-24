// A row of stars for a value that is already decided — the summary header,
// a review card, a listing card. For choosing a rating, see StarPicker.
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/useTheme";

interface Props {
  /** 0–5; fractions are drawn as a half star. */
  value: number;
  size?: number;
  /** Space between stars. Tight by default — this reads as one glyph. */
  gap?: number;
  color?: string;
}

/**
 * Rounds to the nearest half before drawing, so 4.3 shows four and a half
 * rather than a bar chart's worth of precision nobody reads at 14px. The
 * exact number sits next to it in text wherever it matters.
 */
export function Stars({ value, size = 14, gap = 1, color }: Props) {
  const { colors } = useTheme();
  const filled = color ?? colors.vip;
  const halves = Math.round(value * 2);

  return (
    <View
      style={{ flexDirection: "row", gap }}
      accessibilityRole="image"
      accessibilityLabel={`${value.toFixed(1)} / 5`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const remaining = halves - i * 2;
        const name =
          remaining >= 2 ? "star" : remaining === 1 ? "star-half" : "star-outline";
        return (
          <Ionicons
            key={i}
            name={name}
            size={size}
            color={remaining >= 1 ? filled : colors.textFaint}
          />
        );
      })}
    </View>
  );
}
