// The Play Store header: the average big enough to read at a glance, and the
// five bars that say whether it is "everyone agrees" or "half loved it".
import { View, Text } from "react-native";
import { spacing, radii } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { Stars } from "./Stars";
import type { RatingDistribution } from "../api/reviews.api";

interface Props {
  average: number | null;
  count: number;
  distribution: RatingDistribution;
}

export function RatingSummary({ average, count, distribution }: Props) {
  const { colors, text } = useTheme();
  const t = useT();

  // The longest bar is the scale, not the total: with 40 five-stars and 2
  // ones, bars drawn against the total are four invisible slivers.
  const peak = Math.max(1, ...Object.values(distribution));

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.lg,
        padding: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ alignItems: "center", gap: 2 }}>
        <Text style={{ ...text.display, lineHeight: 40 }}>
          {average !== null ? average.toFixed(1) : "—"}
        </Text>
        <Stars value={average ?? 0} size={15} />
        <Text style={text.caption}>{t("reviews.count", { count })}</Text>
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        {[5, 4, 3, 2, 1].map((star) => {
          const n = distribution[String(star) as keyof RatingDistribution] ?? 0;
          return (
            <View
              key={star}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
              accessibilityRole="progressbar"
              accessibilityLabel={t("reviews.barLabel", { star, count: n })}
            >
              <Text
                style={{ ...text.caption, width: 10, textAlign: "right" }}
              >
                {star}
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: radii.pill,
                  backgroundColor: colors.surfaceSunken,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${(n / peak) * 100}%`,
                    height: "100%",
                    borderRadius: radii.pill,
                    backgroundColor: colors.vip,
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
