import { memo } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type, weight } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";

/** Whether a listing is TOP right now. */
export function isTop(promotedUntil: string | null | undefined): boolean {
  return !!promotedUntil && new Date(promotedUntil).getTime() > Date.now();
}

/**
 * Whole days left, rounded up: a placement with four hours to run has one day
 * left, not zero. Null once it has expired.
 */
export function topDaysLeft(
  promotedUntil: string | null | undefined,
): number | null {
  if (!isTop(promotedUntil)) return null;

  const ms = new Date(promotedUntil!).getTime() - Date.now();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

/**
 * The TOP mark.
 *
 * Gold, which is what `vip` in the palette was reserved for — and the one
 * place in the app where that colour means "paid for" rather than "rated".
 *
 * It is a badge and nothing else: no feed or map ordering reads
 * `promotedUntil` yet, so a TOP listing is marked, not ranked. Worth knowing
 * before anybody is sold on it.
 */
export const TopBadge = memo(function TopBadge({
  promotedUntil,
  compact,
  showRemaining,
}: {
  promotedUntil: string | null | undefined;
  /** For a card corner: the mark without the word. */
  compact?: boolean;
  /** Adds "· 5 kun qoldi" — for the owner, who paid for those days. */
  showRemaining?: boolean;
}) {
  const { colors } = useTheme();
  const t = useT();

  if (!isTop(promotedUntil)) return null;

  const left = topDaysLeft(promotedUntil);
  // Buyers see a mark; the owner sees what is left of what they bought.
  const label = !showRemaining
    ? t("tariffs.topBadge")
    : left === 1
      ? t("tariffs.topLastDay")
      : t("tariffs.topLeft", { count: left ?? 0 });

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 3,
        paddingHorizontal: compact ? 5 : spacing.sm,
        paddingVertical: compact ? 2 : 4,
        borderRadius: radii.pill,
        backgroundColor: colors.vip,
      }}
    >
      <Ionicons name="flame" size={compact ? 11 : 13} color={colors.onVip} />
      {!compact ? (
        <Text
          style={{
            ...type.caption,
            fontSize: 11,
            ...weight("800"),
            color: colors.onVip,
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
});
