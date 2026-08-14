// app/(tabs)/sotuv.tsx
import { memo, useCallback, useMemo, useState } from "react";
import {
  Text,
  View,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  EmptyState,
  Section,
  ChipGroup,
  FilterSheet,
  FilterButton,
  PriceRangeFilter,
  TextField,
  TAB_EDGES,
} from "../../src/components/ui";
import { spacing, radii, sizing } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";
import { resolveMediaUrl } from "../../src/lib/media-url";
import {
  MapPointFeature,
  MapPolygonFeature,
  OfferPurpose,
  ViewportResponse,
} from "../../src/features/listings/api/listings.api";
import { useDebouncedValue } from "../../src/lib/use-debounced-value";
import { useMapViewport } from "../../src/features/listings/hooks/useMapViewport";
import {
  useIsSaved,
  useToggleSave,
} from "../../src/features/listings/hooks/useSavedListings";
import { useAuthStore } from "../../src/features/auth/store/auth.store";
import { usePriceFormatter } from "../../src/features/listings/utils/format";
import { ListingsMap } from "../../src/features/map/ListingsMap";

// Enough map to place yourself in the city without the feed losing its own
// first row — the list is still the thing people scroll here.
const MAP_HEIGHT = 260;

// Feed driven by the viewport endpoint until a search endpoint exists.
// Normalize both feature shapes into one row model.
interface FeedItem {
  id: string;
  price: string;
  currency: string;
  thumbUrl: string | null;
}

// Purpose is the one filter the API itself understands, so it re-queries;
// sorting is applied to whatever came back.
const PURPOSES = [
  "SALE",
  "RENT_MONTHLY",
  "RENT_DAILY",
] as const satisfies readonly OfferPurpose[];

type Sort = "default" | "priceAsc" | "priceDesc";

function normalize(
  features: (MapPointFeature | MapPolygonFeature)[],
): FeedItem[] {
  return features.map((f) => ({
    id: "listingId" in f ? f.listingId : f.id,
    price: f.price,
    currency: f.currency,
    thumbUrl: f.thumbUrl,
  }));
}

function inRange(price: string, min: string, max: string): boolean {
  if (!min && !max) return true;
  const value = Number(price);
  if (!Number.isFinite(value)) return false;
  if (min && value < Number(min)) return false;
  if (max && value > Number(max)) return false;
  return true;
}

function sortItems(items: FeedItem[], sort: Sort): FeedItem[] {
  if (sort === "default") return items;
  // Copied first: the array is derived from query data, and sorting in place
  // would mutate the cache entry React Query handed us.
  return [...items].sort((a, b) =>
    sort === "priceAsc"
      ? Number(a.price) - Number(b.price)
      : Number(b.price) - Number(a.price),
  );
}

