// The row under a card's photo: save, comment, share — the three things you
// can do about a listing without opening it.
//
// Joymee has the same three icons and no numbers beside them. A count is the
// difference between "you may comment" and "four people already have", which
// is the part that makes anyone tap.
import { memo } from "react";
import { View, Text, Pressable, Share } from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { spacing, weight } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT } from "../../../i18n";
import { requireAuth } from "../../auth/guest";
import { useIsSaved, useToggleSave } from "../hooks/useSavedListings";
import type { Listing } from "../api/listings.api";

interface Props {
  listingId: string;
  commentCount: number;
  /**
   * Distinct viewers. Its own prop rather than something read off `listing`:
   * the feed's rows carry the number without carrying the whole listing, and
   * a card that silently drops the count depending on where it is drawn is
   * how every card outside the profile ended up without one.
   */
  viewCount?: number;
  /** Present on full listings; the feed's slim rows have nothing to seed. */
  listing?: Listing;
  title?: string | null;
  compact?: boolean;
}

export const ListingCardActions = memo(function ListingCardActions({
  listingId,
  commentCount,
  viewCount,
  listing,
  title,
  compact,
}: Props) {
  const { colors, text } = useTheme();
  const t = useT();
  const isSaved = useIsSaved(listingId);
  const toggleSave = useToggleSave();

  const onShare = () => {
    void Share.share({
      title: title ?? undefined,
      message: `${title ?? t("listings.untitled")}\n${Linking.createURL(
        `/listing/${listingId}`,
      )}`,
    }).catch(() => {
      // Dismissing the sheet rejects on some platforms; not an error.
    });
  };

  const size = compact ? 17 : 19;
  // A grid tile is half a phone wide and this row has five things in it, so
  // nothing in it may be sized for the roomy case. Counts are the variable:
  // two digits on the comments and three on the views is what used to push
  // the view count off the end of the card, where `overflow: hidden` cut it
  // in half rather than wrapping it.
  const gap = compact ? spacing.sm : spacing.lg;
  const countSize = compact ? 12 : 13;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap,
        paddingHorizontal: compact ? spacing.sm : spacing.md,
        paddingVertical: compact ? 6 : spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      <Action
        icon={isSaved ? "heart" : "heart-outline"}
        tint={isSaved ? colors.danger : colors.textMuted}
        size={size}
        countSize={countSize}
        label={t(isSaved ? "saved.unsave" : "saved.save")}
        selected={isSaved}
        // Guests have no saved set — requireAuth sends them to sign in
        // rather than letting the heart fill and then forget.
        onPress={() =>
          requireAuth(() =>
            toggleSave.mutate({ listingId, listing, next: !isSaved }),
          )
        }
      />

      <Action
        icon="chatbubble-outline"
        tint={colors.textMuted}
        size={size}
        countSize={countSize}
        count={commentCount}
        label={t("comments.title")}
        // Straight into the thread. Reading is public, so no gate here —
        // the composer on that screen does its own asking.
        onPress={() => router.push(`/listing/${listingId}/comments`)}
      />

      <Action
        icon="paper-plane-outline"
        tint={colors.textMuted}
        size={size}
        countSize={countSize}
        label={t("listings.share")}
        onPress={onShare}
      />

      {/* The only flexible thing in the row: everything else is an icon
          or a number, and a number that shrinks is a number you misread. */}
      <View style={{ flex: 1, minWidth: spacing.xs }} />

      {/* Not a button: it is the one number here that nobody can change.
          Printed at zero too, unlike the comment count beside it — "nobody
          has looked yet" is a fact about a listing, where an empty thread is
          an invitation and reads better as a bare icon. */}
      {viewCount != null ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            // Never squeezed by the row: it is the last thing in it, so it
            // is the first thing the card's clipped corner would eat.
            flexShrink: 0,
          }}
          accessibilityRole="text"
          accessibilityLabel={t("listings.viewCount", { count: viewCount })}
        >
          {/* Muted rather than faint, and a point closer to the other
              glyphs: at the faint tier it was a grey smudge in the corner
              of a card that is mostly photograph. */}
          <Ionicons
            name="eye-outline"
            size={size - 2}
            color={colors.textMuted}
          />
          <Text
            style={{
              ...text.caption,
              fontSize: countSize,
              color: colors.textMuted,
            }}
            numberOfLines={1}
          >
            {viewCount}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

function Action({
  icon,
  tint,
  size,
  countSize,
  count,
  label,
  selected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  size: number;
  countSize: number;
  count?: number;
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const { text } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        flexShrink: 0,
        gap: 3,
        opacity: pressed ? 0.5 : 1,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Ionicons name={icon} size={size} color={tint} />
      {/* Zero is not worth printing — "0" beside an icon reads as a broken
          counter, and an empty thread is better shown by the plain icon. */}
      {count ? (
        <Text
          style={{
            ...text.caption,
            fontSize: countSize,
            color: tint,
            ...weight("600"),
          }}
          numberOfLines={1}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
