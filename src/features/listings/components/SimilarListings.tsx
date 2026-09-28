// "More like this" under a listing: same category, nearest first. The strip
// is a bonus — it renders nothing while loading, empty, or on error.
import { useCallback } from "react";
import { View, Text, FlatList } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { spacing } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT } from "../../../i18n";
import {
  listingApi,
  type Listing,
  type OfferPurpose,
} from "../api/listings.api";
import { ListingCard } from "./ListingCard";

/**
 * Wider than a grid tile (~175pt on a normal phone) by just enough that the
 * next card peeks in from the edge — which is the whole reason a side-scroller
 * reads as scrollable without an arrow telling you so.
 */
const CARD_WIDTH = 200;

export function SimilarListings({
  listingId,
  purpose,
}: {
  listingId: string;
  purpose: OfferPurpose;
}) {
  const { text } = useTheme();
  const t = useT();

  const { data } = useQuery({
    queryKey: ["listings", "similar", listingId] as const,
    queryFn: () => listingApi.getSimilar(listingId),
    staleTime: 60_000,
  });

  // push, not replace: reading a chain of similar listings should unwind with
  // back, one by one.
  const open = useCallback((id: string) => router.push(`/listing/${id}`), []);

  if (!data?.length) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={text.label}>{t("listings.similarTitle")}</Text>
      <FlatList<Listing>
        data={data}
        keyExtractor={(l) => l.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -spacing.lg }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          // The cards cast a shadow and the save heart sits proud of the top
          // corner; without the padding the row clips both.
          paddingVertical: spacing.xs,
        }}
        renderItem={({ item }) => (
          <View style={{ width: CARD_WIDTH }}>
            {/* The same card as the feed's grid, from the same mapping — the
                photo slider, the stars and the save/comment/share row come
                with it rather than being rebuilt here. */}
            <ListingCard
              listing={item}
              variant="rail"
              meta={item.address}
              // The reader is looking at a listing of this purpose, so a
              // neighbour that is both for sale and to let should answer with
              // the price that compares.
              preferPurpose={purpose}
              onPress={open}
            />
          </View>
        )}
      />
    </View>
  );
}
