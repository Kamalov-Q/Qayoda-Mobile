// src/features/listings/components/ListingCard.tsx
import { memo } from "react";
import { Text, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, type } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT } from "../../../i18n";
import { resolveMediaUrl } from "../../../lib/media-url";
import { Listing } from "../api/listings.api";
import { usePriceFormatter, useSpecsFormatter } from "../utils/format";
import { primaryOffer } from "../utils/offers";

interface Props {
  listing: Listing;
  onPress: (id: string) => void;
}

export const ListingCard = memo(function ListingCard({
  listing,
  onPress,
}: Props) {
  const { colors, text, shadow } = useTheme();
  const t = useT();
  const formatSpecs = useSpecsFormatter();
  const formatPrice = usePriceFormatter();

  const primary = listing.images.find((i) => i.isPrimary) ?? listing.images[0];
  const offer = primaryOffer(listing);
  const specs = formatSpecs(listing);

  return (
    <Pressable
      onPress={() => onPress(listing.id)}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
        // A subtle press-down beats a colour flash on a card this large.
        transform: [{ scale: pressed ? 0.985 : 1 }],
        ...shadow.card,
      })}
    >
      <View style={{ height: 200, backgroundColor: colors.surfaceRaised }}>
        {primary ? (
          <Image
            source={{ uri: resolveMediaUrl(primary.thumbUrl) }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="image-outline" size={30} color={colors.textFaint} />
          </View>
        )}

        {/* Draft and archived listings are only reachable from "my listings",
            where they sit next to live ones — without this the row gives no
            hint that it is not on the map. */}
        {listing.status !== "ACTIVE" ? (
          <View
            style={{
              position: "absolute",
              top: spacing.md,
              right: spacing.md,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
              borderRadius: radii.pill,
              backgroundColor: colors.imageScrim,
            }}
          >
            <Text style={{ ...type.label, color: "#FFFFFF" }}>
              {t(`statuses.${listing.status}`)}
            </Text>
          </View>
        ) : null}

        {/* Price rides on the photo rather than sitting in the body: it is the
            one value people scan a feed for, and it costs no vertical space
            here. The scrim keeps it legible over a bright image. */}
        {offer ? (
          <View
            style={{
              position: "absolute",
              left: spacing.md,
              bottom: spacing.md,
              paddingHorizontal: spacing.md,
              paddingVertical: 7,
              borderRadius: radii.pill,
              backgroundColor: colors.imageScrim,
            }}
          >
            <Text style={{ ...type.heading, fontSize: 17, color: "#FFFFFF" }}>
              {formatPrice(offer.price, offer.currency, offer.purpose)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ padding: spacing.md, gap: spacing.xs }}>
        <Text style={text.heading} numberOfLines={1}>
          {listing.title ?? t("listings.untitled")}
        </Text>
        {specs ? (
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
          >
            <Ionicons name="resize-outline" size={14} color={colors.textFaint} />
            <Text style={text.caption} numberOfLines={1}>
              {specs}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});
