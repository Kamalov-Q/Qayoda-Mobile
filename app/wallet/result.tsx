// app/wallet/result.tsx — where a Click top-up lands.
//
// Two ways in: the wallet screen navigates here when Click's in-app browser
// closes, and Click itself opens growencity://wallet/result (CLICK_RETURN_URL)
// when the payment ran in the Click app. Before this screen existed the
// second one hit expo-router's "Unmatched Route" page.
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen, Button, BrandLoader } from "@/src/components/ui";
import { useTheme } from "@/src/theme/useTheme";
import { spacing, radii } from "@/src/theme/tokens";
import { useT } from "@/src/i18n";
import { walletApi } from "@/src/features/wallet/api/wallet.api";
import { formatThousands } from "@/src/features/wallet/components/VirtualCard";
import { usePendingTopupStore } from "@/src/features/wallet/store/pendingTopup.store";

/** Click usually confirms within seconds; two minutes covers a slow SMS step. */
const POLL_MS = 2_000;
const GIVE_UP_MS = 120_000;

type Outcome = "checking" | "paid" | "cancelled" | "pending";

export default function TopupResultScreen() {
  const { colors, text } = useTheme();
  const t = useT();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ paymentId?: string }>();
  const pending = usePendingTopupStore((s) => s.pending);
  const setPending = usePendingTopupStore((s) => s.setPending);

  // The param when the wallet sent us; the store when Click's link did.
  const paymentId = params.paymentId ?? pending?.paymentId ?? null;
  const [startedAt] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [startedAt]);

  // Polls through react-query rather than setInterval: it stops by itself
  // when this screen unmounts, which the old 30-second loop on the wallet
  // screen never did.
  const status = useQuery({
    queryKey: ["wallet", "topup", paymentId],
    queryFn: () => walletApi.getTopupStatus(paymentId!),
    enabled: !!paymentId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === "PAID" || s === "CANCELLED" || timedOut) return false;
      return POLL_MS;
    },
  });

  const outcome: Outcome = !paymentId
    ? "pending"
    : status.data?.status === "PAID"
      ? "paid"
      : status.data?.status === "CANCELLED"
        ? "cancelled"
        : timedOut
          ? "pending"
          : "checking";

  // Once the answer is final: refresh every balance on screen, and forget the
  // payment so the next visit here does not report on it again.
  useEffect(() => {
    if (outcome === "checking") return;
    void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    if (outcome !== "pending") setPending(null);
  }, [outcome, queryClient, setPending]);

  const amount = status.data?.amount ?? pending?.amount;

  const view = {
    checking: {
      icon: null,
      tint: colors.primary,
      title: t("wallet.resultChecking"),
      body: t("wallet.resultCheckingBody"),
    },
    paid: {
      icon: "checkmark-circle" as const,
      tint: colors.success,
      title: t("wallet.resultPaid"),
      body: amount
        ? t("wallet.resultPaidBody", { amount: formatThousands(amount) })
        : t("wallet.resultPaidBodyNoAmount"),
    },
    cancelled: {
      icon: "close-circle" as const,
      tint: colors.danger,
      title: t("wallet.paymentCancelled"),
      body: t("wallet.resultCancelledBody"),
    },
    pending: {
      icon: "time-outline" as const,
      tint: colors.textMuted,
      title: t("wallet.resultPending"),
      body: t("wallet.resultPendingBody"),
    },
  }[outcome];

  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/wallet");

  return (
    <Screen centered>
      <View style={{ alignItems: "center", gap: spacing.lg }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {view.icon ? (
            <Ionicons name={view.icon} size={56} color={view.tint} />
          ) : (
            <BrandLoader size={60} />
          )}
        </View>

        <View style={{ alignItems: "center", gap: spacing.xs }}>
          <Text style={{ ...text.heading, textAlign: "center" }}>
            {view.title}
          </Text>
          <Text style={{ ...text.caption, textAlign: "center" }}>
            {view.body}
          </Text>
        </View>

        <View style={{ alignSelf: "stretch", gap: spacing.sm }}>
          <Button
            title={t("wallet.resultBackToWallet")}
            onPress={close}
            variant={outcome === "checking" ? "secondary" : "primary"}
          />
          {outcome === "pending" || outcome === "paid" ? (
            <Button
              title={t("wallet.historyTitle")}
              variant="ghost"
              onPress={() => router.replace("/wallet/history")}
            />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
