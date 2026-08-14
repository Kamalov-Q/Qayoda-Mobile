// app/(tabs)/places.tsx
import { useCallback, useMemo, useState } from "react";
import {
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  View,
} from "react-native";
import { router } from "expo-router";
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
import { spacing } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";
import {
  Listing,
  PropertyCategory,
} from "../../src/features/listings/api/listings.api";
import {
  inPriceRange,
  listingPrice,
} from "../../src/features/listings/utils/offers";
import { useMyListings } from "../../src/features/listings/hooks/useMyListings";
import { ListingCard } from "../../src/features/listings/components/ListingCard";

// Both filters run over the already-fetched list: /listings/mine returns the
// user's own listings whole, so filtering client-side costs no request and
// keeps working offline from the cache.
const STATUSES = ["ACTIVE", "DRAFT", "ARCHIVED"] as const;
type Status = (typeof STATUSES)[number];

const CATEGORIES = [
  "APARTMENT",
  "HOUSE",
  "LAND",
  "NON_RESIDENTIAL",
  "BUILDING",
  "DACHA",
] as const satisfies readonly PropertyCategory[];

const ALL = "ALL";
type StatusFilter = typeof ALL | Status;
type CategoryFilter = typeof ALL | PropertyCategory;

/** Chip option; named locally because `Option` collides with the DOM global. */
type Choice<T extends string> = { value: T; label: string };

export default function PlacesScreen() {
  const { text, colors } = useTheme();
  const t = useT();
  const { data, isLoading, isError, refetch, isRefetching } = useMyListings();

  const [status, setStatus] = useState<StatusFilter>(ALL);
  const [category, setCategory] = useState<CategoryFilter>(ALL);
  // Kept as strings: an empty field means "no bound", which 0 cannot express.
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [address, setAddress] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const onPress = useCallback((id: string) => router.push(`/listing/${id}`), []);

  const statusOptions = useMemo<Choice<StatusFilter>[]>(
    () => [
      { value: ALL, label: t("filters.all") },
      ...STATUSES.map((value) => ({ value, label: t(`statuses.${value}`) })),
    ],
    [t],
  );
  const categoryOptions = useMemo<Choice<CategoryFilter>[]>(
    () => [
      { value: ALL, label: t("filters.all") },
      ...CATEGORIES.map((value) => ({ value, label: t(`categories.${value}`) })),
    ],
    [t],
  );

  // Locale-aware lowercasing costs nothing here and Cyrillic addresses need it.
  const addressQuery = address.trim().toLocaleLowerCase();

  const listings: Listing[] = useMemo(
    () =>
      (data ?? []).filter(
        (l) =>
          (status === ALL || l.status === status) &&
          (category === ALL || l.category === category) &&
          inPriceRange(listingPrice(l), minPrice, maxPrice) &&
          (!addressQuery ||
            !!l.address?.toLocaleLowerCase().includes(addressQuery)),
      ),
    [data, status, category, minPrice, maxPrice, addressQuery],
  );

  // The price pair counts once — it is one control, however many fields are set.
  const activeCount =
    (status === ALL ? 0 : 1) +
    (category === ALL ? 0 : 1) +
    (minPrice || maxPrice ? 1 : 0) +
    (addressQuery ? 1 : 0);

  // A filtered-out list and a genuinely empty account need different copy —
  // "you have no listings yet" is wrong when the user just narrowed the view.
  const hiddenByFilters = activeCount > 0 && !!data?.length && !listings.length;

  const resetFilters = useCallback(() => {
    setStatus(ALL);
    setCategory(ALL);
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
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={text.display} numberOfLines={1}>
            {t("listings.myListingsTitle")}
          </Text>
          {!isLoading && !isError && data?.length ? (
            <Text style={text.caption} numberOfLines={1}>
              {t("listings.countFound", { count: listings.length })}
            </Text>
          ) : null}
        </View>

        {/* Hidden while loading or after a failure: filtering nothing is noise. */}
        {!isLoading && !isError && data?.length ? (
          <FilterButton
            onPress={() => setFiltersOpen(true)}
            activeCount={activeCount}
          />
        ) : null}
      </View>

      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={activeCount ? resetFilters : undefined}
      >
        <Section title={t("filters.status")}>
          <ChipGroup
            options={statusOptions}
            value={status}
            onChange={setStatus}
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
          <PriceRangeFilter
            min={minPrice}
            max={maxPrice}
            onChangeMin={setMinPrice}
            onChangeMax={setMaxPrice}
          />
        </Section>
      </FilterSheet>

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
          data={listings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            // Lets the empty state centre itself instead of hugging the header.
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            hiddenByFilters ? (
              <EmptyState
                icon="funnel-outline"
                title={t("filters.empty")}
                actionLabel={t("filters.reset")}
                onAction={resetFilters}
              />
            ) : (
              <EmptyState
                icon="business-outline"
                title={t("listings.emptyMine")}
                actionLabel={t("listings.addListing")}
                onAction={() => router.push("/add")}
              />
            )
          }
          renderItem={({ item }) => (
            <ListingCard listing={item} onPress={onPress} />
          )}
        />
      )}
    </Screen>
  );
}
