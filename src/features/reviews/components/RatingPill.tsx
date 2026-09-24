// The rating as it appears on a card: one star, one number, the count in
// brackets. Sized to ride a photo scrim next to the price.
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, type } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";

interface Props {
  average: number | null;
  count: number;
  /** On a photo the pill carries its own scrim; in a text row it does not. */
  onPhoto?: boolean;
}

/**
 * Renders nothing when there is nothing to say. An unrated listing showing
 * "0.0" or an empty star row would read as a bad rating rather than as a new
 * listing, which is the opposite of the truth.
 */
export function RatingPill({ average, count, onPhoto }: Props) {
  const { colors } = useTheme();
  if (average === null || count === 0) return null;

  const fg = onPhoto ? "#FFFFFF" : colors.text;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: onPhoto ? spacing.sm : 0,
        paddingVertical: onPhoto ? 5 : 0,
        borderRadius: radii.pill,
        backgroundColor: onPhoto ? colors.imageScrim : "transparent",
      }}
      accessibilityRole="text"
      accessibilityLabel={`${average.toFixed(1)} / 5, ${count}`}
    >
      <Ionicons name="star" size={12} color={colors.vip} />
      <Text style={{ ...type.caption, fontWeight: "600", color: fg }}>
        {average.toFixed(1)}
      </Text>
      <Text style={{ ...type.caption, color: onPhoto ? "#FFFFFF" : colors.textMuted }}>
        ({count})
      </Text>
    </View>
  );
}
