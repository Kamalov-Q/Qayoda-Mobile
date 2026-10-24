import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useT } from "@/src/i18n";
import { useTheme } from "@/src/theme/useTheme";
import { radii, spacing, type } from "@/src/theme/tokens";

/**
 * Stands in for the virtual card on an account with no phone number.
 *
 * The card is issued against the phone: it is printed on it, and it is what
 * a payment can be traced back to. Telegram sign-ins may arrive without one,
 * and the card used to fill the gap with a made-up number — so instead of a
 * card, these accounts get the step that earns one. Linking the phone
 * (/link-phone) updates the session user only once the SMS code checks out,
 * and the card renders in this spot from then on; nothing is created early.
 *
 * Amber rather than red: nothing is wrong with the account, there is just
 * one thing left to do.
 */
export function CreateCardPrompt({ compact }: { compact?: boolean }) {
  const t = useT();
  const { colors, scheme } = useTheme();
  const dark = scheme === "dark";

  const amber = dark ? "#FBBF24" : "#B45309";
  const amberSurface = dark ? "rgba(245, 158, 11, 0.10)" : "#FFFBEB";
  const amberBorder = dark ? "rgba(245, 158, 11, 0.35)" : "#FCD34D";

  return (
    <View
      style={{
        minHeight: compact ? 140 : 184,
        marginBottom: compact ? 0 : 16,
        padding: compact ? spacing.md : spacing.lg,
        borderRadius: 22,
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: amberBorder,
        backgroundColor: amberSurface,
        justifyContent: "space-between",
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: dark ? "rgba(245, 158, 11, 0.18)" : "#FEF3C7",
          }}
        >
          <Ionicons name="card-outline" size={22} color={amber} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons name="alert-circle" size={16} color={amber} />
            <Text style={{ ...type.bodyStrong, color: colors.text, flex: 1 }}>
              {t("wallet.cardNeedsPhoneTitle")}
            </Text>
          </View>
          <Text style={{ ...type.caption, color: colors.textMuted }}>
            {t("wallet.cardNeedsPhoneBody")}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => router.push("/link-phone")}
        accessibilityRole="button"
        accessibilityLabel={t("wallet.cardNeedsPhoneAction")}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.xs,
          minHeight: 44,
          borderRadius: radii.pill,
          backgroundColor: pressed ? colors.primaryPressed : colors.primary,
        })}
      >
        <Ionicons name="call-outline" size={17} color={colors.onPrimary} />
        <Text style={{ ...type.bodyStrong, color: colors.onPrimary }}>
          {t("wallet.cardNeedsPhoneAction")}
        </Text>
      </Pressable>
    </View>
  );
}
