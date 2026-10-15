import { memo } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { formatThousands } from "@/src/features/wallet/components/VirtualCard";

interface Props {
  /** So'm, as the server sends it. Undefined means the action is not priced. */
  price: string | undefined;
  /** The viewer's balance, when known — turns the badge red if short. */
  balance?: string | null;
  /** For a timed tariff: "· 7 kun". */
  durationDays?: number | null;
}

/**
 * What an action will cost, said before it is taken.
 *
 * Renders nothing when there is no price. An action nobody has set a tariff
 * for is free, and a badge reading "0 so'm" invites the question of whether
 * the price failed to load — silence is the honest answer.
 */
export const PriceBadge = memo(function PriceBadge({
  price,
  balance,
  durationDays,
}: Props) {
  const { colors } = useTheme();
  const t = useT();

  if (price === undefined || Number(price) <= 0) return null;

  // Compared as numbers, not strings: both are decimal strings from the API,
  // and "9000" > "10000" lexically.
  const short = balance != null && Number(balance) < Number(price);
  const accent = short ? colors.danger : colors.primary;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: accent,
        backgroundColor: `${accent}1A`,
      }}
    >
      <Ionicons name="wallet-outline" size={13} color={accent} />
      <Text style={{ ...type.caption, fontWeight: "600", color: accent }}>
        {formatThousands(price)} {t("listings.som")}
        {durationDays ? ` · ${t("tariffs.days", { count: durationDays })}` : ""}
      </Text>
    </View>
  );
});
