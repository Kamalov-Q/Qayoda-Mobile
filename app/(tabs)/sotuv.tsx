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
import { useIsFocused } from "expo-router";
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
  SelectSheet,
  TextField,
  TAB_EDGES,
} from "../../src/components/ui";
import { spacing, radii, sizing, type } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";
import {
  Listing,
  OfferPurpose,
} from "../../src/features/listings/api/listings.api";
import { useDebouncedValue } from "../../src/lib/use-debounced-value";
import {
  ALL_ICON,
  PURPOSE_ICONS,
} from "../../src/features/listings/utils/icons";
import { useCategories } from "../../src/features/listings/hooks/useCategories";
import { useMapViewport } from "../../src/features/listings/hooks/useMapViewport";
import { useListingsFeed } from "../../src/features/listings/hooks/useListingsFeed";
import { useRates } from "../../src/features/listings/hooks/useRates";
import { usePreferences } from "../../src/lib/preferences";
import {
  useIsSaved,
  useToggleSave,
} from "../../src/features/listings/hooks/useSavedListings";
import { requireAuth } from "../../src/features/auth/guest";
import {
  usePriceFormatter,
  useRelativeDate,
  useSpecsFormatter,
} from "../../src/features/listings/utils/format";
import { ListingCardBase } from "../../src/features/listings/components/ListingCardBase";
import { ListingGridCard } from "../../src/features/listings/components/ListingGridCard";
import { ListingsMap } from "../../src/features/map/ListingsMap";

// The floating map/list/grid switch: its own width, and the room the map
// controls and the feed have to leave under themselves so nothing hides
// behind it.
const SWITCH_WIDTH = 176; // icon-only: three 48pt targets + track padding
const SWITCH_HEIGHT = 58; // 46pt segments + 5pt track padding + hairline
const SWITCH_CLEARANCE = SWITCH_HEIGHT + spacing.lg;

// The list/grid row model, derived from the feed endpoint's full listings.
interface FeedItem {
  id: string;
  price: string | null;
  currency: string;
  thumbUrl: string | null;
  title: string | null;
  rooms: number | null;
  areaM2: string | null;
  address: string | null;
  publishedAt: string | null;
  ratingAvg: number | null;
  ratingCount: number;
}

function toFeedItem(l: Listing, purpose: OfferPurpose): FeedItem {
  // The feed only returns listings with a matching active offer, but the
  // fallback keeps a stale cache entry from crashing the row.
  const offer =
    l.offers.find((o) => o.purpose === purpose && o.isActive) ?? l.offers[0];
  const image = l.images.find((i) => i.isPrimary) ?? l.images[0];
  return {
    id: l.id,
    price: offer?.price ?? null,
    currency: offer?.currency ?? "USD",
    thumbUrl: image?.thumbUrl ?? null,
    title: l.title,
    rooms: l.rooms,
    areaM2: l.areaM2,
    address: l.address,
    publishedAt: l.publishedAt ?? l.createdAt,
    ratingAvg: l.ratingAvg,
    ratingCount: l.ratingCount,
  };
}

// Purpose is the one filter the API itself understands, so it re-queries;
// sorting is applied to whatever came back.
const PURPOSES = [
  "SALE",
  "RENT_MONTHLY",
  "RENT_DAILY",
] as const satisfies readonly OfferPurpose[];

type Sort = "default" | "priceAsc" | "priceDesc";
type ViewMode = "map" | "list" | "grid";

/**
 * The unfiltered state; every other value is a category slug sent to the
 * server as-is. Lower-case on purpose: slugs start with an upper-case letter,
 * so no admin-created category can ever collide with it.
 */
const ALL = "__all__";
type CategoryFilter = string;

