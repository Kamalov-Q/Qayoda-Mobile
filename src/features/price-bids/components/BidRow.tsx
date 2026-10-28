// src/features/price-bids/components/BidRow.tsx
//
// One negotiation, in the list of all of them.
//
// Deliberately not the chat card. In a thread the card is the live control —
// it carries Accept, Decline and Counter, because the thread is where the
// answer belongs. This list is an index: it says what was offered, on what,
// which way round, and whether anything is still waiting on you. Pressing it
// takes you to the thread, which is the only place an offer can be answered,
// so the buttons are not duplicated here where a mis-tap on a scrolling list
// would agree a price.
import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, type } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT, type TranslationKey } from "@/src/i18n";
import {
  canRespondTo,
  isBidOpen,
  type MyPriceBid,
  type PriceBidStatus,
} from "../api/price-bids.api";
import { formatBid } from "./BidSheet";

const STATUS_LABEL: Record<PriceBidStatus, TranslationKey> = {
  PENDING: "bids.waiting",
  ACCEPTED: "bids.statusAccepted",
  DECLINED: "bids.statusDeclined",
  COUNTERED: "bids.statusCountered",
  WITHDRAWN: "bids.statusWithdrawn",
  EXPIRED: "bids.statusExpired",
};

interface Props {
  bid: MyPriceBid;
  /** The signed-in reader — decides which way round the row reads. */
  viewerId: string | undefined;
}

export const BidRow = memo(function BidRow({ bid, viewerId }: Props) {
  const { colors, text } = useTheme();
  const t = useT();

  const open = isBidOpen(bid);
  // Whether the ball is in your court. The one thing worth picking out of a
  // long list, so it gets the only accent on the row.
  const yours = canRespondTo(bid, viewerId);
  const iAmBidder = bid.bidderId === viewerId;
  // Either way the advert is off the map and the offer cannot be answered,
  // but "sold" is the more useful of the two things to be told.
  const sold = bid.listing?.status === "SOLD";
  const gone = sold || bid.listing?.status === "ARCHIVED";

  return (
    <Pressable
      // The thread, not the listing: that is where it can be answered, and
      // the whole exchange is readable in order there. Only when the bid
      // never got a thread (it always should) does the listing stand in.
      onPress={() =>
        router.push(
          bid.conversationId
            ? `/chat/${bid.conversationId}`
            : `/listing/${bid.listingId}`,
        )
      }
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: yours ? colors.primaryBorder : colors.border,
        backgroundColor: pressed
          ? colors.surfaceRaised
          : yours
            ? colors.primarySoft
            : colors.surface,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radii.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: open ? colors.primarySoft : colors.surfaceRaised,
        }}
      >
        <Ionicons
          // Which way the number travelled, at a glance.
          name={iAmBidder ? "arrow-up-outline" : "arrow-down-outline"}
          size={18}
          color={open ? colors.primary : colors.textMuted}
        />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text style={text.bodyStrong} numberOfLines={1}>
          {bid.listing?.title ?? t("listings.untitled")}
        </Text>
        <Text style={text.caption} numberOfLines={1}>
          {t(iAmBidder ? "bids.rowYouOffered" : "bids.rowTheyOffered")}
          {" · "}
          {t(STATUS_LABEL[bid.status])}
          {gone
            ? ` · ${t(sold ? "bids.rowListingSold" : "bids.rowListingGone")}`
            : ""}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Text
          style={{
            ...type.bodyStrong,
            color: open ? colors.text : colors.textMuted,
            textDecorationLine: open ? "none" : "line-through",
          }}
          numberOfLines={1}
        >
          {formatBid(bid.amount, bid.currency)}
        </Text>
        {yours ? (
          <Text style={{ ...type.caption, color: colors.primary }}>
            {t("bids.rowNeedsYou")}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});
