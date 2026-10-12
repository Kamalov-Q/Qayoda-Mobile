// app/wallet/index.tsx
import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Linking,
} from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as ExpoLinking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { useAuthStore } from "@/src/features/auth/store/auth.store";
import { toast } from "@/src/components/ui/Toast";
import {
  PaymeBrand,
  ClickBrand,
  PaynetBrand,
} from "@/src/features/wallet/components/PaymentLogos";
import {
  VirtualCard,
  formatThousands,
} from "@/src/features/wallet/components/VirtualCard";
import { CardThemeSelector } from "@/src/features/wallet/components/CardThemeSelector";
import { walletApi } from "@/src/features/wallet/api/wallet.api";

const QUICK_AMOUNTS = [1_000, 50_000, 100_000, 200_000, 500_000];

type PaymentMethod = "CLICK" | "PAYME" | "PAYNET";

export default function WalletTopupScreen() {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const t = useT();
  const user = useAuthStore((s) => s.user);

  // Price cannot be manually edited; driven directly by quick amount selections
  const [selectedAmount, setSelectedAmount] = useState<number>(1_000);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("PAYNET");

  const userName = user ? [user.name, user.surname].filter(Boolean).join(" ") : null;

  const paymentMethods: {
    id: PaymentMethod;
    renderLogo: () => React.ReactNode;
    subtitle: string;
    badge: string;
    badgeColor: string;
    badgeBg: string;
  }[] = [
      {
        id: "PAYNET",
        renderLogo: () => <PaynetBrand size="md" />,
        subtitle: t("wallet.paynetSubtitle"),
        badge: t("wallet.badgeCash"),
        badgeColor: "#00A859",
        badgeBg: scheme === "dark" ? "rgba(0, 168, 89, 0.15)" : "#ECFDF5",
      },
      {
        id: "CLICK",
        renderLogo: () => <ClickBrand size="md" />,
        subtitle: t("wallet.clickSubtitle"),
        badge: t("wallet.badgeZeroFee"),
        badgeColor: "#0073FF",
        badgeBg: scheme === "dark" ? "rgba(0, 115, 255, 0.15)" : "#EBF5FF",
      },
      {
        id: "PAYME",
        renderLogo: () => <PaymeBrand size="md" />,
        subtitle: t("wallet.paymeSubtitle"),
        badge: t("wallet.badgeInstant"),
        badgeColor: "#00BBC7",
        badgeBg: scheme === "dark" ? "rgba(0, 187, 199, 0.15)" : "#E2F7F9",
      },
    ];

  const [loadingTopup, setLoadingTopup] = useState(false);

  const handleTopup = async () => {
    if (selectedAmount < 1_000) {
      toast.info(t("validation.range", { min: "1 000", max: "10 000 000" }));
      return;
    }

    if (!user?.id) {
      toast.error("Iltimos, avval tizimga kiring");
      return;
    }

    // ── PAYNET ────────────────────────────────────────────────────────────
    if (selectedMethod === "PAYNET") {
      const merchantId = "52589";
      const paynetUrl = `https://app.paynet.uz/?m=${merchantId}&c=${encodeURIComponent(user.id)}&a=${selectedAmount}`;
      try {
        const canOpen = await Linking.canOpenURL(paynetUrl);
        if (canOpen) {
          await Linking.openURL(paynetUrl);
        } else {
          await WebBrowser.openBrowserAsync(paynetUrl);
        }
      } catch {
        await WebBrowser.openBrowserAsync(paynetUrl);
      }
      return;
    }

    // ── PAYME ──────────────────────────────────────────────────────────────
    if (selectedMethod === "PAYME") {
      toast.info("Payme orqali to'lov tez orada ishga tushadi");
      return;
    }

    // ── CLICK (via backend) ────────────────────────────────────────────────
    if (selectedMethod === "CLICK") {
      setLoadingTopup(true);
      // Expo Go uses exp://... scheme, production uses growencity://...
      const returnUrl = ExpoLinking.createURL("/wallet/result");
      try {
        const order = await walletApi.createTopup({
          amount: selectedAmount,
          provider: "CLICK",
          clientId: returnUrl, // pass as clientId for idempotency per attempt
        });

        // 2. Open Click's checkout page in the in-app browser
        const result = await WebBrowser.openAuthSessionAsync(
          order.payUrl,
          returnUrl
        );

        // 3. Poll status until paid or cancelled (max 30s)
        if (result.type === "success" || result.type === "dismiss") {
          let attempts = 0;
          const poll = setInterval(async () => {
            attempts++;
            try {
              const status = await walletApi.getTopupStatus(order.paymentId);
              if (status.status === "PAID") {
                clearInterval(poll);
                toast.success(
                  `${formatThousands(selectedAmount)} UZS muvaffaqiyatli to'landi! 🎉`
                );
              } else if (status.status === "CANCELLED") {
                clearInterval(poll);
                toast.error("To'lov bekor qilindi");
              } else if (attempts >= 15) {
                // ~30s timeout
                clearInterval(poll);
                toast.info("To'lov tekshirilmoqda — keyinroq qarang");
              }
            } catch {
              clearInterval(poll);
            }
          }, 2000);
        }
      } catch {
        toast.error("To'lovni yaratishda xatolik yuz berdi");
      } finally {
        setLoadingTopup(false);
      }
      return;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
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
            {t("wallet.topupTitle")}
          </Text>
        </View>

        <Pressable
          onPress={() => router.push("/wallet/history" as any)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.historyPill,
            {
              backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.historyText, { color: colors.text }]}>
            {t("wallet.historyTitle")}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 90 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Distinctive Growen City Virtual Card */}
          <VirtualCard
            phone={user?.phoneNumber}
            userId={user?.id}
            name={userName}
            balance={0}
            variant="full"
          />

          {/* Interactive Card Theme Selector */}
          <CardThemeSelector />

          {/* Read-only / Non-editable Selected Price Display */}
          <View
            style={[
              styles.amountDisplayContainer,
              {
                backgroundColor: scheme === "dark" ? colors.surfaceRaised : "#F3F4F6",
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.amountDisplayLeft}>
              <Text style={[styles.amountLabel, { color: colors.textFaint }]}>
                {t("wallet.enterAmount")}
              </Text>
              <Text style={[styles.amountValue, { color: colors.text }]}>
                {formatThousands(selectedAmount)} UZS
              </Text>
            </View>
            <View
              style={[
                styles.lockBadge,
                {
                  backgroundColor: scheme === "dark" ? colors.surface : "#E5E7EB",
                },
              ]}
            >
              <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
            </View>
          </View>

          {/* Quick Amount Chips */}
          <View style={styles.quickChipsRow}>
            {QUICK_AMOUNTS.map((amt) => {
              const active = selectedAmount === amt;
              return (
                <Pressable
                  key={amt}
                  onPress={() => setSelectedAmount(amt)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.quickChip,
                    {
                      backgroundColor: active
                        ? colors.text
                        : scheme === "dark"
                          ? colors.surfaceRaised
                          : "#F3F4F6",
                      borderWidth: active ? 1 : 0,
                      borderColor: colors.text,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.quickChipText,
                      { color: active ? colors.bg : colors.text },
                    ]}
                  >
                    {formatThousands(amt)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Section: Payment Methods */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            {t("wallet.paymentMethods")}
          </Text>

          {/* Modern Curated Payment Method Cards */}
          <View style={styles.methodsList}>
            {paymentMethods.map((method) => {
              const selected = selectedMethod === method.id;
              return (
                <Pressable
                  key={method.id}
                  onPress={() => setSelectedMethod(method.id)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.methodCard,
                    {
                      backgroundColor: selected
                        ? scheme === "dark"
                          ? "#1E293B"
                          : "#F8FAFC"
                        : colors.surface,
                      borderColor: selected
                        ? scheme === "dark"
                          ? "#10B981"
                          : "#18181B"
                        : colors.border,
                      borderWidth: selected ? 2 : 1,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={styles.methodCardHeader}>
                    <View style={styles.methodLogoContainer}>
                      {method.renderLogo()}
                    </View>

                    <View style={styles.methodRight}>
                      <View
                        style={[
                          styles.methodBadge,
                          { backgroundColor: method.badgeBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.methodBadgeText,
                            { color: method.badgeColor },
                          ]}
                        >
                          {method.badge}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.radioCircle,
                          {
                            borderColor: selected
                              ? scheme === "dark"
                                ? "#10B981"
                                : "#18181B"
                              : colors.borderStrong,
                            backgroundColor: selected
                              ? scheme === "dark"
                                ? "#10B981"
                                : "#18181B"
                              : "transparent",
                          },
                        ]}
                      >
                        {selected && (
                          <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                        )}
                      </View>
                    </View>
                  </View>

                  <Text
                    style={[styles.methodSubtitle, { color: colors.textMuted }]}
                  >
                    {method.subtitle}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Sticky Bottom Button */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.bg,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
            },
          ]}
        >
          <Pressable
            onPress={handleTopup}
            disabled={loadingTopup}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.topupButton,
              {
                backgroundColor: colors.text,
                opacity: loadingTopup ? 0.65 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.topupButtonText,
                { color: colors.bg },
              ]}
            >
              {loadingTopup
                ? "Tekshirilmoqda..."
                : `${t("wallet.topupButton")} (${formatThousands(selectedAmount)} UZS)`}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  historyPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  historyText: {
    fontSize: 13,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  amountDisplayContainer: {
    height: 58,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    borderWidth: 1,
  },
  amountDisplayLeft: {
    justifyContent: "center",
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  lockBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  quickChipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  quickChip: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 12,
  },
  methodsList: {
    gap: 10,
    marginBottom: 20,
  },
  methodCard: {
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  methodCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  methodLogoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  methodRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  methodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  methodBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  methodSubtitle: {
    fontSize: 12.5,
    fontWeight: "500",
    marginLeft: 2,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  topupButton: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  topupButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
