// src/features/price-bids/components/BidCard.tsx
//
// A bid, as it appears in the chat thread.
//
// Drawn from the BID, not from the message: the message is an immutable line
// of conversation and the bid underneath it changes state. Reading the card
// off the message would leave "Accept" on screen after somebody else had
// already accepted it.
import { memo } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, type } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useLanguage, useT, type TranslationKey } from "@/src/i18n";
import { Button } from "@/src/components/ui";
import {
  canRespondTo,
  isBidOpen,
  type PriceBid,
  type PriceBidStatus,
} from "../api/price-bids.api";
import { formatBid } from "./BidSheet";

/** What a settled card says where its buttons used to be. */
const SETTLED_LABEL: Record<PriceBidStatus, TranslationKey | null> = {
  PENDING: null,
  ACCEPTED: "bids.statusAccepted",
  DECLINED: "bids.statusDeclined",
  COUNTERED: "bids.statusCountered",
  WITHDRAWN: "bids.statusWithdrawn",
  EXPIRED: "bids.statusExpired",
};

const daysLeft = (iso: string): number =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

interface Props {
  bid: PriceBid;
  /** The signed-in reader — decides whether the buttons are theirs to press. */
  viewerId: string | undefined;
  onAccept: (bid: PriceBid) => void;
  onDecline: (bid: PriceBid) => void;
  onCounter: (bid: PriceBid) => void;
  busy?: boolean;
}

