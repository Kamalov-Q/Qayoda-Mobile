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
 * Every listing has a rating now — it starts at five and moves from there, so
 * there is no "unrated" state to hide. The count in brackets is dropped while
 * it is zero: "5.0" is the marketplace's opinion, "(0)" beside it would look
 * like a broken counter rather than an honest "nobody has said anything yet".
 *
 * Renders nothing only if the server sent no number at all, which an older
 * API can still do.
 */
export function RatingPill({ average, count, onPhoto }: Props) {
  const { colors } = useTheme();
  if (average === null) return null;

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
      {count > 0 ? (
        <Text
          style={{
            ...type.caption,
            color: onPhoto ? "#FFFFFF" : colors.textMuted,
          }}
        >
          ({count})
        </Text>
      ) : null}
    </View>
  );
}
