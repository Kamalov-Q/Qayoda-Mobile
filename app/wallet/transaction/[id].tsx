// app/wallet/transaction/[id].tsx
import type { ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { weight } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import type { TranslationKey } from "@/src/i18n/types";
import { toast } from "@/src/components/ui/Toast";
import {
  walletApi,
  type FiscalStatus,
  type PaymentStatus,
  type TopupProvider,
  type WalletTransactionDetail,
  type WalletTransactionsResponse,
} from "@/src/features/wallet/api/wallet.api";
import { formatThousands } from "@/src/features/wallet/components/VirtualCard";
import { ClickBrand, PaymeBrand, PaynetBrand } from "@/src/features/wallet/components/PaymentLogos";
import { getTxConfig } from "@/src/features/wallet/utils/txConfig";

const STATUS: Record<
  PaymentStatus,
  { key: TranslationKey; tone: "success" | "vip" | "danger"; icon: keyof typeof Ionicons.glyphMap }
> = {
  PAID: { key: "wallet.statusPaid", tone: "success", icon: "checkmark-circle" },
  // Gold for "not finished yet": the brand already owns the colour, and amber
  // next to it only looked like a second, slightly wrong gold.
  CREATED: { key: "wallet.statusPending", tone: "vip", icon: "time" },
  PREPARED: { key: "wallet.statusPending", tone: "vip", icon: "time" },
  CANCELLED: { key: "wallet.statusCancelled", tone: "danger", icon: "close-circle" },
};

const RECEIPT: Record<FiscalStatus, TranslationKey> = {
  SENT: "wallet.receiptSent",
  PENDING: "wallet.receiptPending",
  SENDING: "wallet.receiptPending",
  BY_PROVIDER: "wallet.receiptByProvider",
  FAILED: "wallet.receiptFailed",
  NONE: "wallet.receiptNone",
};

function ProviderBrand({ provider }: { provider: TopupProvider }) {
  if (provider === "CLICK") return <ClickBrand size="sm" />;
  if (provider === "PAYME") return <PaymeBrand size="sm" />;
  return <PaynetBrand size="sm" />;
}

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export default function WalletTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const t = useT();
  const queryClient = useQueryClient();

  // Render the line the history list already holds at once; the request only
  // adds the payment behind it.
  const fromList = queryClient
    .getQueryData<WalletTransactionsResponse>(["wallet", "transactions"])
    ?.items.find((x) => x.id === id);

  const fallback: WalletTransactionDetail | undefined = fromList
    ? { ...fromList, listingId: null, payment: null }
    : undefined;

  const query = useQuery({
    queryKey: ["wallet", "transaction", id],
    queryFn: () => walletApi.getTransaction(id!),
    enabled: !!id,
    placeholderData: fallback,
  });
  const { isError, isFetching, isPlaceholderData, refetch } = query;
  // If the detail request fails, still show what the list already knows.
  const data = query.data ?? fallback;

  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    toast.success(t("wallet.copied"));
  };

  const header = (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
        style={({ pressed }) => [
          styles.roundButton,
          {
            backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.text }]}>
        {t("wallet.txDetailsTitle")}
      </Text>
      <View style={styles.roundButtonSpacer} />
    </View>
  );

  if (!data) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          {isError ? (
            <>
              <Ionicons name="alert-circle-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.errorText, { color: colors.textMuted }]}>
                {t("wallet.txLoadError")}
              </Text>
            </>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      </View>
    );
  }

  const amountNum = Number(data.amount);
  const config = getTxConfig(data.kind, amountNum, t, scheme);
  const payment = data.payment;
  const status = payment ? STATUS[payment.status] : null;
  // Resolved here rather than stored in STATUS: the tone names a palette slot,
  // and which hex that is depends on the scheme in play.
  const statusColor = status ? colors[status.tone] : colors.success;
  const isPositive = amountNum > 0;
  const bonusNum = payment ? Number(payment.bonusAmount) : 0;

  const Row = ({
    label,
    value,
    copyValue,
    last,
  }: {
    label: string;
    value: ReactNode;
    copyValue?: string | null;
    last?: boolean;
  }) => (
    <Pressable
      disabled={!copyValue}
      onPress={() => copyValue && copy(copyValue)}
      accessibilityRole={copyValue ? "button" : undefined}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.rowValueWrap}>
        {typeof value === "string" || typeof value === "number" ? (
          <Text style={[styles.rowValue, { color: colors.text }]} numberOfLines={1} ellipsizeMode="middle">
            {value}
          </Text>
        ) : (
          value
        )}
        {copyValue ? <Ionicons name="copy-outline" size={14} color={colors.textFaint} /> : null}
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {header}

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isPlaceholderData}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Hero: what happened, how much, and where it stands */}
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: config.bgColor }]}>
            <Ionicons name={config.icon} size={30} color={config.color} />
          </View>
          <Text style={[styles.heroLabel, { color: colors.textMuted }]}>{config.label}</Text>
          <Text style={[styles.heroAmount, { color: isPositive ? colors.success : colors.text }]}>
            {`${isPositive ? "+" : ""}${formatThousands(amountNum)}`}
            <Text style={styles.heroCurrency}> UZS</Text>
          </Text>

          <View
            style={[styles.statusPill, { backgroundColor: `${statusColor}1F` }]}
          >
            <Ionicons
              name={status?.icon ?? "checkmark-circle"}
              size={14}
              color={statusColor}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {t(status?.key ?? "wallet.statusCompleted")}
            </Text>
          </View>

          <Text style={[styles.heroDate, { color: colors.textFaint }]}>
            {formatDateTime(data.createdAt)}
          </Text>
        </View>

        {/* The ledger line itself */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          {t("wallet.sectionOperation")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Row label={t("wallet.fieldType")} value={config.label} />
          <Row label={t("wallet.fieldDate")} value={formatDateTime(data.createdAt)} />
          <Row
            label={t("wallet.fieldAmount")}
            value={`${isPositive ? "+" : ""}${formatThousands(amountNum)} UZS`}
          />
          <Row
            label={t("wallet.fieldBalanceAfter")}
            value={`${formatThousands(data.balanceAfter)} UZS`}
          />
          {data.note ? <Row label={t("wallet.fieldNote")} value={data.note} /> : null}
          <Row label={t("wallet.fieldTransactionId")} value={data.id} copyValue={data.id} last />
        </View>

        {/* The provider payment behind a top-up / bonus / reversal */}
        {payment ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              {t("wallet.sectionPayment")}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Row label={t("wallet.fieldProvider")} value={<ProviderBrand provider={payment.provider} />} />
              <Row
                label={t("wallet.fieldStatus")}
                value={
                  <Text style={[styles.rowValue, { color: status ? statusColor : colors.text }]}>
                    {status ? t(status.key) : payment.status}
                  </Text>
                }
              />
              <Row
                label={t("wallet.fieldOrderNo")}
                value={`#${payment.orderNo}`}
                copyValue={String(payment.orderNo)}
              />
              <Row
                label={t("wallet.fieldAmount")}
                value={`${formatThousands(payment.amount)} UZS`}
              />
              {bonusNum > 0 ? (
                <Row label={t("wallet.fieldBonus")} value={`+${formatThousands(bonusNum)} UZS`} />
              ) : null}
              {payment.providerTxnId ? (
                <Row
                  label={t("wallet.fieldProviderTxn")}
                  value={payment.providerTxnId}
                  copyValue={payment.providerTxnId}
                />
              ) : null}
              <Row label={t("wallet.fieldCreatedAt")} value={formatDateTime(payment.createdAt)} />
              {payment.paidAt ? (
                <Row label={t("wallet.fieldPaidAt")} value={formatDateTime(payment.paidAt)} />
              ) : null}
              {payment.cancelledAt ? (
                <Row label={t("wallet.fieldCancelledAt")} value={formatDateTime(payment.cancelledAt)} />
              ) : null}
              {payment.cancelReason ? (
                <Row label={t("wallet.fieldCancelReason")} value={payment.cancelReason} />
              ) : null}
              <Row label={t("wallet.fieldReceipt")} value={t(RECEIPT[payment.fiscalStatus])} />
              <Row
                label={t("wallet.fieldPaymentId")}
                value={payment.id}
                copyValue={payment.id}
                last
              />
            </View>
          </>
        ) : isFetching ? (
          <ActivityIndicator style={styles.paymentLoading} color={colors.primary} />
        ) : null}

        {data.listingId ? (
          <Pressable
            onPress={() => router.push(`/listing/${data.listingId}`)}
            style={({ pressed }) => [
              styles.linkButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="open-outline" size={16} color={colors.onPrimary} />
            <Text style={[styles.linkButtonText, { color: colors.onPrimary }]}>
              {t("wallet.openListing")}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  roundButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  roundButtonSpacer: {
    width: 38,
  },
  headerTitle: {
    fontSize: 17,
    ...weight("700"),
    textAlign: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  hero: {
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroLabel: {
    fontSize: 14,
    ...weight("600"),
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 32,
    ...weight("800"),
    marginBottom: 12,
  },
  heroCurrency: {
    fontSize: 16,
    ...weight("700"),
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 12.5,
    ...weight("700"),
  },
  heroDate: {
    fontSize: 12.5,
    ...weight("500"),
  },
  sectionTitle: {
    fontSize: 12.5,
    ...weight("700"),
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    gap: 12,
  },
  rowLabel: {
    fontSize: 13.5,
    ...weight("500"),
  },
  rowValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
    justifyContent: "flex-end",
  },
  rowValue: {
    fontSize: 13.5,
    ...weight("700"),
    flexShrink: 1,
    textAlign: "right",
  },
  paymentLoading: {
    marginVertical: 16,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  linkButtonText: {
    // colour comes from the theme at the call site (colors.onPrimary)
    fontSize: 14.5,
    ...weight("700"),
  },
});