export default function SotuvScreen() {
  const { colors, text, shadow } = useTheme();
  const t = useT();
  const [purpose, setPurpose] = useState<OfferPurpose>("SALE");
  const [sort, setSort] = useState<Sort>("default");
  // Kept as strings: an empty field means "no bound", which 0 cannot express.
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [address, setAddress] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  // Address is a server-side filter (the map features carry no address to
  // match against locally), so typing must not fire a request per keystroke.
  const debouncedAddress = useDebouncedValue(address);
  const viewportFilters = useMemo(
    () => ({ address: debouncedAddress }),
    [debouncedAddress],
  );

  const { data, isLoading, isError, refetch, isRefetching, onRegionChange } =
    useMapViewport(purpose, viewportFilters);

  // The map and the list have to show the same set, so the price filter is
  // applied to the features once, before either renders.
  const visible = useMemo<ViewportResponse | undefined>(() => {
    if (!data || (!minPrice && !maxPrice)) return data;
    return data.mode === "points"
      ? {
          mode: "points",
          features: data.features.filter((f) =>
            inRange(f.price, minPrice, maxPrice),
          ),
        }
      : {
          mode: "polygons",
          features: data.features.filter((f) =>
            inRange(f.price, minPrice, maxPrice),
          ),
        };
  }, [data, minPrice, maxPrice]);

  const items = useMemo(
    () => sortItems(visible ? normalize(visible.features) : [], sort),
    [visible, sort],
  );

  const purposeOptions = useMemo(
    () => PURPOSES.map((value) => ({ value, label: t(`purposes.${value}`) })),
    [t],
  );
  const sortOptions = useMemo(
    () =>
      [
        { value: "default", label: t("filters.sortDefault") },
        { value: "priceAsc", label: t("filters.sortPriceAsc") },
        { value: "priceDesc", label: t("filters.sortPriceDesc") },
      ] as const satisfies readonly { value: Sort; label: string }[],
    [t],
  );

  const onPressItem = useCallback(
    (id: string) => router.push(`/listing/${id}`),
    [],
  );

  // Anything away from the defaults counts, so the badge matches what the user
  // would have to undo to see the plain feed again. The price pair counts once:
  // it is one control, however many of its two fields are filled.
  const activeCount =
    (purpose === "SALE" ? 0 : 1) +
    (sort === "default" ? 0 : 1) +
    (minPrice || maxPrice ? 1 : 0) +
    (address.trim() ? 1 : 0);

  const resetFilters = useCallback(() => {
    setPurpose("SALE");
    setSort("default");
    setMinPrice("");
    setMaxPrice("");
    setAddress("");
  }, []);

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={TAB_EDGES}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.md,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={text.display} numberOfLines={1}>
            {t("listings.saleTitle")}
          </Text>
          {/* Second line carries what the filters are currently doing — with
              the chips gone, this is the only place the active purpose shows. */}
          {!isLoading && !isError ? (
            <Text style={text.caption} numberOfLines={1}>
              {t(`purposes.${purpose}`)} ·{" "}
              {t("listings.countFound", { count: items.length })}
            </Text>
          ) : null}
        </View>

        {/* The two header actions travel together, tighter than the gap that
            separates them from the title. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <FilterButton
            onPress={() => setFiltersOpen(true)}
            activeCount={activeCount}
          />

          {/* Circular icon button rather than a labelled pill: the label pushed
              the header off balance in Russian, where the word is twice as
              long. */}
          <Pressable
            onPress={() => router.push("/add")}
            accessibilityRole="button"
            accessibilityLabel={t("listings.addListing")}
            style={({ pressed }) => ({
              width: sizing.controlMd,
              height: sizing.controlMd,
              borderRadius: radii.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? colors.primaryPressed : colors.primary,
              transform: [{ scale: pressed ? 0.94 : 1 }],
              ...shadow.control,
            })}
          >
            <Ionicons name="add" size={24} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Map above the feed, both fed by the same viewport query: panning the
          map moves the camera, the debounced region change refetches, and the
          list underneath is exactly what is on screen. Expanded, it takes the
          whole content area — the list yields rather than a second screen
          being pushed, so the camera, filters and data all carry over. */}
      <View
        style={{
          height: mapExpanded ? undefined : MAP_HEIGHT,
          flex: mapExpanded ? 1 : undefined,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceSunken,
          overflow: "hidden",
        }}
      >
        <ListingsMap
          data={visible}
          onRegionChange={onRegionChange}
          onPressListing={onPressItem}
          expanded={mapExpanded}
          onToggleExpand={() => setMapExpanded((v) => !v)}
        />
      </View>

      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={activeCount ? resetFilters : undefined}
      >
        <Section title={t("filters.purpose")}>
          <ChipGroup
            options={purposeOptions}
            value={purpose}
            onChange={setPurpose}
          />
        </Section>
        <Section title={t("filters.address")}>
          <TextField
            placeholder={t("filters.addressPlaceholder")}
            icon="location-outline"
            value={address}
            onChangeText={setAddress}
            autoCorrect={false}
            returnKeyType="search"
          />
        </Section>
        <Section title={t("filters.price")}>
          <PriceRangeFilter
            min={minPrice}
            max={maxPrice}
            onChangeMin={setMinPrice}
            onChangeMax={setMaxPrice}
          />
        </Section>
        <Section title={t("filters.sort")}>
          <ChipGroup options={sortOptions} value={sort} onChange={setSort} />
        </Section>
      </FilterSheet>

      {/* Full-screen map: the list yields entirely — the pins ARE the feed. */}
      {mapExpanded ? null : isLoading ? (
        <ActivityIndicator
          style={{ marginTop: spacing.xxl }}
          color={colors.primary}
        />
      ) : isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          tone="danger"
          title={t("listings.loadError")}
          actionLabel={t("common.retry")}
          onAction={refetch}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: 0,
            gap: spacing.md,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          ListEmptyComponent={
            <EmptyState
              icon="map-outline"
              title={t("listings.emptyFeed")}
              actionLabel={t("common.retry")}
              onAction={refetch}
            />
          }
          renderItem={({ item }) => (
            <FeedRow item={item} onPress={onPressItem} />
          )}
        />
      )}
    </Screen>
  );
}

const FeedRow = memo(function FeedRow({
  item,
  onPress,
}: {
  item: FeedItem;
  onPress: (id: string) => void;
}) {
  const { colors, text, shadow } = useTheme();
  const t = useT();
  const formatPrice = usePriceFormatter();

  return (
    <Pressable
      onPress={() => onPress(item.id)}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.border,
        transform: [{ scale: pressed ? 0.985 : 1 }],
        ...shadow.card,
      })}
    >
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: radii.lg,
          overflow: "hidden",
          backgroundColor: colors.surfaceRaised,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {item.thumbUrl ? (
          <Image
            source={{ uri: resolveMediaUrl(item.thumbUrl) }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <Ionicons name="image-outline" size={24} color={colors.textFaint} />
        )}
      </View>

      <View style={{ flex: 1, gap: spacing.xs, paddingRight: spacing.sm }}>
        <Text style={text.title} numberOfLines={1}>
          {formatPrice(item.price, item.currency)}
        </Text>
        <Text style={{ ...text.caption, color: colors.primary }}>
          {t("listings.viewDetails")}
        </Text>
      </View>

      <SaveHeart listingId={item.id} />

      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.textFaint}
        style={{ marginRight: spacing.sm }}
      />
    </Pressable>
  );
});

/** Row-level save toggle. The feed's row model is too slim to seed the Saved
 *  cache, so the tab itself fills in on the refetch the toggle kicks off. */
const SaveHeart = memo(function SaveHeart({ listingId }: { listingId: string }) {
  const { colors } = useTheme();
  const t = useT();
  const authed = useAuthStore((s) => s.status === "authenticated");
  const isSaved = useIsSaved(listingId);
  const toggleSave = useToggleSave();

  if (!authed) return null;

  return (
    <Pressable
      onPress={() => toggleSave.mutate({ listingId, next: !isSaved })}
      disabled={toggleSave.isPending}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t(isSaved ? "saved.unsave" : "saved.save")}
      accessibilityState={{ selected: isSaved }}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.surfaceRaised : "transparent",
      })}
    >
      <Ionicons
        name={isSaved ? "heart" : "heart-outline"}
        size={20}
        color={isSaved ? colors.danger : colors.textFaint}
      />
    </Pressable>
  );
});
