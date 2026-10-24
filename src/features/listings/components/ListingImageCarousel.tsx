// src/features/listings/components/ListingImageCarousel.tsx
//
// The listing's photos, in one swipe.
//
// Photos only. A walkthrough film used to lead this carousel, and video has
// been taken off the listing screens entirely — clips live in the Videos
// tab, still carrying the listing they belong to.
import { memo } from "react";
import {
  FlatList,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useTheme } from "../../../theme/useTheme";
import { resolveMediaUrl } from "../../../lib/media-url";
import { ListingImage } from "../api/listings.api";

const HEIGHT = 260;

/** One slide: a photograph. */
type Slide = { kind: "image"; id: string; image: ListingImage };

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

  const slides: Slide[] = sorted.map((image) => ({
    kind: "image" as const,
    id: image.id,
    image,
  }));

  if (slides.length === 0) {
    return (
      <View
        style={{ width, height: HEIGHT, backgroundColor: colors.surface }}
      />
    );
  }

  return (
    <FlatList<Slide>
      // Keep at most the visible slide and its neighbours decoded.
      initialNumToRender={1}
      maxToRenderPerBatch={2}
      windowSize={3}
      removeClippedSubviews
      data={slides}
      keyExtractor={(item) => item.id}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      renderItem={({ item }) => (
          <Image
            source={{ uri: resolveMediaUrl(item.image.url) }}
            style={{ width, height: HEIGHT }}
            contentFit="cover"
            // "disk", NOT "memory-disk": these are full-resolution originals —
            // a handful of them in expo-image's RAM cache is exactly the kind
            // of load iOS jetsams Expo Go for. Disk cache keeps swipes fast
            // without pinning decoded megapixels in memory.
            cachePolicy="disk"
            recyclingKey={item.image.id}
            transition={150}
          />
      )}
    />
  );
});
