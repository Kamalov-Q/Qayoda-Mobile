import type { Ionicons } from "@expo/vector-icons";
import type { TranslationKey, TranslationParams } from "@/src/i18n/types";
import type { SchemeName } from "@/src/theme/tokens";
import type { TxKind } from "../api/wallet.api";

type T = (key: TranslationKey, params?: TranslationParams) => string;

export interface TxConfig {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  isCredit: boolean;
}

/**
 * The hue each ledger kind is marked with, per scheme.
 *
 * One colour cannot serve both: a mid-tone that reads on the dark card is a
 * 2.5:1 blur on the white one, which is what the single hardcoded set here
 * used to be. Each pair is picked so the glyph and its label clear 3:1 on the
 * card it actually lands on — dark #0E2A30 or white — and TOPUP carries the
 * brand teal rather than the old emerald.
 */
const TONES: Record<string, { dark: string; light: string }> = {
  teal: { dark: "#2FB8A8", light: "#0A7569" },
  violet: { dark: "#B9A4FF", light: "#6D4BD1" },
  sky: { dark: "#5CC7F5", light: "#0369A1" },
  gold: { dark: "#DCC083", light: "#806224" },
  cyan: { dark: "#5BD5DE", light: "#0E7490" },
  indigo: { dark: "#A8AFFF", light: "#4F46E5" },
  muted: { dark: "#A3BABB", light: "#52696B" },
};

/** The wash behind the glyph: the same hue at 12%, so the two never disagree. */
const wash = (hex: string) => `${hex}1F`;

/** Label, icon and colours of one ledger line — shared by the list and the detail screen. */
export function getTxConfig(
  kind: TxKind,
  amountNum: number,
  t: T,
  scheme: SchemeName = "dark",
): TxConfig {
  const tone = (name: keyof typeof TONES) => {
    const hex = TONES[name][scheme];
    return { color: hex, bgColor: wash(hex) };
  };

  switch (kind) {
    case "TOPUP":
      return { label: t("wallet.topupTx"), icon: "arrow-down-circle", ...tone("teal"), isCredit: true };
    case "TOPUP_BONUS":
      return { label: t("wallet.bonusTx"), icon: "gift-outline", ...tone("violet"), isCredit: true };
    case "LISTING_POST":
      return { label: t("wallet.listingPostTx"), icon: "document-text-outline", ...tone("sky"), isCredit: false };
    case "LISTING_PROMOTE":
      return { label: t("wallet.listingPromoteTx"), icon: "rocket-outline", ...tone("gold"), isCredit: false };
    case "VIDEO_POST":
      return { label: t("wallet.videoPostTx"), icon: "videocam-outline", ...tone("violet"), isCredit: false };
    case "REFUND":
      return { label: t("wallet.refundTx"), icon: "refresh-circle-outline", ...tone("cyan"), isCredit: true };
    case "ADMIN_ADJUST":
      return {
        label: t("wallet.adminAdjustTx"),
        icon: amountNum >= 0 ? "shield-checkmark-outline" : "shield-outline",
        ...tone("indigo"),
        isCredit: amountNum >= 0,
      };
    default:
      return { label: kind, icon: "swap-horizontal-outline", ...tone("muted"), isCredit: amountNum >= 0 };
  }
}
