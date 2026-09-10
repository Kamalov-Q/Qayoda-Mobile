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
      // Keep at most the visible photo and its neighbours decoded.
      initialNumToRender={1}
      maxToRenderPerBatch={2}
      windowSize={3}
      removeClippedSubviews
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
          // "disk", NOT "memory-disk": these are full-resolution originals —
          // a handful of them in expo-image's RAM cache is exactly the kind
          // of load iOS jetsams Expo Go for. Disk cache keeps swipes fast
          // without pinning decoded megapixels in memory.
          cachePolicy="disk"
          recyclingKey={item.id}
          transition={150}
        />
      )}
    />
  );
});
