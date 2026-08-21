import { memo, type ReactNode } from "react";
import { Text, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, type } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { resolveMediaUrl } from "../../../lib/media-url";

interface Props {
  thumbUrl: string | null | undefined;
  /** Preformatted — currency symbol and any /month suffix already applied. */
  price: string | null;
  title: string | null;
  /** The "80 m² · 3 xona" line, or null when nothing is known. */
  specs: string | null;
  /** Sits at the photo's top-right: a status badge, a save toggle. */
  overlay?: ReactNode;
  onPress: () => void;
}

/** Photo height. Tall enough that the photo is the card rather than an
 *  illustration of it — which is what makes a card work when the price is the
 *  only other thing known about the listing. */
const PHOTO_HEIGHT = 200;

/**
 * The listing card, once. The feed had its own — a 132pt thumbnail beside a
 * mostly-empty text column, which at the zoom levels where the API returns
 * bare points (no title, no specs) was two thirds dead space and the same
 * "untitled" line repeated down the screen.
 *
 * Presentational on purpose: the feed and the saved/profile lists come from
 * different endpoints with different shapes, and the thing they should share
 * is the look, not a data model.
 */
export const ListingCardBase = memo(function ListingCardBase({
  thumbUrl,
  price,
  title,
  specs,
  overlay,
  onPress,
}: Props) {
  const { colors, text, shadow } = useTheme();
  const image = resolveMediaUrl(thumbUrl);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
        // A subtle press-down beats a colour flash on a card this large.
        transform: [{ scale: pressed ? 0.985 : 1 }],
        ...shadow.card,
      })}
    >
      <View style={{ height: PHOTO_HEIGHT, backgroundColor: colors.surfaceRaised }}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="image-outline" size={30} color={colors.textFaint} />
          </View>
        )}

        {overlay ? (
          <View
            style={{ position: "absolute", top: spacing.md, right: spacing.md }}
          >
            {overlay}
          </View>
        ) : null}

        {/* Price rides on the photo rather than sitting in the body: it is the
            one value people scan a feed for, and it costs no vertical space
            here. The scrim keeps it legible over a bright image. */}
        {price ? (
          <View
            style={{
              position: "absolute",
              left: spacing.md,
              bottom: spacing.md,
              paddingHorizontal: spacing.md,
              paddingVertical: 7,
              borderRadius: radii.pill,
              backgroundColor: colors.imageScrim,
            }}
          >
            <Text style={{ ...type.heading, fontSize: 17, color: "#FFFFFF" }}>
              {price}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Dropped entirely when neither is known, instead of printing a row of
          identical "untitled" placeholders down the feed. A photo with a price
          on it is already a complete card. */}
      {title || specs ? (
        <View style={{ padding: spacing.md, gap: spacing.xs }}>
          {title ? (
            <Text style={text.heading} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {specs ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <Ionicons name="resize-outline" size={14} color={colors.textFaint} />
              <Text style={text.caption} numberOfLines={1}>
                {specs}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
});
