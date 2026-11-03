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
  /**
   * This action is on the house for this account — the first-post grant is
   * still unspent. The price is shown struck through rather than hidden: the
   * point is that they are being given something, which a row reading
   * "Bepul" alone does not say.
   */
  free?: boolean;
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
 *
 * `free` is the other kind of free: there IS a price, and this account is
 * not paying it this once. That state drops the balance line entirely. It
 * has to — a new account's balance is zero, so the shortfall warning would
 * fire on the very first listing somebody posts, which is precisely the
 * red-mark-with-nothing-to-do-about-it problem described above, on the one
 * screen where there is genuinely nothing to do about it.
 */
export const PriceNotice = memo(function PriceNotice({
  price,
  balance,
  durationDays,
  free = false,
}: Props) {
  const { colors, text } = useTheme();
  const t = useT();

  if (price === undefined || Number(price) <= 0) return null;

  // Compared as numbers, not strings: both are decimal strings from the API,
  // and "9000" > "10000" lexically. A free action is never short: nothing is
  // being taken, so the balance cannot fail to cover it.
  const short = !free && balance != null && Number(balance) < Number(price);

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
        <Text
          style={{
            ...type.body,
            ...weight("700"),
            color: free ? colors.textFaint : colors.text,
            textDecorationLine: free ? "line-through" : "none",
          }}
        >
          {formatThousands(price)} {t("listings.som")}
          {durationDays
            ? ` · ${t("tariffs.days", { count: durationDays })}`
            : ""}
        </Text>

        {free ? (
          <View
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              borderRadius: radii.sm,
              borderWidth: 1,
              borderColor: colors.successBorder,
              backgroundColor: colors.successSurface,
            }}
          >
            <Text
              style={{ ...text.caption, ...weight("700"), color: colors.success }}
            >
              {t("tariffs.free")}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Why it is free, said once. Without this the struck-through price
          reads as a bug or a discount nobody can account for. */}
      {free ? (
        <Text style={{ ...text.caption, color: colors.textFaint }}>
          {t("tariffs.firstFreeHint")}
        </Text>
      ) : null}

      {/* Balance is context, not an alarm — it only goes red when it is the
          reason the action cannot proceed. Hidden entirely while free: see
          the note on `free` above. */}
      {!free && balance != null ? (
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
