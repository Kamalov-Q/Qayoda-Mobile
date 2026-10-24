import { memo } from "react";
import { Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type, weight } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { formatThousands } from "@/src/features/wallet/components/VirtualCard";

interface Props {
  /** So'm, as the server sends it. Undefined means the action is not priced. */
  price: string | undefined;
  /** The viewer's balance, when known. Drives the "not enough" state. */
  balance?: string | null;
  /** For a timed tariff: "· 7 kun". */
  durationDays?: number | null;
}

/**
 * What an action will cost, said before it is taken.
 *
 * A full-width row rather than the small pill this used to be. The pill was
 * outlined in red whenever the balance fell short, which is most of the time
 * for a new account — so the first thing a seller met on the post form was a
 * red mark with no label, no balance and nothing to do about it. It read as
 * a validation error on the photo picker above it.
 *
 * So: the price is stated calmly, the balance sits under it as context, and
 * the shortfall is the only thing that turns red — next to the one button
 * that resolves it.
 *
 * Renders nothing when there is no price. An action nobody has set a tariff
 * for is free, and a row reading "0 so'm" only invites the question of
 * whether the price failed to load.
 */
export const PriceNotice = memo(function PriceNotice({
  price,
  balance,
  durationDays,
}: Props) {
  const { colors, text } = useTheme();
  const t = useT();

  if (price === undefined || Number(price) <= 0) return null;

  // Compared as numbers, not strings: both are decimal strings from the API,
  // and "9000" > "10000" lexically.
  const short = balance != null && Number(balance) < Number(price);

  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: short ? colors.danger : colors.border,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
        }}
      >
        <Ionicons name="wallet-outline" size={18} color={colors.textMuted} />
        <Text style={{ ...text.body, flex: 1, color: colors.textMuted }}>
          {t("tariffs.cost")}
        </Text>
        <Text style={{ ...type.body, ...weight("700"), color: colors.text }}>
          {formatThousands(price)} {t("listings.som")}
          {durationDays
            ? ` · ${t("tariffs.days", { count: durationDays })}`
            : ""}
        </Text>
      </View>

      {/* Balance is context, not an alarm — it only goes red when it is the
          reason the action cannot proceed. */}
      {balance != null ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <Text
            style={{
              ...text.caption,
              flex: 1,
              color: short ? colors.danger : colors.textFaint,
            }}
          >
            {short
              ? t("tariffs.notEnough")
              : `${t("tariffs.balance")}: ${formatThousands(balance)} ${t("listings.som")}`}
          </Text>

          {short ? (
            <Pressable
              onPress={() => router.push("/wallet")}
              accessibilityRole="button"
              accessibilityLabel={t("tariffs.topUp")}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={{
                  ...text.caption,
                  ...weight("700"),
                  color: colors.primary,
                }}
              >
                {t("tariffs.topUp")}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={13}
                color={colors.primary}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});
