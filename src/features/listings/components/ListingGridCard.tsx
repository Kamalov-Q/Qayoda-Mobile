import { memo, type ReactNode } from "react";
import { Text, View, Pressable } from "react-native";
import { spacing, radii, type } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { ListingPhotoSlider, type SliderPhoto } from "./ListingPhotoSlider";
import { ListingCardActions } from "./ListingCardActions";
import type { Listing } from "../api/listings.api";
import { RatingPill } from "../../reviews/components/RatingPill";

interface Props {
  thumbUrl: string | null | undefined;
  /** Every photo, for the slider. */
  photos?: SliderPhoto[];
  /** Preformatted — currency symbol and any /month suffix already applied. */
  price: string | null;
  title: string | null;
  /** The "80 m² · 3 xona" line, or null when nothing is known. */
  specs: string | null;
  /** Faint second line — "Chilonzor · 5 kun oldin". */
  meta?: string | null;
  /** Top-right of the photo — the save heart. */
  overlay?: ReactNode;
  /** Stars for the photo's bottom-right. Omitted, or unrated, draws nothing. */
  rating?: { average: number | null; count: number } | null;
  /** Save / comment / share under the card. Omitted, the row is not drawn. */
  actions?: {
    listingId: string;
    commentCount: number;
    viewCount?: number;
    listing?: Listing;
  };
  /**
   * The tile is in a horizontal rail rather than a grid. The photos then get
   * arrows and give up the swipe — two nested pagers cannot share a drag.
   */
  rail?: boolean;
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
  photos,
  price,
  title,
  specs,
  meta,
  overlay,
  rating,
  actions,
  rail,
  onPress,
}: Props) {
  const { colors, text, shadow } = useTheme();

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
        {/* `compact`: no arrows at half width — there is no room for them and
            a thumb reaches the edge of a grid tile anyway. In a rail it is
            the other way round: the drag belongs to the rail, so the arrows
            are the only way through the photos and they earn their space. */}
        <ListingPhotoSlider
          photos={photos?.length ? photos : [{ thumbUrl }]}
          height={PHOTO_HEIGHT}
          onPress={onPress}
          compact={!rail}
          swipeable={!rail}
        />

        {overlay ? (
          <View
            style={{ position: "absolute", top: spacing.sm, right: spacing.sm }}
          >
            {overlay}
          </View>
        ) : null}

        {/* Top-LEFT at grid width, not opposite the price the way the full
            card does it: half a card is narrow enough that a long price and a
            rating sharing the bottom row would collide. */}
        {rating ? (
          <View
            style={{ position: "absolute", left: spacing.sm, top: spacing.sm }}
          >
            <RatingPill average={rating.average} count={rating.count} onPhoto />
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
        <View
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            gap: 2,
          }}
        >
          {title ? (
            <Text
              style={{ ...text.bodyStrong, fontSize: 14 }}
              numberOfLines={1}
            >
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

      {/* Last, under everything: the card is a thing to read, and the row of
          things to do about it belongs after you have read it. */}
      {actions ? (
        <ListingCardActions
          listingId={actions.listingId}
          commentCount={actions.commentCount}
          viewCount={actions.viewCount}
          listing={actions.listing}
          title={title}
          compact={true}
        />
      ) : null}
    </Pressable>
  );
});
