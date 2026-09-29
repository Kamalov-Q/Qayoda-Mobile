import { memo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import { resolveMediaUrl } from "../../lib/media-url";
import { usePriceFormatter, useSpecsFormatter } from "../listings/utils/format";
import type { MapPolygonFeature } from "../listings/api/listings.api";

interface Props {
  features: MapPolygonFeature[];
  /** Picking one hands it back to the map, which opens its preview card. */
  onSelect: (feature: MapPolygonFeature) => void;
  onClose: () => void;
}

const ROW_HEIGHT = 64;
/** Four rows and a bit, so a long stack is visibly scrollable. */
const MAX_LIST_HEIGHT = ROW_HEIGHT * 4.5;

/**
 * What is under one bubble, when a bubble stands for more than one listing.
 *
 * Two flats in the same block put their markers on the same point, where one
 * simply hides the other — the map said "2 found" and showed one pin. Tapping
 * the stack opens this instead of guessing which of them was meant.
 */
export const ListingStackSheet = memo(function ListingStackSheet({
  features,
  onSelect,
  onClose,
}: Props) {
  const { colors, text, shadow } = useTheme();
  const t = useT();
  const formatPrice = usePriceFormatter();
  const formatSpecs = useSpecsFormatter();

  return (
    <View
      style={{
        position: "absolute",
        left: spacing.md,
        right: spacing.md,
        bottom: spacing.md,
        borderRadius: radii.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        ...shadow.raised,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Ionicons name="layers-outline" size={17} color={colors.primary} />
        <Text style={{ ...text.bodyStrong, flex: 1 }} numberOfLines={1}>
          {t("map.stackCount", { count: features.length })}
        </Text>
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

      <FlatList
        data={features}
        keyExtractor={(f) => f.id}
        style={{ maxHeight: MAX_LIST_HEIGHT }}
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => onSelect(item)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              backgroundColor: pressed ? colors.surfaceRaised : "transparent",
              // Separators between rows only — a hairline above the first one
              // would double the header's border.
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.border,
            })}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radii.md,
                overflow: "hidden",
                backgroundColor: colors.surfaceRaised,
              }}
            >
              {item.thumbUrl ? (
                <Image
                  source={{ uri: resolveMediaUrl(item.thumbUrl) }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : null}
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ ...type.bodyStrong, color: colors.text }}>
                {formatPrice(item.price, item.currency)}
              </Text>
              <Text style={text.caption} numberOfLines={1}>
                {item.title ?? t("listings.untitled")}
              </Text>
              {formatSpecs(item) ? (
                <Text
                  style={{ ...type.caption, color: colors.textFaint }}
                  numberOfLines={1}
                >
                  {formatSpecs(item)}
                </Text>
              ) : null}
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textFaint}
            />
          </Pressable>
        )}
      />
    </View>
  );
});
