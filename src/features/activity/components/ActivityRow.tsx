// One row of "your activity": the listing it happened on, and what you did
// there. The listing is the anchor — a comment on its own gives no clue which
// of forty adverts it was about.
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { resolveMediaUrl } from "@/src/lib/media-url";
import { Stars } from "@/src/features/reviews/components/Stars";
import { useCommentTime } from "@/src/features/comments/utils/time";
import type { ActivityListing } from "../api/activity.api";

interface Props {
  listing: ActivityListing | null;
  /** What was said — the comment body or the review text. */
  body: string | null;
  createdAt: string;
  /** Reviews show their stars where a comment shows nothing. */
  rating?: number;
  /** A small trailing glyph: a heart for a like, a reply arrow for a reply. */
  badge?: keyof typeof Ionicons.glyphMap;
  /** Photo on the comment itself, not the listing's cover. */
  imageThumbUrl?: string | null;
}

export function ActivityRow({
  listing,
  body,
  createdAt,
  rating,
  badge,
  imageThumbUrl,
}: Props) {
  const { colors, text } = useTheme();
  const t = useT();
  const timeAgo = useCommentTime();

  const cover = resolveMediaUrl(imageThumbUrl ?? listing?.thumbUrl);

  return (
    <Pressable
      // A deleted listing leaves its comments behind; the row stays readable
      // but stops pretending to go anywhere.
      onPress={() => listing && router.push(`/listing/${listing.id}`)}
      disabled={!listing}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
      })}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radii.md,
          overflow: "hidden",
          backgroundColor: colors.surfaceRaised,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <Ionicons name="home-outline" size={18} color={colors.textFaint} />
        )}
      </View>

      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
        >
          <Text style={{ ...text.bodyStrong, flex: 1 }} numberOfLines={1}>
            {listing?.title ?? t("listings.untitled")}
          </Text>
          {badge ? (
            <Ionicons name={badge} size={14} color={colors.textFaint} />
          ) : null}
        </View>

        {rating !== undefined ? <Stars value={rating} size={12} /> : null}

        {body ? (
          <Text style={text.caption} numberOfLines={2}>
            {body}
          </Text>
        ) : imageThumbUrl ? (
          <Text style={{ ...text.caption, fontStyle: "italic" }}>
            {t("activity.photoOnly")}
          </Text>
        ) : null}

        <Text style={{ ...text.caption, color: colors.textFaint }}>
          {timeAgo(createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}
