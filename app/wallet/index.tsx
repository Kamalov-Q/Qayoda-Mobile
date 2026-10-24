// app/wallet/index.tsx
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
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
import * as Crypto from "expo-crypto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { weight } from "@/src/theme/tokens";
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
import { usePendingTopupStore } from "@/src/features/wallet/store/pendingTopup.store";
import { requirePhone } from "@/src/features/auth/guest";
import { ApiError } from "@/src/lib/api-client";
import { useWalletOverview } from "@/src/features/wallet/hooks/useWalletOverview";

const QUICK_AMOUNTS = [1_000, 50_000, 100_000, 200_000, 500_000];

/**
 * What the server will take in one go.
 *
 * The presets are the common amounts, not the only ones: anything in this
 * range can be typed instead. Both bounds are enforced here as well as on
 * the server, so a wrong amount is a disabled button rather than a rejected
 * payment the user has already left the app for.
 */
const MIN_TOPUP = 1_000;
const MAX_TOPUP = 10_000_000;
/** 10 000 000 is eight digits; one more lets it be typed and then corrected. */
const MAX_DIGITS = 9;

type PaymentMethod = "CLICK" | "PAYME" | "PAYNET";

export default function WalletTopupScreen() {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const t = useT();
  const user = useAuthStore((s) => s.user);

  const { data: overview } = useWalletOverview();
  const setPendingTopup = usePendingTopupStore((s) => s.setPending);

  /**
   * The amount, as the digits the field holds.
   *
   * Text rather than a number because an empty field is a state someone is
   * in the middle of typing through, and `0` cannot say that. The presets
   * write to the same place, so a tapped amount is as editable afterwards
   * as a typed one.
   */
  const [amountText, setAmountText] = useState(String(QUICK_AMOUNTS[0]));
  const selectedAmount = Number(amountText) || 0;
  const amountValid =
    selectedAmount >= MIN_TOPUP && selectedAmount <= MAX_TOPUP;
  // An empty field is on the way somewhere, not a mistake: it disables the
  // button like any other unpayable amount, but it is not painted red.
  const amountInvalid = amountText.length > 0 && !amountValid;

  const onChangeAmount = (next: string) => {
    // The field shows "1 000 000", so the separators it is formatted with
    // have to come back out before this is a number again. Leading zeros go
    // too — "0500 000" is not an amount anyone meant to type.
    const digits = next.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    if (digits.length > MAX_DIGITS) return;
    setAmountText(digits);
  };
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("PAYNET");

  const userName = user ? [user.name, user.surname].filter(Boolean).join(" ") : null;

  const allMethods: {
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

  /**
   * Which of them the server will actually accept.
   *
   * `GET /wallet` reports the providers it has credentials for — Click and
   * Payme are dropped when their keys are unset, Paynet when its service id
   * is. Offering one the server has disabled ends in a PROVIDER_UNAVAILABLE
   * toast after the user has already chosen an amount, and turning a provider
   * off would otherwise need an app release. Until the overview arrives the
   * full list is shown rather than an empty one: a brief extra option is a
   * smaller wrong than a screen with nothing to tap.
   */
  const enabled = overview?.providers;
  const paymentMethods = enabled
    ? allMethods.filter((m) => enabled.includes(m.id))
    : allMethods;

  // The selection follows the list rather than a useEffect writing state back:
  // if the server does not offer what is selected (or what this screen starts
  // on), the first available method is what the buttons below act on.
  const activeMethod =
    paymentMethods.some((m) => m.id === selectedMethod)
      ? selectedMethod
      : (paymentMethods[0]?.id ?? selectedMethod);

  const [loadingTopup, setLoadingTopup] = useState(false);

  const handleTopup = async () => {
    if (!amountValid) {
      toast.info(
        t("validation.range", {
          min: formatThousands(MIN_TOPUP),
          max: formatThousands(MAX_TOPUP),
        }),
      );
      return;
    }

    if (!user?.id) {
      toast.error(t("wallet.pleaseLogin"));
      return;
    }

    // ── PAYNET ────────────────────────────────────────────────────────────
    // Push-model: nothing to create, just a link to open. The server builds
    // it — the merchant id lives in its env, and the account reference is the
    // user's SHORT account number. This screen used to assemble the URL
    // itself from a hardcoded merchant id and the user's uuid, which meant a
    // wrong merchant id could only be fixed by shipping a new build.
    if (activeMethod === "PAYNET") {
      setLoadingTopup(true);
      try {
        const { payUrl } = await walletApi.paynetLink(selectedAmount);
        const canOpen = await Linking.canOpenURL(payUrl);
        if (canOpen) {
          await Linking.openURL(payUrl);
        } else {
          await WebBrowser.openBrowserAsync(payUrl);
        }
      } catch (err) {
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : t("wallet.paymentCancelled"),
        );
      } finally {
        setLoadingTopup(false);
      }
      return;
    }

    // ── CLICK and PAYME (both via the backend) ─────────────────────────────
    // One branch, because the two are the same flow: the server creates the
    // order and returns a checkout URL, the user pays outside the app, and
    // the provider's webhook — not the return link — is what credits the
    // wallet. Only the provider name differs. Paynet is above on its own
    // because it is push-model: there is no order to create.
    if (activeMethod === "CLICK" || activeMethod === "PAYME") {
      // The server refuses an order without a verified phone
      // (PHONE_REQUIRED). Asking first turns that into the add-a-number flow
      // instead of a raw error toast.
      if (!user.phoneNumber) {
        requirePhone();
        return;
      }

      setLoadingTopup(true);
      // Expo Go uses exp://... scheme, production uses growencity://...
      const returnUrl = ExpoLinking.createURL("/wallet/result");
      try {
        const order = await walletApi.createTopup({
          amount: selectedAmount,
          provider: activeMethod,
          clientId: Crypto.randomUUID(),
        });

        // Remembered before leaving the app: when Click or Payme finishes in
        // its own app it opens growencity://wallet/result, which carries no id.
        setPendingTopup({ paymentId: order.paymentId, amount: selectedAmount });

        await WebBrowser.openAuthSessionAsync(order.payUrl, returnUrl);

        // However the browser closed — paid, cancelled or just dismissed —
        // the result screen asks the server and reports. navigate, not push:
        // if Click's return link already opened it, this updates that one
        // instead of stacking a second copy.
        router.navigate({
          pathname: "/wallet/result",
          params: { paymentId: order.paymentId },
        });
      } catch (err) {
        if (err instanceof ApiError && err.code === "PHONE_REQUIRED") {
          // The session's phone was stale; the server has the final say.
          requirePhone();
        } else {
          toast.error(
            err instanceof Error && err.message
              ? err.message
              : t("wallet.paymentCancelled"),
          );
        }
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
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons
            name="receipt-outline"
            size={15}
            color={colors.primary}
          />
          <Text style={[styles.historyText, { color: colors.text }]}>
            {t("wallet.historyTitle")}
          </Text>
          <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
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
          // Or the first tap on a preset only dismisses the keyboard.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Distinctive Growen City Virtual Card */}
          <VirtualCard
            phone={user?.phoneNumber}
            userId={user?.id}
            accountNo={overview?.accountNo}
            name={userName}
            balance={overview?.balance ?? 0}
            variant="full"
          />

          {/* Interactive Card Theme Selector */}
          <CardThemeSelector />

          {/* Type an amount, or take one of the presets under it — the
              presets write into this same field, so either way what is
              being paid is one editable number. It used to be a read-only
              display with a padlock-shaped badge beside it, which left
              anyone wanting 75 000 with no way to ask for it. */}
          <View
            style={[
              styles.amountDisplayContainer,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: amountInvalid ? colors.danger : colors.border,
              },
            ]}
          >
            <View style={[styles.amountDisplayLeft, { flex: 1 }]}>
              <Text style={[styles.amountLabel, { color: colors.textFaint }]}>
                {t("wallet.enterAmount")}
              </Text>
              <TextInput
                value={amountText ? formatThousands(amountText) : ""}
                onChangeText={onChangeAmount}
                keyboardType="number-pad"
                inputMode="numeric"
                returnKeyType="done"
                placeholder="0"
                placeholderTextColor={colors.textFaint}
                selectionColor={colors.primary}
                accessibilityLabel={t("wallet.enterAmount")}
                // padding: 0 — Android gives a TextInput its own padding,
                // which pushes the number off the baseline the label sets.
                style={[
                  styles.amountValue,
                  { color: colors.text, padding: 0 },
                ]}
              />
            </View>

            <Text style={[styles.amountCurrency, { color: colors.textMuted }]}>
              UZS
            </Text>

            {/* Clears in one tap rather than nine backspaces over a number
                that is mostly zeros. */}
            {amountText ? (
              <Pressable
                onPress={() => setAmountText("")}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t("common.clear")}
                style={({ pressed }) => [
                  styles.clearBadge,
                  {
                    backgroundColor: colors.surface,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons
                  name="close"
                  size={16}
                  color={colors.textMuted}
                />
              </Pressable>
            ) : null}
          </View>

          {/* The bounds, said once and in place, rather than as a toast
              after the button has been pressed. */}
          <Text
            style={[
              styles.amountHint,
              { color: amountInvalid ? colors.danger : colors.textFaint },
            ]}
          >
            {t("validation.range", {
              min: formatThousands(MIN_TOPUP),
              max: formatThousands(MAX_TOPUP),
            })}
          </Text>

          {/* Quick Amount Chips */}
          <View style={styles.quickChipsRow}>
            {QUICK_AMOUNTS.map((amt) => {
              const active = selectedAmount === amt;
              return (
                <Pressable
                  key={amt}
                  onPress={() => setAmountText(String(amt))}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.quickChip,
                    {
                      backgroundColor: active
                        ? colors.primary
                        : colors.surfaceRaised,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.quickChipText,
                      { color: active ? colors.onPrimary : colors.text },
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
              const selected = activeMethod === method.id;
              return (
                <Pressable
                  key={method.id}
                  onPress={() => setSelectedMethod(method.id)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.methodCard,
                    {
                      // Tokens, not a per-scheme literal: this card used to
                      // name slate and emerald by hand, which is how it kept
                      // the old palette after the brand moved to teal.
                      backgroundColor: selected
                        ? colors.primarySoft
                        : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
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
                              ? colors.primary
                              : colors.borderStrong,
                            backgroundColor: selected
                              ? colors.primary
                              : "transparent",
                          },
                        ]}
                      >
                        {selected && (
                          <Ionicons name="checkmark" size={13} color={colors.onPrimary} />
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
            disabled={loadingTopup || !amountValid}
            accessibilityRole="button"
            accessibilityState={{ disabled: loadingTopup || !amountValid }}
            style={({ pressed }) => [
              styles.topupButton,
              {
                backgroundColor: colors.text,
                opacity:
                  loadingTopup || !amountValid ? 0.5 : pressed ? 0.85 : 1,
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
                ? t("common.loading")
                : amountValid
                  ? `${t("wallet.topupButton")} (${formatThousands(selectedAmount)} UZS)`
                  : t("wallet.topupButton")}
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
    flexShrink: 1,
    marginRight: 8,
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
    ...weight("700"),
    flexShrink: 1,
    maxWidth: 180,
  },
  historyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    flexShrink: 0,
    marginRight: 8,
  },
  historyText: {
    fontSize: 12.5,
    ...weight("600"),
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
    ...weight("600"),
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  amountValue: {
    fontSize: 18,
    ...weight("800"),
  },
  amountCurrency: {
    fontSize: 15,
    ...weight("700"),
    marginRight: 10,
  },
  amountHint: {
    fontSize: 12,
    ...weight("500"),
    marginTop: -6,
    marginBottom: 12,
    marginLeft: 4,
  },
  clearBadge: {
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
    ...weight("700"),
  },
  sectionTitle: {
    fontSize: 15,
    ...weight("600"),
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
    ...weight("700"),
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
    ...weight("500"),
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
    ...weight("700"),
  },
});
