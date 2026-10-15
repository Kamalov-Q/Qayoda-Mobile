import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from "react-native";
import Svg, { Path, Rect, G } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useT } from "@/src/i18n";
import {
  CardTheme,
  useCardThemeStore,
} from "@/src/features/wallet/store/cardTheme.store";

interface VirtualCardProps {
  phone?: string | null;
  userId?: string | null;
  balance?: number | string;
  name?: string | null;
  variant?: "full" | "compact";
  onPressTopup?: () => void;
  topupLabel?: string;
  themeOverride?: CardTheme;
  interactive?: boolean; // Tapping flips the card
}

const UZS_PER_USD = 12_850;

export function formatPhone(phone?: string | null): string {
  if (!phone) return "+998 (93) 100-40-27";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("998")) {
    return `+998 (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10, 12)}`;
  }
  if (digits.length === 9) {
    return `+998 (${digits.slice(0, 2)}) ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7, 9)}`;
  }
  return phone;
}

export function formatUserId(id?: string | null): string {
  if (!id) return "ID: #0001";
  const clean = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (clean.length > 8) {
    return `ID: #${clean.slice(0, 4)} ${clean.slice(-4)}`;
  }
  return `ID: #${clean}`;
}

export function formatThousands(val: string | number): string {
  // The API sends "1000.00": keep the decimal point, then drop the tiyin.
  const num = Math.trunc(typeof val === "number" ? val : Number(String(val).replace(/[^\d.-]/g, "")) || 0);
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatUsd(val: string | number): string {
  // The API sends "1000.00": keep the decimal point, then drop the tiyin.
  const num = Math.trunc(typeof val === "number" ? val : Number(String(val).replace(/[^\d.-]/g, "")) || 0);
  if (num === 0) return "$0.00";
  const usd = num / UZS_PER_USD;
  return `$${usd.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function EmvChip() {
  return (
    <View style={styles.chipContainer}>
      <Svg width={30} height={22} viewBox="0 0 30 22">
        <Rect width="30" height="22" rx="4" fill="#D4AF37" />
        <Rect x="1" y="1" width="28" height="20" rx="3" fill="#E8C355" />
        <Path
          d="M0 7h10M0 15h10M30 7h-10M30 15h-10M10 0v22M20 0v22M10 11h10"
          stroke="#9A7B1C"
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        <Rect x="12" y="8" width="6" height="6" rx="1" fill="#D4AF37" />
      </Svg>
    </View>
  );
}

export function ContactlessIcon({ color = "#94A3B8" }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" style={{ transform: [{ rotate: "90deg" }] }}>
      <G fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
        <Path d="M4.5 12a7.5 7.5 0 0 1 15 0" />
        <Path d="M8 12a4 4 0 0 1 8 0" />
        <Path d="M11 12a1 1 0 0 1 2 0" />
      </G>
    </Svg>
  );
}

export function VirtualCard({
  phone,
  userId,
  balance = 0,
  name,
  variant = "full",
  onPressTopup,
  topupLabel,
  themeOverride,
  interactive = true,
}: VirtualCardProps) {
  const t = useT();
  const resolvedTopupLabel = topupLabel ?? t("wallet.topupLabel");
  const storeTheme = useCardThemeStore((s) => s.currentTheme);
  const theme = themeOverride ?? storeTheme;

  const [isFlipped, setIsFlipped] = useState(false);
  const [flipAnim] = useState(() => new Animated.Value(0));

  const formattedBalanceUzs = formatThousands(balance);
  const formattedBalanceUsd = formatUsd(balance);
  const formattedPhone = formatPhone(phone);
  const formattedId = formatUserId(userId);

  const isCompact = variant === "compact";

  const handleFlip = () => {
    if (!interactive) return;
    try {
      Haptics.selectionAsync();
    } catch {}

    const toValue = isFlipped ? 0 : 180;
    Animated.spring(flipAnim, {
      toValue,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();

    setIsFlipped(!isFlipped);
  };

  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ["0deg", "180deg"],
  });

  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ["180deg", "360deg"],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 89, 90, 180],
    outputRange: [1, 1, 0, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 89, 90, 180],
    outputRange: [0, 0, 1, 1],
  });

  return (
    <Pressable
      onPress={handleFlip}
      accessibilityRole="button"
      accessibilityLabel={t("wallet.flipCurrencyAccessibility")}
      style={styles.cardWrapper}
    >
      {/* Front Face: UZS */}
      <Animated.View
        style={[
          styles.card,
          isCompact ? styles.cardCompact : styles.cardFull,
          {
            backgroundColor: theme.bgDark,
            transform: [{ perspective: 1200 }, { rotateY: frontRotateY }],
            opacity: frontOpacity,
          },
        ]}
      >
        {/* Decorative dynamic glows matching selected theme */}
        <View
          style={[
            styles.radialAccentTopRight,
            { backgroundColor: theme.glowStart },
          ]}
        />
        <View
          style={[
            styles.radialAccentBottomLeft,
            { backgroundColor: theme.glowEnd },
          ]}
        />

        {/* Card Header */}
        <View style={styles.headerRow}>
          <View style={styles.brandContainer}>
            <View
              style={[
                styles.brandDot,
                {
                  backgroundColor: theme.accent,
                  shadowColor: theme.accent,
                },
              ]}
            />
            <Text style={styles.brandText}>Growen City</Text>
          </View>

          <View style={styles.headerRight}>
            <ContactlessIcon color="rgba(255, 255, 255, 0.7)" />
            <View style={styles.currencyBadge}>
              <Ionicons name="swap-horizontal" size={11} color={theme.accent} />
              <Text style={[styles.currencyBadgeText, { color: theme.accent }]}>
                {t("wallet.toUsd")}
              </Text>
            </View>
            <View style={styles.virtualPill}>
              <Text style={styles.virtualPillText}>VIRTUAL</Text>
            </View>
          </View>
        </View>

        {/* Middle Row with EMV Chip & UZS Balance */}
        <View style={[styles.middleRow, isCompact && styles.middleRowCompact]}>
          {!isCompact && <EmvChip />}

          <View style={styles.balanceCol}>
            <Text style={styles.balanceLabel}>{t("wallet.currentBalance")}</Text>
            <View style={styles.balanceValueRow}>
              <Text
                style={[
                  styles.balanceNumber,
                  isCompact && styles.balanceNumberCompact,
                ]}
              >
                {formattedBalanceUzs}
              </Text>
              <Text
                style={[
                  styles.balanceCurrency,
                  isCompact && styles.balanceCurrencyCompact,
                  { color: theme.accent },
                ]}
              >
                UZS
              </Text>
            </View>
          </View>

          {isCompact && onPressTopup && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onPressTopup();
              }}
              style={({ pressed }) => [
                styles.topupBtnBadge,
                {
                  backgroundColor: theme.accent,
                  shadowColor: theme.accent,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons name="add" size={15} color="#FFFFFF" />
              <Text style={styles.topupBtnText}>{resolvedTopupLabel}</Text>
            </Pressable>
          )}
        </View>

        {/* Card Footer: Phone, ID, and Name */}
        <View style={styles.footerRow}>
          <View style={styles.footerLeft}>
            <Text style={styles.phoneText}>{formattedPhone}</Text>
            {name ? (
              <Text style={styles.nameText}>{name.toUpperCase()}</Text>
            ) : null}
          </View>

          <View style={styles.idBadge}>
            <Text style={styles.idText}>{formattedId}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Back Face: USD (Absolute overlay positioned directly behind front face) */}
      <Animated.View
        style={[
          styles.card,
          styles.cardBack,
          isCompact ? styles.cardCompact : styles.cardFull,
          {
            backgroundColor: theme.bgDark,
            transform: [{ perspective: 1200 }, { rotateY: backRotateY }],
            opacity: backOpacity,
          },
        ]}
      >
        {/* Decorative dynamic glows matching selected theme */}
        <View
          style={[
            styles.radialAccentTopRight,
            { backgroundColor: theme.glowStart },
          ]}
        />
        <View
          style={[
            styles.radialAccentBottomLeft,
            { backgroundColor: theme.glowEnd },
          ]}
        />

        {/* Card Header (USD face) */}
        <View style={styles.headerRow}>
          <View style={styles.brandContainer}>
            <View
              style={[
                styles.brandDot,
                {
                  backgroundColor: theme.accent,
                  shadowColor: theme.accent,
                },
              ]}
            />
            <Text style={styles.brandText}>Growen City</Text>
          </View>

          <View style={styles.headerRight}>
            <ContactlessIcon color="rgba(255, 255, 255, 0.7)" />
            <View style={styles.currencyBadge}>
              <Ionicons name="swap-horizontal" size={11} color={theme.accent} />
              <Text style={[styles.currencyBadgeText, { color: theme.accent }]}>
                {t("wallet.toUzs")}
              </Text>
            </View>
            <View
              style={[
                styles.virtualPill,
                { borderColor: theme.accent, backgroundColor: `${theme.accent}1A` },
              ]}
            >
              <Text style={[styles.virtualPillText, { color: theme.accent }]}>
                USD
              </Text>
            </View>
          </View>
        </View>

        {/* Middle Row with EMV Chip & USD Balance */}
        <View style={[styles.middleRow, isCompact && styles.middleRowCompact]}>
          {!isCompact && <EmvChip />}

          <View style={styles.balanceCol}>
            <Text style={styles.balanceLabel}>{t("wallet.currentBalanceUsd")}</Text>
            <View style={styles.balanceValueRow}>
              <Text
                style={[
                  styles.balanceNumber,
                  isCompact && styles.balanceNumberCompact,
                ]}
              >
                {formattedBalanceUsd}
              </Text>
              <Text
                style={[
                  styles.balanceCurrency,
                  isCompact && styles.balanceCurrencyCompact,
                  { color: theme.accent },
                ]}
              >
                USD
              </Text>
            </View>
          </View>

          {isCompact && onPressTopup && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onPressTopup();
              }}
              style={({ pressed }) => [
                styles.topupBtnBadge,
                {
                  backgroundColor: theme.accent,
                  shadowColor: theme.accent,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons name="add" size={15} color="#FFFFFF" />
              <Text style={styles.topupBtnText}>{resolvedTopupLabel}</Text>
            </Pressable>
          )}
        </View>

        {/* Card Footer: Phone, ID, and Name */}
        <View style={styles.footerRow}>
          <View style={styles.footerLeft}>
            <Text style={styles.phoneText}>{formattedPhone}</Text>
            {name ? (
              <Text style={styles.nameText}>{name.toUpperCase()}</Text>
            ) : null}
          </View>

          <View style={styles.idBadge}>
            <Text style={styles.idText}>{formattedId}</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    position: "relative",
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
    position: "relative",
    backfaceVisibility: "hidden",
  },
  cardBack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardFull: {
    padding: 20,
    minHeight: 184,
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cardCompact: {
    padding: 16,
    minHeight: 140,
    justifyContent: "space-between",
  },
  radialAccentTopRight: {
    position: "absolute",
    right: -40,
    top: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  radialAccentBottomLeft: {
    position: "absolute",
    left: -30,
    bottom: -50,
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    shadowOpacity: 0.9,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  brandText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  currencyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  currencyBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  virtualPill: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  virtualPillText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  chipContainer: {
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  middleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginVertical: 14,
    zIndex: 2,
  },
  middleRowCompact: {
    marginVertical: 8,
    alignItems: "center",
  },
  balanceCol: {
    gap: 2,
  },
  balanceLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  balanceValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  balanceNumber: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  balanceNumberCompact: {
    fontSize: 24,
  },
  balanceCurrency: {
    fontSize: 15,
    fontWeight: "700",
  },
  balanceCurrencyCompact: {
    fontSize: 13,
  },
  topupBtnBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  topupBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    zIndex: 2,
  },
  footerLeft: {
    gap: 2,
  },
  phoneText: {
    color: "#E2E8F0",
    fontSize: 13.5,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  nameText: {
    color: "#94A3B8",
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 0.6,
  },
  idBadge: {
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  idText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
