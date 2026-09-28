import { memo, useMemo } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, sizing, spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import { Avatar } from "../../components/ui";
import { useListing } from "../listings/hooks/useListing";
import { useListingLive } from "../listings/hooks/useListingLive";
import { ListingPhotoSlider } from "../listings/components/ListingPhotoSlider";
import { ListingCardActions } from "../listings/components/ListingCardActions";
import { RatingPill } from "../reviews/components/RatingPill";
import {
  usePriceFormatter,
  useSpecsFormatter,
  htmlToText,
} from "../listings/utils/format";
import type { MapPolygonFeature } from "../listings/api/listings.api";

interface Props {
  /** What the map already knows — enough to paint the card immediately. */
  feature: MapPolygonFeature;
  onOpen: (listingId: string) => void;
  onClose: () => void;
  /** Room to leave beneath, for whatever else floats over the map. */
  bottomInset: number;
}

/**
 * Tall enough to be the photo of a home, short enough that the card still
 * leaves map above it on a small phone. The card runs about 360pt in all,
 * which is what the bottom strip of the map can give up.
 */
const PHOTO_HEIGHT = 150;

/**
 * The card a tap on the map opens.
 *
 * It paints from the map feature the instant it is tapped — price, title,
 * cover photo — and fills in the rest (every photo, the seller, the words
 * they wrote) as the listing itself arrives. That fetch is not wasted: it
 * uses the same query key the detail page reads, so opening the listing from
 * here is instant.
 *
 * Positioned over the map rather than presented as a modal, so the map above
 * it stays live: this is a card ABOUT a place you are looking at, and losing
 * sight of the place to read it would be a strange trade.
 */
export const ListingPreviewSheet = memo(function ListingPreviewSheet({
  feature,
  onOpen,
  onClose,
  bottomInset,
}: Props) {
  const { colors, text, shadow } = useTheme();
  const t = useT();
  const formatPrice = usePriceFormatter();
  const formatSpecs = useSpecsFormatter();

  const { data: listing } = useListing(feature.id);
  // Live while the card is open — someone else's comment or an upheld report
  // moves these numbers too. `recordView: false`: a glance at a card on the
  // map is not a visit, and the listing page records that itself.
  useListingLive(feature.id, { recordView: false });

  // Cover first, then the rest in their stored order — and the map's own
  // thumbnail until they arrive, so the photo area is never empty.
  const photos = useMemo(() => {
    const images = listing?.images ?? [];
    if (!images.length) return [{ thumbUrl: feature.thumbUrl }];
    const primary = images.find((i) => i.isPrimary) ?? images[0];
    return [primary, ...images.filter((i) => i.id !== primary.id)];
  }, [listing?.images, feature.thumbUrl]);

  const open = () => onOpen(feature.id);

  const owner = listing?.owner;
  const ownerName =
    [owner?.name, owner?.surname].filter(Boolean).join(" ") || null;

  const phone = listing?.contactPhone;
  const blurb =
    htmlToText(listing?.descriptionHtml) ||
    listing?.descriptionText?.trim() ||
    "";
  const specs = formatSpecs(feature);

  return (
    <View
      style={{
        position: "absolute",
        left: spacing.md,
        right: spacing.md,
        bottom: spacing.md + bottomInset,
        borderRadius: radii.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        ...shadow.raised,
      }}
    >
      {/* Seller and the way out, on one line above the photo — the two things
          that are about the card rather than about the listing. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xs,
        }}
      >
        <Avatar
          uri={owner?.avatarThumbUrl ?? owner?.avatarUrl ?? null}
          name={ownerName}
          size={28}
        />
        <Text style={{ ...text.bodyStrong, flex: 1 }} numberOfLines={1}>
          {ownerName ?? t("listings.seller")}
        </Text>
        {owner?.isVerifiedRealtor ? (
          <Ionicons name="shield-checkmark" size={15} color={colors.primary} />
        ) : null}
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          style={({ pressed }) => ({
            width: 28,
            height: 28,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surfaceRaised : "transparent",
          })}
        >
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={{ height: PHOTO_HEIGHT }}>
        <ListingPhotoSlider
          photos={photos}
          height={PHOTO_HEIGHT}
          onPress={open}
        />
        {listing ? (
          <View
            style={{ position: "absolute", right: spacing.sm, top: spacing.sm }}
          >
            <RatingPill
              average={listing.ratingAvg}
              count={listing.ratingCount}
              onPhoto
            />
          </View>
        ) : null}
      </View>

      {/* Everything readable is one target: the card opens the listing. */}
      <Pressable
        onPress={open}
        accessibilityRole="button"
        style={({ pressed }) => ({
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          gap: 2,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ ...type.heading, fontSize: 19, color: colors.text }}>
          {formatPrice(feature.price, feature.currency)}
        </Text>
        <Text style={text.bodyStrong} numberOfLines={1}>
          {feature.title ?? t("listings.untitled")}
        </Text>
        {specs ? (
          <Text style={text.caption} numberOfLines={1}>
            {specs}
          </Text>
        ) : null}
        {blurb ? (
          <Text
            style={{ ...text.caption, color: colors.textMuted }}
            numberOfLines={2}
          >
            {blurb}
          </Text>
        ) : null}
      </Pressable>

      {/* The same row every card carries, so a save made here is the same
          save made anywhere else. */}
      {listing ? (
        <ListingCardActions
          listingId={listing.id}
          commentCount={listing.commentCount}
          viewCount={listing.viewCount}
          listing={listing}
          title={listing.title}
          compact
        />
      ) : null}

      <View
        style={{
          flexDirection: "row",
          gap: spacing.sm,
          padding: spacing.md,
          paddingTop: spacing.sm,
        }}
      >
        {phone ? (
          <SheetButton
            icon="call-outline"
            label={t("userProfile.call")}
            // Swallowed: a device with no dialer would otherwise crash the
            // screen on a tap.
            onPress={() =>
              Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`).catch(
                () => {},
              )
            }
          />
        ) : null}
        <SheetButton
          icon="arrow-forward"
          label={t("listings.detailsTitle")}
          primary
          onPress={open}
        />
      </View>
    </View>
  );
});

/** The pair at the foot of the card. Equal halves, or one full-width when the
 *  seller left no number to ring. */
function SheetButton({
  icon,
  label,
  primary,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        height: sizing.controlMd,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        borderRadius: radii.pill,
        borderWidth: primary ? 0 : 1,
        borderColor: colors.border,
        backgroundColor: primary
          ? pressed
            ? colors.primaryPressed
            : colors.primary
          : pressed
            ? colors.surfaceRaised
            : colors.surface,
      })}
    >
      <Ionicons
        name={icon}
        size={17}
        color={primary ? colors.onPrimary : colors.text}
      />
      <Text
        style={{
          ...type.bodyStrong,
          fontSize: 14,
          color: primary ? colors.onPrimary : colors.text,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
