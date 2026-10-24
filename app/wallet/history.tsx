// app/wallet/history.tsx
import { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { weight } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { useAuthStore } from "@/src/features/auth/store/auth.store";
import {
  walletApi,
  WalletTransactionItem,
} from "@/src/features/wallet/api/wallet.api";
import { getTxConfig } from "@/src/features/wallet/utils/txConfig";
import {
  VirtualCard,
  formatThousands,
} from "@/src/features/wallet/components/VirtualCard";

export default function WalletHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const userName = user ? [user.name, user.surname].filter(Boolean).join(" ") : null;

  // Fetch transactions
  const {
    data: txData,
    isLoading: txLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["wallet", "transactions"],
    queryFn: () => walletApi.getTransactions({ limit: 50 }),
  });

  // Fetch overview for latest live balance
  const { data: overview, refetch: refetchOverview } = useQuery({
    queryKey: ["wallet", "overview"],
    queryFn: () => walletApi.overview(),
  });

  const onRefresh = useCallback(() => {
    Promise.all([refetch(), refetchOverview()]);
  }, [refetch, refetchOverview]);

  const items = txData?.items ?? [];

  const formatTxDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const renderItem = ({ item }: { item: WalletTransactionItem }) => {
    const num = Number(item.amount);
    const config = getTxConfig(item.kind, num, t, scheme);
    const isPositive = num > 0;
    const formattedAmount = `${isPositive ? "+" : ""}${formatThousands(num)} UZS`;

    return (
      <Pressable
        // Cast like the other wallet routes: typed routes regenerate on `expo start`.
        onPress={() => router.push(`/wallet/transaction/${item.id}` as any)}
        accessibilityRole="button"
        accessibilityLabel={`${config.label} ${formattedAmount}`}
        style={({ pressed }) => [
          styles.txCard,
          {
            backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
            borderColor: colors.border,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
        ]}
      >
        <View style={styles.txRow}>
          {/* Icon Badge */}
          <View
            style={[
              styles.txIconContainer,
              { backgroundColor: config.bgColor },
            ]}
          >
            <Ionicons name={config.icon} size={22} color={config.color} />
          </View>

          {/* Title & Date */}
          <View style={styles.txCenter}>
            <Text
              style={[styles.txTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {config.label}
            </Text>
            <View style={styles.txMetaRow}>
              <Text style={[styles.txDate, { color: colors.textMuted }]}>
                {formatTxDate(item.createdAt)}
              </Text>
              {item.note ? (
                <Text
                  style={[styles.txNote, { color: colors.textFaint }]}
                  numberOfLines={1}
                >
                  · {item.note}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Amount & Balance After */}
          <View style={styles.txRight}>
            <Text
              style={[
                styles.txAmount,
                { color: isPositive ? colors.success : colors.text },
              ]}
            >
              {formattedAmount}
            </Text>
            {item.balanceAfter ? (
              <Text style={[styles.txBalanceAfter, { color: colors.textFaint }]}>
                {t("wallet.balanceAfter", {
                  amount: `${formatThousands(item.balanceAfter)} UZS`,
                })}
              </Text>
            ) : null}
          </View>

          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textFaint}
            style={styles.txChevron}
          />
        </View>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, paddingTop: insets.top },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t("wallet.historyTitle")}
        </Text>

        <Pressable
          onPress={onRefresh}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
          style={({ pressed }) => [
            styles.refreshButton,
            {
              backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color={colors.textMuted}
          />
        </Pressable>
      </View>

      {/* Main Content */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Live Virtual Card Preview */}
            <View style={styles.cardContainer}>
              <VirtualCard
                variant="compact"
                balance={overview?.balance ?? 0}
                phone={user?.phoneNumber}
                userId={user?.id}
                accountNo={overview?.accountNo}
                name={userName}
                interactive={true}
                onPressTopup={() => router.back()}
                topupLabel={t("wallet.topupLabel")}
              />
            </View>

            {/* Section Title */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("wallet.transactions")}
              </Text>
              {items.length > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor:
                        scheme === "dark"
                          ? colors.surfaceRaised
                          : "rgba(0, 0, 0, 0.05)",
                    },
                  ]}
                >
                  <Text style={[styles.countBadgeText, { color: colors.textMuted }]}>
                    {items.length}
                  </Text>
                </View>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          txLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.emptyIconCircle,
                  {
                    backgroundColor:
                      scheme === "dark"
                        ? colors.surfaceRaised
                        : "rgba(0, 0, 0, 0.04)",
                  },
                ]}
              >
                <Ionicons
                  name="receipt-outline"
                  size={32}
                  color={colors.textMuted}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {t("wallet.noTransactionsYet")}
              </Text>
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                {t("wallet.noTransactionsHint")}
              </Text>
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [
                  styles.emptyTopupBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons name="add" size={18} color={colors.onPrimary} />
                <Text style={[styles.emptyTopupBtnText, { color: colors.onPrimary }]}>
                  {t("wallet.topupBalanceBtn")}
                </Text>
              </Pressable>
            </View>
          )
        }
      />
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
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    ...weight("700"),
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  listHeader: {
    marginBottom: 8,
  },
  cardContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 16,
    ...weight("700"),
  },
  countBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 12,
    ...weight("700"),
  },
  txCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  txIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  txCenter: {
    flex: 1,
    marginRight: 8,
  },
  txTitle: {
    fontSize: 14.5,
    ...weight("700"),
    marginBottom: 2,
  },
  txMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  txDate: {
    fontSize: 12,
    ...weight("500"),
  },
  txNote: {
    fontSize: 11.5,
    flexShrink: 1,
  },
  txRight: {
    alignItems: "flex-end",
  },
  txAmount: {
    fontSize: 14.5,
    ...weight("800"),
    marginBottom: 2,
  },
  txChevron: {
    marginLeft: 6,
  },
  txBalanceAfter: {
    fontSize: 11,
    ...weight("500"),
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    marginTop: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    ...weight("700"),
    marginBottom: 6,
    textAlign: "center",
  },
  emptyHint: {
    fontSize: 13,
    ...weight("400"),
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 12,
  },
  emptyTopupBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyTopupBtnText: {
    // colour comes from the theme at the call site (colors.onPrimary)
    fontSize: 13.5,
    ...weight("700"),
  },
});