export default function SotuvScreen() {
  const { colors, text, shadow } = useTheme();
  const t = useT();
  const [purpose, setPurpose] = useState<OfferPurpose>("SALE");
  const [category, setCategory] = useState<CategoryFilter>(ALL);
  const { categories, nameOf, iconOf } = useCategories();
  const [sort, setSort] = useState<Sort>("default");
  // Kept as strings: an empty field means "no bound", which 0 cannot express.
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [address, setAddress] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  // A listing's preview card is up on the map: the floating count steps aside
  // so it doesn't sit on the card's "view details" link (it's in the header too).
  const [cardOpen, setCardOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [purposeOpen, setPurposeOpen] = useState(false);
  // One search box drives both worlds: the feed's title+address search, and
  // the map's server-side address narrowing.
  const [query, setQuery] = useState("");
  // Map-first: the pins ARE the feed here. The list is one toggle away.
  const [view, setView] = useState<ViewMode>("map");

  // Address and price are server-side filters (the map features carry no
  // address to match against locally), so typing must not fire a request per
  // keystroke.
  const debouncedAddress = useDebouncedValue(address);
  const debouncedQuery = useDebouncedValue(query);

  // Price bounds are typed in the viewer's display currency but travel in
  // USD — the server compares against the normalised column.
  const displayCurrency = usePreferences((s) => s.currency);
  const { data: rates } = useRates();
  const boundToUsd = useCallback(
    (v: string) => {
      if (!v) return undefined;
      const n = Number(v);
      if (!Number.isFinite(n)) return undefined;
      return displayCurrency === "UZS" && rates?.usdToUzs
        ? n / rates.usdToUzs
        : n;
    },
    [displayCurrency, rates],
  );
  const debouncedMin = useDebouncedValue(minPrice);
  const debouncedMax = useDebouncedValue(maxPrice);
  const viewportFilters = useMemo(
    () => ({
      address: debouncedQuery || debouncedAddress,
      category: category === ALL ? undefined : category,
      priceMin: boundToUsd(debouncedMin),
      priceMax: boundToUsd(debouncedMax),
    }),
    [
      debouncedQuery,
      debouncedAddress,
      category,
      debouncedMin,
      debouncedMax,
      boundToUsd,
    ],
  );

  // Unfocused (a listing pushed on top, another tab active) → both queries
  // pause: no refetch can redraw what nobody sees.
  const isFocused = useIsFocused();

  const { data, isLoading, isError, onRegionChange } = useMapViewport(
    purpose,
    viewportFilters,
    isFocused,
  );

  // Category and price travel with the query, so the map shows exactly what
  // came back for the visible viewport.
  const visible = data;

  // The list and grid are NOT the viewport: they browse every active listing
  // through the feed endpoint, searched/sorted/filtered server-side. Only
  // fetched while one of them is actually on screen.
  const feed = useListingsFeed(
    {
      purpose,
      category: category === ALL ? undefined : category,
      priceMin: boundToUsd(debouncedMin),
      priceMax: boundToUsd(debouncedMax),
      q: debouncedQuery || undefined,
      sort: sort === "default" ? "newest" : sort,
    },
    isFocused && view !== "map",
  );
  const feedItems = useMemo(
    () => (feed.data?.pages.flat() ?? []).map((l) => toFeedItem(l, purpose)),
    [feed.data, purpose],
  );

  const shownCount =
    view === "map" ? (visible?.features.length ?? 0) : feedItems.length;

  const purposeOptions = useMemo(
    () =>
      PURPOSES.map((value) => ({
        value,
        label: t(`purposes.${value}`),
        icon: PURPOSE_ICONS[value],
      })),
    [t],
  );
  const sortOptions = useMemo(
    () =>
      [
        {
          value: "default",
          label: t("filters.sortDefault"),
          icon: "time-outline",
        },
        {
          value: "priceAsc",
          label: t("filters.sortPriceAsc"),
          icon: "trending-up-outline",
        },
        {
          value: "priceDesc",
          label: t("filters.sortPriceDesc"),
          icon: "trending-down-outline",
        },
      ] as const satisfies readonly {
        value: Sort;
        label: string;
        icon: keyof typeof Ionicons.glyphMap;
      }[],
    [t],
  );

  // Icons only: the three glyphs are unambiguous here, and three spelled-out
  // labels made the floating switch wider than a thumb comfortably crosses.
  const viewOptions = useMemo(
    () =>
      [
        { value: "map", icon: "map-outline" },
        { value: "list", icon: "list-outline" },
        { value: "grid", icon: "grid-outline" },
      ] as const satisfies readonly {
        value: ViewMode;
        icon: keyof typeof Ionicons.glyphMap;
      }[],
    [],
  );

  const categoryOptions = useMemo(
    () =>
      [
        { value: ALL, label: t("filters.allTypes"), icon: ALL_ICON },
        ...categories.map((c) => ({
          value: c.slug,
          label: nameOf(c.slug),
          icon: iconOf(c.slug),
        })),
      ],
    [t, categories, nameOf, iconOf],
  );

  const onPressItem = useCallback(
    (id: string) => router.push(`/listing/${id}`),
    [],
  );

  // Anything away from the defaults counts, so the badge matches what the user
  // would have to undo to see the plain feed again. The price pair counts once:
  // it is one control, however many of its two fields are filled.
  // Purpose and category are inline controls with their own visible state, so
  // the badge counts only what hides inside the sheet.
  const activeCount =
    (sort === "default" ? 0 : 1) +
    (minPrice || maxPrice ? 1 : 0) +
    (address.trim() ? 1 : 0);

  const resetFilters = useCallback(() => {
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
              {t("listings.foundShort", { count: shownCount })}
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

      {/* Search + locate + filters, one row. The search box feeds the feed's
          title/address search and the map's address filter alike; the locate
          button jumps to the map, whose own locate control finishes the job. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          <TextField
            placeholder={t("listings.searchPlaceholder")}
            icon="search-outline"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <Pressable
          onPress={() => setView("map")}
          accessibilityRole="button"
          accessibilityLabel={t("location.myLocation")}
          style={({ pressed }) => ({
            width: sizing.control,
            height: sizing.control,
            borderRadius: radii.md,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
          })}
        >
          <Ionicons
            name="navigate-outline"
            size={19}
            color={colors.textMuted}
          />
        </Pressable>
      </View>

      {/* Both headline filters as compact select pills on ONE row — the
          Russian purpose labels truncated every segmented track ("Аренда
          пос…"), and a dropdown pill always has room for its one selected
          word. The same two filters are mirrored inside the funnel sheet. */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          gap: spacing.sm,
        }}
      >
        <FilterPill
          icon="pricetag-outline"
          label={t(`purposes.${purpose}`)}
          active={purpose !== "SALE"}
          onPress={() => setPurposeOpen(true)}
        />
        <FilterPill
          icon="business-outline"
          label={
            category === ALL ? t("filters.categoryPill") : nameOf(category)
          }
          active={category !== ALL}
          onPress={() => setCategoryOpen(true)}
        />
      </View>

      {/* Map and list are fed by the same viewport query: panning the map
          moves the camera, the debounced region change refetches, and the list
          is exactly what is on screen. The map fills everything below the
          header and STAYS MOUNTED in list view — the list draws over it — so
          toggling back never resets the camera or refires the fetch. */}
      <View style={{ flex: 1 }}>
        <View
          style={{
            ...StyleSheet.absoluteFill,
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
            onSelectionChange={setCardOpen}
          />
        </View>

        {view !== "map" ? (
          <View
            style={{
              ...StyleSheet.absoluteFill,
              backgroundColor: colors.bg,
              borderTopWidth: 1,
              borderColor: colors.border,
            }}
          >
            {feed.isLoading ? (
              <ActivityIndicator
                style={{ marginTop: spacing.xxl }}
                color={colors.primary}
              />
            ) : feed.isError ? (
              <EmptyState
                icon="cloud-offline-outline"
                tone="danger"
                title={t("listings.loadError")}
                actionLabel={t("common.retry")}
                onAction={() => feed.refetch()}
              />
            ) : (
              <FlatList
                // numColumns cannot change on a live list — the key remounts
                // it when the layout flips between one and two columns.
                key={view}
                data={feedItems}
                keyExtractor={(item) => item.id}
                numColumns={view === "grid" ? 2 : 1}
                {...(view === "grid"
                  ? { columnWrapperStyle: { gap: spacing.md } }
                  : {})}
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
                    refreshing={feed.isRefetching}
                    onRefresh={() => feed.refetch()}
                    tintColor={colors.primary}
                  />
                }
                onEndReached={() => {
                  if (feed.hasNextPage && !feed.isFetchingNextPage) {
                    void feed.fetchNextPage();
                  }
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                  feed.isFetchingNextPage ? (
                    <ActivityIndicator
                      style={{ padding: spacing.md }}
                      color={colors.primary}
                    />
                  ) : null
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
                    onAction={() => feed.refetch()}
                  />
                }
                renderItem={({ item }) => (
                  <FeedRow
                    item={item}
                    purpose={purpose}
                    grid={view === "grid"}
                    onPress={onPressItem}
                  />
                )}
              />
            )}
          </View>
        ) : null}

        {/* Total count riding above the switch, reference-app style — on the
            map it is the only place the number fits without a header glance. */}
        {view === "map" && !isLoading && !isError && !cardOpen ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: spacing.lg + SWITCH_HEIGHT + spacing.sm,
              alignItems: "center",
            }}
          >
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 6,
                borderRadius: radii.pill,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                ...shadow.raised,
              }}
            >
              <Text
                style={{ ...type.bodyStrong, fontSize: 13, color: colors.text }}
              >
                {t("listings.foundShort", { count: shownCount })}
              </Text>
            </View>
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
          <View
            style={{
              width: SWITCH_WIDTH,
              borderRadius: radii.pill,
              ...shadow.raised,
            }}
          >
            <SegmentedControl
              segments={viewOptions}
              value={view}
              onChange={setView}
              size="lg"
            />
          </View>
        </View>
      </View>

      <SelectSheet
        visible={purposeOpen}
        title={t("filters.purpose")}
        options={purposeOptions}
        value={purpose}
        onSelect={setPurpose}
        onClose={() => setPurposeOpen(false)}
      />

      <SelectSheet
        visible={categoryOpen}
        title={t("filters.categoryPill")}
        options={categoryOptions}
        value={category}
        onSelect={setCategory}
        onClose={() => setCategoryOpen(false)}
      />

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
        <Section title={t("filters.category")}>
          <ChipGroup
            options={categoryOptions}
            value={category}
            onChange={setCategory}
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
          {/* The track's range follows the purpose: a nightly rate and a
              sale price differ by four orders of magnitude. */}
          <PriceRangeFilter
            min={minPrice}
            max={maxPrice}
            onChangeMin={setMinPrice}
            onChangeMax={setMaxPrice}
            currency={displayCurrency}
            scale={purpose}
          />
        </Section>
        <Section title={t("filters.sort")}>
          <ChipGroup options={sortOptions} value={sort} onChange={setSort} />
        </Section>
      </FilterSheet>
    </Screen>
  );
}

