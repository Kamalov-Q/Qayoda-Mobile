// src/features/listings/components/ListingCard.tsx
import { memo, useMemo } from "react";
import { Text, View } from "react-native";
import { spacing, radii, type } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT } from "../../../i18n";
import { Listing, OfferPurpose } from "../api/listings.api";
import { usePriceFormatter, useSpecsFormatter } from "../utils/format";
import { primaryOffer } from "../utils/offers";
import { ListingCardBase } from "./ListingCardBase";
import { ListingGridCard } from "./ListingGridCard";

/**
 * Where the card is being drawn, which is all a caller should have to say:
 *
 * - `list` — the full-width card, one per row.
 * - `grid` — the half-width tile, two per row.
 * - `rail` — a tile in a horizontal side-scroller, which also decides who
 *   owns a sideways drag (see ListingGridCard).
 */
export type ListingCardVariant = "list" | "grid" | "rail";

interface Props {
  listing: Listing;
  variant?: ListingCardVariant;
  /** Faint third line, e.g. the address. Omitted, the line is not drawn. */
  meta?: string | null;
  /**
   * Which price to show on a listing carrying more than one offer. The screen
   * knows the context the reader is in; the listing does not.
   */
  preferPurpose?: OfferPurpose;
  onPress: (id: string) => void;
}

/**
 * A full `Listing` on the shared card — "my listings", saved, the ads on
 * someone's profile, and the "more like this" strip.
 *
 * The one place a whole listing is mapped onto a card, in either shape: cover
 * photo first, the price of the offer that matters here, stars, and the row
 * of things you can do about it. The feed puts its slimmer map features
 * straight onto the same two bases.
 */
export const ListingCard = memo(function ListingCard({
  listing,
  variant = "list",
  meta,
  preferPurpose,
  onPress,
}: Props) {
  const formatSpecs = useSpecsFormatter();
  const formatPrice = usePriceFormatter();

  const primary = listing.images.find((i) => i.isPrimary) ?? listing.images[0];
  const ordered = useMemo(
    () =>
      primary
        ? [primary, ...listing.images.filter((i) => i.id !== primary.id)]
        : listing.images,
    [listing.images, primary],
  );
  const offer = primaryOffer(listing, preferPurpose);
  const specs = formatSpecs(listing);

  const props = {
    thumbUrl: primary?.thumbUrl ?? null,
    // Primary first, then the rest in their stored order — the cover is the
    // photo the seller chose, and it should stay the first frame.
    photos: ordered,
    price: offer
      ? formatPrice(offer.price, offer.currency, offer.purpose)
      : null,
    title: listing.title,
    specs: specs || null,
    meta,
    rating: { average: listing.ratingAvg, count: listing.ratingCount },
    actions: {
      listingId: listing.id,
      commentCount: listing.commentCount,
      viewCount: listing.viewCount,
      // The whole listing, so saving from here can seed the Saved tab
      // instead of waiting for a refetch.
      listing,
    },
    // Draft and archived listings are only reachable from "my listings",
    // where they sit next to live ones — without this the card gives no hint
    // that it is not on the map.
    overlay:
      listing.status !== "ACTIVE" ? (
        <StatusBadge status={listing.status} />
      ) : null,
    onPress: () => onPress(listing.id),
  };

  return variant === "list" ? (
    <ListingCardBase {...props} />
  ) : (
    <ListingGridCard {...props} rail={variant === "rail"} />
  );
});

const StatusBadge = memo(function StatusBadge({
  status,
}: {
  status: Listing["status"];
}) {
  const { colors } = useTheme();
  const t = useT();

  return (
    <View
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radii.pill,
        backgroundColor: colors.imageScrim,
      }}
    >
      <Text style={{ ...type.label, color: "#FFFFFF" }}>
        {t(`statuses.${status}`)}
      </Text>
    </View>
  );
});
