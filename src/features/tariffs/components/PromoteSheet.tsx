import { memo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Button, EmptyState } from "@/src/components/ui";
import { toast } from "@/src/components/ui/Toast";
import { radii, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { queryClient } from "@/src/lib/query-client";
import { listingApi } from "@/src/features/listings/api/listings.api";
import { formatThousands } from "@/src/features/wallet/components/VirtualCard";
import { useWalletOverview } from "@/src/features/wallet/hooks/useWalletOverview";
import { useTariffs } from "../hooks/useTariffs";
import { handleChargeError } from "../lib/charge-errors";

interface Props {
  listingId: string;
  onClose: () => void;
}

/**
 * Buying TOP for one listing.
 *
 * The lengths on offer come from the server: LISTING_PROMOTE can have several
 * tariffs, one per duration, and an admin adds or retires them in the
 * dashboard. The app renders whatever it is given and hardcodes nothing —
 * which is why an empty list is a legible state here rather than a bug.
 */
export const PromoteSheet = memo(function PromoteSheet({
  listingId,
  onClose,
}: Props) {
  const { colors, text, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { forAction, isLoading } = useTariffs();
  const wallet = useWalletOverview();
  const [chosen, setChosen] = useState<string | null>(null);

  const plans = forAction("LISTING_PROMOTE");
  const balance = wallet.data?.balance;

  const promote = useMutation({
    mutationFn: (tariffId: string) => listingApi.promote(listingId, tariffId),
    onSuccess: (listing) => {
      // The badge is read off the listing, and the balance just moved.
      queryClient.setQueryData(["listings", "detail", listingId], listing);
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      toast.successKey("tariffs.topBought");
      onClose();
    },
    onError: handleChargeError,
  });

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={{ flex: 1 }} onPress={onClose} />

      <View
        style={{
          paddingBottom: insets.bottom + spacing.md,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          gap: spacing.md,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
          backgroundColor: colors.surface,
          ...shadow.raised,
        }}
      >
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: radii.pill,
              backgroundColor: colors.border,
            }}
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text style={text.heading}>{t("tariffs.topTitle")}</Text>
          <Text style={text.caption}>{t("tariffs.topBody")}</Text>
          {balance != null ? (
            <Text style={text.caption}>
              {t("tariffs.balance")}: {formatThousands(balance)}{" "}
              {t("listings.som")}
            </Text>
          ) : null}
        </View>

        {!isLoading && !plans.length ? (
          <EmptyState icon="pricetag-outline" title={t("tariffs.noTopPlans")} />
        ) : null}

        <View style={{ gap: spacing.sm }}>
          {plans.map((plan) => {
            const selected = chosen === plan.id;
            const short =
              balance != null && Number(balance) < Number(plan.price);

            return (
              <Pressable
                key={plan.id}
                onPress={() => setChosen(plan.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radii.lg,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: pressed
                    ? colors.surfaceRaised
                    : selected
                      ? colors.primarySoft
                      : colors.surface,
                })}
              >
                <Ionicons
                  name={selected ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={selected ? colors.primary : colors.textFaint}
                />
                <View style={{ flex: 1 }}>
                  <Text style={text.bodyStrong}>
                    {plan.durationDays
                      ? t("tariffs.days", { count: plan.durationDays })
                      : plan.nameUz}
                  </Text>
                  {/* Red when it cannot be afforded, rather than letting the
                      tap fail and explaining afterwards. */}
                  <Text
                    style={{
                      ...text.caption,
                      color: short ? colors.danger : colors.textMuted,
                    }}
                  >
                    {formatThousands(plan.price)} {t("listings.som")}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Button
          title={t("tariffs.topBuy")}
          disabled={!chosen}
          loading={promote.isPending}
          onPress={() => chosen && promote.mutate(chosen)}
        />
      </View>
    </Modal>
  );
});
