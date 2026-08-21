// src/features/listings/components/ListingCard.tsx
import { memo } from "react";
import { Text, View } from "react-native";
import { spacing, radii, type } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT } from "../../../i18n";
import { Listing } from "../api/listings.api";
import { usePriceFormatter, useSpecsFormatter } from "../utils/format";
import { primaryOffer } from "../utils/offers";
import { ListingCardBase } from "./ListingCardBase";

interface Props {
  listing: Listing;
  onPress: (id: string) => void;
}

/** A full `Listing` on the shared card — "my listings", saved, and the ads on
 *  someone's profile. The feed puts its slimmer map features on the same base. */
export const ListingCard = memo(function ListingCard({
  listing,
  onPress,
}: Props) {
  const formatSpecs = useSpecsFormatter();
  const formatPrice = usePriceFormatter();

  const primary = listing.images.find((i) => i.isPrimary) ?? listing.images[0];
  const offer = primaryOffer(listing);
  const specs = formatSpecs(listing);

  return (
    <ListingCardBase
      thumbUrl={primary?.thumbUrl ?? null}
      price={
        offer ? formatPrice(offer.price, offer.currency, offer.purpose) : null
      }
      title={listing.title}
      specs={specs || null}
      onPress={() => onPress(listing.id)}
      // Draft and archived listings are only reachable from "my listings",
      // where they sit next to live ones — without this the card gives no hint
      // that it is not on the map.
      overlay={
        listing.status !== "ACTIVE" ? (
          <StatusBadge status={listing.status} />
        ) : null
      }
    />
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
