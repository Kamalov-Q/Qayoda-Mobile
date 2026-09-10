// "More like this" under a listing: same category, nearest first. The strip
// is a bonus — it renders nothing while loading, empty, or on error.
import { View, Text, FlatList } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { spacing } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT } from "../../../i18n";
import { listingApi, type Listing, type OfferPurpose } from "../api/listings.api";
import { usePriceFormatter, useSpecsFormatter } from "../utils/format";
import { ListingGridCard } from "./ListingGridCard";

const CARD_WIDTH = 190;

export function SimilarListings({
  listingId,
  purpose,
}: {
  listingId: string;
  purpose: OfferPurpose;
}) {
  const { text } = useTheme();
  const t = useT();
  const formatPrice = usePriceFormatter();
  const formatSpecs = useSpecsFormatter();

  const { data } = useQuery({
    queryKey: ["listings", "similar", listingId] as const,
    queryFn: () => listingApi.getSimilar(listingId),
    staleTime: 60_000,
  });

  if (!data?.length) return null;

  const priceOf = (l: Listing) => {
    const offer =
      l.offers.find((o) => o.purpose === purpose && o.isActive) ??
      l.offers.find((o) => o.isActive) ??
      l.offers[0];
    return offer ? formatPrice(offer.price, offer.currency, offer.purpose) : null;
  };
  const thumbOf = (l: Listing) =>
    (l.images.find((i) => i.isPrimary) ?? l.images[0])?.thumbUrl ?? null;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={text.label}>{t("listings.similarTitle")}</Text>
      <FlatList
        data={data}
        keyExtractor={(l) => l.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -spacing.lg }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
        }}
        renderItem={({ item }) => (
          <View style={{ width: CARD_WIDTH }}>
            <ListingGridCard
              thumbUrl={thumbOf(item)}
              price={priceOf(item)}
              title={item.title}
              specs={formatSpecs(item) || null}
              meta={item.address}
              // push, not replace: reading a chain of similar listings should
              // unwind with back, one by one.
              onPress={() => router.push(`/listing/${item.id}`)}
            />
          </View>
        )}
      />
    </View>
  );
}
