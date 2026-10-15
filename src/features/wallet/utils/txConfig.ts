import type { Ionicons } from "@expo/vector-icons";
import type { TranslationKey, TranslationParams } from "@/src/i18n/types";
import type { TxKind } from "../api/wallet.api";

type T = (key: TranslationKey, params?: TranslationParams) => string;

export interface TxConfig {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  isCredit: boolean;
}

/** Label, icon and colours of one ledger line — shared by the list and the detail screen. */
export function getTxConfig(kind: TxKind, amountNum: number, t: T): TxConfig {
  switch (kind) {
    case "TOPUP":
      return { label: t("wallet.topupTx"), icon: "arrow-down-circle", color: "#10B981", bgColor: "rgba(16, 185, 129, 0.12)", isCredit: true };
    case "TOPUP_BONUS":
      return { label: t("wallet.bonusTx"), icon: "gift-outline", color: "#8B5CF6", bgColor: "rgba(139, 92, 246, 0.12)", isCredit: true };
    case "LISTING_POST":
      return { label: t("wallet.listingPostTx"), icon: "document-text-outline", color: "#3B82F6", bgColor: "rgba(59, 130, 246, 0.12)", isCredit: false };
    case "STORY_POST":
      return { label: t("wallet.storyPostTx"), icon: "videocam-outline", color: "#EC4899", bgColor: "rgba(236, 72, 153, 0.12)", isCredit: false };
    case "LISTING_PROMOTE":
      return { label: t("wallet.listingPromoteTx"), icon: "rocket-outline", color: "#F59E0B", bgColor: "rgba(245, 158, 11, 0.12)", isCredit: false };
    case "REFUND":
      return { label: t("wallet.refundTx"), icon: "refresh-circle-outline", color: "#06B6D4", bgColor: "rgba(6, 182, 212, 0.12)", isCredit: true };
    case "ADMIN_ADJUST":
      return {
        label: t("wallet.adminAdjustTx"),
        icon: amountNum >= 0 ? "shield-checkmark-outline" : "shield-outline",
        color: "#6366F1", bgColor: "rgba(99, 102, 241, 0.12)", isCredit: amountNum >= 0,
      };
    default:
      return { label: kind, icon: "swap-horizontal-outline", color: "#94A3B8", bgColor: "rgba(148, 163, 184, 0.12)", isCredit: amountNum >= 0 };
  }
}
