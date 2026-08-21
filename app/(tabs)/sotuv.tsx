// app/(tabs)/sotuv.tsx
import { memo, useCallback, useMemo, useState } from "react";
import {
  Text,
  View,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  EmptyState,
  Section,
  ChipGroup,
  FilterSheet,
  FilterButton,
  PriceRangeFilter,
  SegmentedControl,
  TextField,
  TAB_EDGES,
} from "../../src/components/ui";
import { spacing, radii, sizing } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";
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
import {
  usePriceFormatter,
  useSpecsFormatter,
} from "../../src/features/listings/utils/format";
import { ListingCardBase } from "../../src/features/listings/components/ListingCardBase";
import { ListingsMap } from "../../src/features/map/ListingsMap";

// The floating map/list switch: its own width, and the room the map controls
// and the feed have to leave under themselves so nothing hides behind it.
const SWITCH_WIDTH = 232;
const SWITCH_HEIGHT = 58; // 46pt segments + 5pt track padding + hairline
const SWITCH_CLEARANCE = SWITCH_HEIGHT + spacing.lg;

// Feed driven by the viewport endpoint until a search endpoint exists.
// Normalize both feature shapes into one row model — the polygon shape
// (zoomed in) carries title/specs the point shape doesn't, and the card
// shows them when they're there.
interface FeedItem {
  id: string;
  price: string;
  currency: string;
  thumbUrl: string | null;
  title: string | null;
  rooms: number | null;
  areaM2: string | null;
}

// Purpose is the one filter the API itself understands, so it re-queries;
// sorting is applied to whatever came back.
const PURPOSES = [
  "SALE",
  "RENT_MONTHLY",
  "RENT_DAILY",
] as const satisfies readonly OfferPurpose[];

type Sort = "default" | "priceAsc" | "priceDesc";
type ViewMode = "map" | "list";

function normalize(
  features: (MapPointFeature | MapPolygonFeature)[],
): FeedItem[] {
  return features.map((f) => ({
    id: "listingId" in f ? f.listingId : f.id,
    price: f.price,
    currency: f.currency,
    thumbUrl: f.thumbUrl,
    title: "title" in f ? f.title : null,
    rooms: "rooms" in f ? f.rooms : null,
    areaM2: "areaM2" in f ? f.areaM2 : null,
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
  // Map-first: the pins ARE the feed here. The list is one toggle away.
  const [view, setView] = useState<ViewMode>("map");

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

  const viewOptions = useMemo(
    () =>
      [
        { value: "map", label: t("map.map"), icon: "map-outline" },
        { value: "list", label: t("map.list"), icon: "list-outline" },
      ] as const satisfies readonly {
        value: ViewMode;
        label: string;
        icon: keyof typeof Ionicons.glyphMap;
      }[],
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

        {/* The header actions travel together, tighter than the gap that
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

      {/* Map and list are fed by the same viewport query: panning the map
          moves the camera, the debounced region change refetches, and the list
          is exactly what is on screen. The map fills everything below the
          header and STAYS MOUNTED in list view — the list draws over it — so
          toggling back never resets the camera or refires the fetch. */}
      <View style={{ flex: 1 }}>
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            borderTopWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSunken,
          }}
        >
          <ListingsMap
            data={visible}
            onRegionChange={onRegionChange}
            onPressListing={onPressItem}
            bottomInset={SWITCH_CLEARANCE}
          />
        </View>

        {view === "list" ? (
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: colors.bg,
              borderTopWidth: 1,
              borderColor: colors.border,
            }}
          >
            {isLoading ? (
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
                  // Clears the floating switch, which otherwise covers the
                  // last card in the feed.
                  paddingBottom: SWITCH_CLEARANCE + spacing.lg,
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
                  <FeedRow item={item} purpose={purpose} onPress={onPressItem} />
                )}
              />
            )}
          </View>
        ) : null}

        {/* Floating, centred, over whichever view is up. It was a 46pt icon
            button lost among two other icon buttons in the header — the one
            control on this screen that changes what you are looking at, and
            the least visible thing on it. Down here it is thumb-height, both
            destinations are spelled out, and the filled segment says which
            one you are in. */}
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: spacing.lg,
            alignItems: "center",
          }}
          pointerEvents="box-none"
        >
          <View style={{ width: SWITCH_WIDTH, borderRadius: radii.pill, ...shadow.raised }}>
            <SegmentedControl
              segments={viewOptions}
              value={view}
              onChange={setView}
              size="lg"
            />
          </View>
        </View>
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
    </Screen>
  );
}

const FeedRow = memo(function FeedRow({
  item,
  purpose,
  onPress,
}: {
  item: FeedItem;
  purpose: OfferPurpose;
  onPress: (id: string) => void;
}) {
  const formatPrice = usePriceFormatter();
  const formatSpecs = useSpecsFormatter();

  const specs = formatSpecs(item);

  return (
    <ListingCardBase
      thumbUrl={item.thumbUrl}
      price={formatPrice(item.price, item.currency, purpose)}
      title={item.title}
      // Zoomed out the API returns points, which carry neither title nor
      // specs — those cards are a photo and a price, and the shared card is
      // built to look finished that way rather than half-loaded.
      specs={specs || null}
      onPress={() => onPress(item.id)}
      overlay={<SaveHeart listingId={item.id} />}
    />
  );
});

/** Save toggle for the card's photo overlay. The feed's row model is too slim
 *  to seed the Saved cache, so the tab itself fills in on the refetch the
 *  toggle kicks off. */
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
        width: 34,
        height: 34,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        // A scrim, because the heart sits on an unknown photo — an outline
        // glyph alone disappears against a pale one.
        backgroundColor: colors.imageScrim,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons
        name={isSaved ? "heart" : "heart-outline"}
        size={19}
        // White, not textFaint: the scrim is dark whichever theme is on.
        color={isSaved ? colors.danger : "#FFFFFF"}
      />
    </Pressable>
  );
});
