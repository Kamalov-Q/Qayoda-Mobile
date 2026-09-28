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
import { spacing } from "../../../theme/tokens";
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

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? spacing.md : spacing.lg,
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
        label={t("listings.share")}
        onPress={onShare}
      />

      <View style={{ flex: 1 }} />

      {/* Not a button: it is the one number here that nobody can change.
          Printed at zero too, unlike the comment count beside it — "nobody
          has looked yet" is a fact about a listing, where an empty thread is
          an invitation and reads better as a bare icon. */}
      {viewCount != null ? (
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
          accessibilityRole="text"
          accessibilityLabel={t("listings.viewCount", { count: viewCount })}
        >
          <Ionicons
            name="eye-outline"
            size={size - 3}
            color={colors.textFaint}
          />
          <Text style={{ ...text.caption, color: colors.textFaint }}>
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
  count,
  label,
  selected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  size: number;
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
        gap: 4,
        opacity: pressed ? 0.5 : 1,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Ionicons name={icon} size={size} color={tint} />
      {/* Zero is not worth printing — "0" beside an icon reads as a broken
          counter, and an empty thread is better shown by the plain icon. */}
      {count ? (
        <Text style={{ ...text.caption, color: tint, fontWeight: "600" }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