/**
 * A select pill: names its current value, fills with the primary tint when
 * away from the default, opens a picker sheet. The modern replacement for a
 * row of chips or a truncating segmented track.
 */
const FilterPill = memo(function FilterPill({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const fg = active ? colors.primary : colors.text;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        height: 38,
        maxWidth: "60%",
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: active ? colors.primaryBorder : colors.border,
        backgroundColor: active
          ? colors.primarySoft
          : pressed
            ? colors.surfaceRaised
            : colors.surface,
      })}
    >
      <Ionicons
        name={icon}
        size={15}
        color={active ? colors.primary : colors.textMuted}
      />
      <Text
        style={{ ...type.bodyStrong, fontSize: 14, color: fg }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Ionicons
        name="chevron-down"
        size={14}
        color={active ? colors.primary : colors.textMuted}
      />
    </Pressable>
  );
});

const FeedRow = memo(function FeedRow({
  item,
  purpose,
  grid,
  onPress,
}: {
  item: FeedItem;
  purpose: OfferPurpose;
  grid?: boolean;
  onPress: (id: string) => void;
}) {
  const formatPrice = usePriceFormatter();
  const formatSpecs = useSpecsFormatter();
  const relativeDate = useRelativeDate();

  const specs = formatSpecs(item);
  const price = item.price
    ? formatPrice(item.price, item.currency, purpose)
    : null;
  const meta =
    [item.address, relativeDate(item.publishedAt)]
      .filter(Boolean)
      .join(" · ") || null;

  if (grid) {
    return (
      <ListingGridCard
        thumbUrl={item.thumbUrl}
        price={price}
        title={item.title}
        specs={specs || null}
        meta={meta}
        rating={{ average: item.ratingAvg, count: item.ratingCount }}
        onPress={() => onPress(item.id)}
        overlay={<SaveHeart listingId={item.id} />}
      />
    );
  }

  return (
    <ListingCardBase
      thumbUrl={item.thumbUrl}
      price={price}
      title={item.title}
      meta={meta}
      // Zoomed out the API returns points, which carry neither title nor
      // specs — those cards are a photo and a price, and the shared card is
      // built to look finished that way rather than half-loaded.
      specs={specs || null}
      rating={{ average: item.ratingAvg, count: item.ratingCount }}
      onPress={() => onPress(item.id)}
      overlay={<SaveHeart listingId={item.id} />}
    />
  );
});

/** Save toggle for the card's photo overlay. The feed's row model is too slim
 *  to seed the Saved cache, so the tab itself fills in on the refetch the
 *  toggle kicks off. */
const SaveHeart = memo(function SaveHeart({
  listingId,
}: {
  listingId: string;
}) {
  const { colors } = useTheme();
  const t = useT();
  const isSaved = useIsSaved(listingId);
  const toggleSave = useToggleSave();

  return (
    <Pressable
      onPress={() =>
        requireAuth(() => toggleSave.mutate({ listingId, next: !isSaved }))
      }
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
