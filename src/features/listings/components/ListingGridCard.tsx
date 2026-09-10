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
  /** Faint second line — "Chilonzor · 5 kun oldin". */
  meta?: string | null;
  /** Top-right of the photo — the save heart. */
  overlay?: ReactNode;
  onPress: () => void;
}

/** Taller than a strict half-card: at grid width the photo is the card, and a
 *  squat one reads as a thumbnail in a table rather than a listing. */
const PHOTO_HEIGHT = 148;

/**
 * The two-column sibling of ListingCardBase — deliberately the SAME design
 * language at half width: photo-first, price on a scrim pill riding the
 * photo (which also keeps it legible in both themes — a bare Text here
 * rendered near-black on the dark ground), title and specs underneath.
 */
export const ListingGridCard = memo(function ListingGridCard({
  thumbUrl,
  price,
  title,
  specs,
  meta,
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
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        ...shadow.card,
      })}
    >
      <View
        style={{ height: PHOTO_HEIGHT, backgroundColor: colors.surfaceRaised }}
      >
        {image ? (
          <Image
            source={{ uri: image }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
        ) : (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="image-outline" size={26} color={colors.textFaint} />
          </View>
        )}

        {overlay ? (
          <View
            style={{ position: "absolute", top: spacing.sm, right: spacing.sm }}
          >
            {overlay}
          </View>
        ) : null}

        {price ? (
          <View
            style={{
              position: "absolute",
              left: spacing.sm,
              bottom: spacing.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: 5,
              borderRadius: radii.pill,
              backgroundColor: colors.imageScrim,
            }}
          >
            <Text
              style={{ ...type.bodyStrong, fontSize: 14, color: "#FFFFFF" }}
              numberOfLines={1}
            >
              {price}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Collapses entirely for point-mode items that carry only a price —
          a photo with a price pill is already a complete card. */}
      {title || specs || meta ? (
        <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: 2 }}>
          {title ? (
            <Text style={{ ...text.bodyStrong, fontSize: 14 }} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {specs ? (
            <Text
              style={{ ...type.caption, color: colors.textMuted }}
              numberOfLines={1}
            >
              {specs}
            </Text>
          ) : null}
          {meta ? (
            <Text
              style={{ ...type.caption, color: colors.textFaint }}
              numberOfLines={1}
            >
              {meta}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
});
