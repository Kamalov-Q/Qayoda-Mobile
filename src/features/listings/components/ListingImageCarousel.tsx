// src/features/listings/components/ListingImageCarousel.tsx
import { memo } from "react";
import { FlatList, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "../../../theme/useTheme";
import { resolveMediaUrl } from "../../../lib/media-url";
import { ListingImage } from "../api/listings.api";

export const ListingImageCarousel = memo(function ListingImageCarousel({
  images,
}: {
  images: ListingImage[];
}) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  // Primary first, then by position — the primary image is what every list
  // shows, so the detail screen should open on the same photo.
  const sorted = [...images].sort(
    (a, b) =>
      Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position,
  );

  if (sorted.length === 0) {
    return (
      <View style={{ width, height: 260, backgroundColor: colors.surface }} />
    );
  }

  return (
    <FlatList
      data={sorted}
      keyExtractor={(item) => item.id}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      renderItem={({ item }) => (
        <Image
          source={{ uri: resolveMediaUrl(item.url) }}
          style={{ width, height: 260 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
        />
      )}
    />
  );
});