export const BidCard = memo(function BidCard({
  bid,
  viewerId,
  onAccept,
  onDecline,
  onCounter,
  busy,
}: Props) {
  const { colors, text } = useTheme();
  const t = useT();
  const language = useLanguage();

  const mine = bid.authorId === viewerId;
  const canRespond = canRespondTo(bid, viewerId);
  const open = isBidOpen(bid);
  const settled = SETTLED_LABEL[bid.status];
  const isCounter = bid.direction === "SELLER";

  // Only printed when both sides are the same currency — a percentage across
  // two currencies is a number computed from an exchange rate the reader
  // never saw, and it would drift under them.
  const delta =
    bid.askingAmount && bid.askingCurrency === bid.currency && bid.askingAmount > 0
      ? Math.round((1 - bid.amount / bid.askingAmount) * 100)
      : null;

  const days = daysLeft(bid.expiresAt);

  /**
   * A countered bid is history, not an offer.
   *
   * It is the number that WAS on the table, replaced by the one directly
   * under it, and it can never be answered again. Drawn full size it cost
   * the same hundred-odd points as the live card, so haggling three times
   * filled the thread with three near-identical panels — two of them dead —
   * and pushed the one with the buttons on it off the screen. Collapsed to a
   * struck-through line the trail is still completely readable: what was
   * asked, that it was countered, and when.
   *
   * Only COUNTERED. Declined, withdrawn and expired bids are the END of a
   * negotiation rather than a step inside one, so they keep the card that
   * says so.
   */
  const superseded = bid.status === "COUNTERED";

  const time = new Date(bid.createdAt).toLocaleTimeString(language, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const accepted = bid.status === "ACCEPTED";
  // Cancelled, not concluded: a number that never became anything. Struck
  // through for the same reason a crossed-out price is — it was on the table
  // and is not any more. ACCEPTED is an outcome, so it keeps its weight.
  const voided =
    bid.status === "WITHDRAWN" ||
    bid.status === "DECLINED" ||
    bid.status === "EXPIRED" ||
    bid.status === "COUNTERED";

  if (superseded) {
    return (
      <View
        style={{
          alignSelf: mine ? "flex-end" : "flex-start",
          maxWidth: "88%",
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
        }}
      >
        <Ionicons name="pricetag-outline" size={11} color={colors.textFaint} />
        <Text
          style={{
            ...type.caption,
            color: colors.textMuted,
            textDecorationLine: "line-through",
          }}
          numberOfLines={1}
        >
          {formatBid(bid.amount, bid.currency)}
        </Text>
        <Text
          style={{ ...type.caption, color: colors.textFaint, flexShrink: 1 }}
          numberOfLines={1}
        >
          {t("bids.statusCountered")}
        </Text>
        <Text style={{ ...type.caption, fontSize: 10, color: colors.textFaint }}>
          {time}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        // The thread's own alignment language, not margins: mine sits right
        // and theirs sits left, with the corner nearest the sender squared
        // off, exactly as MessageBubble does it. A full-width card inset by
        // a margin reads as neither, which is why a bid you had just sent
        // yourself still looked like it had arrived.
        alignSelf: mine ? "flex-end" : "flex-start",
        // Wider than a bubble's 78%: this one carries three buttons.
        maxWidth: "88%",
        minWidth: "62%",
        borderRadius: radii.lg,
        borderBottomRightRadius: mine ? 4 : radii.lg,
        borderBottomLeftRadius: mine ? radii.lg : 4,
        borderWidth: 1,
        padding: spacing.md,
        gap: spacing.xs,
        // An open bid wears the accent and a concluded one the success tone;
        // everything else steps back to an ordinary surface, so the live
        // offer is the one the eye lands on in a thread full of dead ones.
        borderColor: accepted
          ? colors.successBorder
          : open
            ? colors.primaryBorder
            : colors.border,
        backgroundColor: accepted
          ? colors.successSurface
          : open
            ? colors.primarySoft
            : colors.surfaceRaised,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <Ionicons
          name="pricetag-outline"
          size={12}
          color={open ? colors.primary : colors.textMuted}
        />
        <Text
          style={{
            ...type.caption,
            fontSize: 10.5,
            letterSpacing: 0.6,
            color: open ? colors.primary : colors.textMuted,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {t(isCounter ? "bids.counterTitle" : "bids.cardTitle").toUpperCase()}
        </Text>
        {open ? (
          <Text style={{ ...type.caption, color: colors.textFaint }}>
            {days <= 1 ? t("bids.lastDay") : t("bids.daysLeft", { days })}
          </Text>
        ) : null}
      </View>

      {/* A so'm bid is eleven digits at 22pt. Shrink before wrapping: the
          amount is the one thing on this card that must stay on one line. */}
      <Text
        style={{
          ...type.price,
          // A dead bid should not shout as loudly as the live one under it.
          fontSize: open ? 22 : 17,
          color: accepted ? colors.success : open ? colors.text : colors.textMuted,
          textDecorationLine: voided ? "line-through" : "none",
        }}
        numberOfLines={1}
        // Only the open card, which sets 22pt — that is where eleven digits
        // of so'm genuinely will not fit. A settled one is 17pt and has the
        // room, so it need not pay for the extra measure passes.
        adjustsFontSizeToFit={open}
        minimumFontScale={0.55}
      >
        {formatBid(bid.amount, bid.currency)}
      </Text>

      {delta !== null && delta !== 0 ? (
        <Text style={{ ...type.caption, color: colors.textFaint }}>
          {delta > 0
            ? t("bids.offBy", { percent: delta })
            : t("bids.aboveBy", { percent: -delta })}
        </Text>
      ) : null}

      {/* Status and time on one line, the way a bubble carries its own.
          A card in a thread that says nothing about WHEN is the one message
          people scroll back to and cannot place. */}
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
      >
        <Text
          style={{ ...text.caption, color: colors.textFaint, flex: 1 }}
          numberOfLines={1}
        >
          {settled
            ? t(settled)
            : mine
              ? `${t("bids.youSent")} · ${t("bids.waiting")}`
              : t("bids.waiting")}
        </Text>
        <Text style={{ ...type.caption, fontSize: 10, color: colors.textFaint }}>
          {time}
        </Text>
      </View>

      {canRespond ? (
        <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
          <View style={{ flexDirection: "row", gap: spacing.xs }}>
            <View style={{ flex: 1 }}>
              <Button
                title={t("bids.accept")}
                size="sm"
                onPress={() => onAccept(bid)}
                disabled={busy}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={t("bids.decline")}
                size="sm"
                variant="danger"
                onPress={() => onDecline(bid)}
                disabled={busy}
              />
            </View>
          </View>
          <Button
            title={t("bids.counter")}
            size="sm"
            variant="secondary"
            onPress={() => onCounter(bid)}
            disabled={busy}
          />
        </View>
      ) : null}
    </View>
  );
});
