// app/profile/[id].tsx
import { memo, useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from "react-native";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Avatar,
  Button,
  EmptyState,
  FilterPill,
  ImageViewer,
  SelectSheet,
  HEADER_EDGES,
} from "../../src/components/ui";
import { spacing, radii, type } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT, useLanguage } from "../../src/i18n";
import { errorMessage } from "../../src/lib/api-error";
import { resolveMediaUrl } from "../../src/lib/media-url";
import { prettyPhone } from "../../src/lib/phone";
import { useUserProfile } from "../../src/features/users/hooks/useUserProfile";
import { useUserListings } from "../../src/features/users/hooks/useUserListings";
import {
  isDefaultOwnerFilters,
  type OwnerFacets,
  type OwnerListingFilters,
  type OwnerListingSort,
  type OwnerStats,
} from "../../src/features/users/api/users.api";
import { useCategories } from "../../src/features/listings/hooks/useCategories";
import {
  ALL_ICON,
  PURPOSE_ICONS,
} from "../../src/features/listings/utils/icons";
import { ListingCard } from "../../src/features/listings/components/ListingCard";
import type {
  Listing,
  OfferPurpose,
} from "../../src/features/listings/api/listings.api";
import { usePresence } from "../../src/features/chat/hooks/usePresence";
import { useConversations } from "../../src/features/chat/hooks/useConversations";
import { requirePhone } from "../../src/features/auth/guest";
import { useToggleBlock } from "../../src/features/blocks/hooks/useBlocks";
import { confirm } from "../../src/lib/alerts";
import { useAuthStore } from "../../src/features/auth/store/auth.store";
import { PresenceStatus } from "../../src/features/chat/components/PresenceStatus";

/** The order the purpose sheet lists them in — the same order the rest of the
 *  app uses, narrowed to what the seller actually has. */
const PROFILE_PURPOSES = [
  "SALE",
  "RENT_MONTHLY",
  "RENT_DAILY",
] as const satisfies readonly OfferPurpose[];

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, text } = useTheme();
  const t = useT();
  const language = useLanguage();

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useUserProfile(id);
  const [viewingAvatar, setViewingAvatar] = useState(false);
  const presence = usePresence(id);
  const viewerId = useAuthStore((st) => st.user?.id);
  const { data: conversations } = useConversations();
  const [filters, setFilters] = useState<OwnerListingFilters>({});
  const [sheet, setSheet] = useState<null | "purpose" | "category" | "sort">(
    null,
  );
  const isDefault = isDefaultOwnerFilters(filters);

  // Page one of the unfiltered view rides along with the profile; this
  // fetches the rest on scroll, and all of it once a filter is on.
  const more = useUserListings(id, filters, data?.listingCount ?? 0);
  const pages = useMemo(
    () => more.data?.pages.flatMap((p) => p.items) ?? [],
    [more.data],
  );
  const listings = useMemo(
    () => (isDefault ? [...(data?.listings ?? []), ...pages] : pages),
    [isDefault, data?.listings, pages],
  );

  // The total for the filter in force — what the reader is looking at, not
  // what the seller has in all.
  const shownTotal = isDefault
    ? (data?.listingCount ?? 0)
    : (more.data?.pages[0]?.total ?? 0);

  const photo = data?.avatarUrl ?? data?.avatarThumbUrl ?? null;

  const isSelf = !!viewerId && viewerId === id;
  const blocked = !!data?.blockedByMe;
  const toggleBlock = useToggleBlock();

  const onToggleBlock = () => {
    if (!id) return;
    if (blocked) {
      toggleBlock.mutate({ userId: id, block: false });
      return;
    }
    // Only the block is confirmed: it cuts a conversation off, and
    // unblocking is a keystroke away if it was a mistake.
    confirm({
      titleKey: "blocks.confirmTitle",
      messageKey: "blocks.confirmMessage",
      confirmKey: "blocks.block",
      destructive: true,
      onConfirm: () => toggleBlock.mutate({ userId: id, block: true }),
    });
  };

  // An existing thread with this person wins; otherwise their newest listing
  // is the thing to start one about.
  const chatTarget = useMemo(() => {
    if (!id || id === viewerId) return null;

    const existing = conversations?.find((c) => c.other.id === id);
    if (existing) return { kind: "existing" as const, id: existing.id };

    const listing = listings[0];
    return listing ? { kind: "new" as const, listingId: listing.id } : null;
  }, [id, viewerId, conversations, listings]);

  const openListing = useCallback(
    (listingId: string) => router.push(`/listing/${listingId}`),
    [],
  );

  const { nameOf, iconOf } = useCategories();
  // Defaulted rather than read straight off `data`: an app running against a
  // server that predates these fields should lose the filters, not the whole
  // screen.
  const facets: OwnerFacets = data?.facets ?? { purposes: {}, categories: {} };
  const stats: OwnerStats = data?.stats ?? {
    listings: data?.listingCount ?? 0,
    views: 0,
    // The same five every rating starts at, so a profile served by an older
    // API shows what that API would have meant rather than a dash.
    ratingAvg: 5,
    ratingCount: 0,
  };

  // "All", then only what this seller actually has, each carrying its count.
  // Built from facets rather than from the global category list: a profile
  // offering "Ombor (0)" is a filter that can only disappoint.
  const purposeOptions = useMemo(
    () => [
      { value: "", label: t("userProfile.allPurposes"), icon: ALL_ICON },
      ...PROFILE_PURPOSES.filter((p) => facets.purposes[p]).map((p) => ({
        value: p,
        label: `${t(`purposes.${p}`)} · ${facets.purposes[p]}`,
        icon: PURPOSE_ICONS[p],
      })),
    ],
    [t, facets.purposes],
  );

  const categoryOptions = useMemo(
    () => [
      { value: "", label: t("filters.allTypes"), icon: ALL_ICON },
      ...Object.entries(facets.categories)
        // Most of first: the seller's main line of business leads the sheet.
        .sort((a, b) => b[1] - a[1])
        .map(([slug, count]) => ({
          value: slug,
          label: `${nameOf(slug)} · ${count}`,
          icon: iconOf(slug),
        })),
    ],
    [t, facets.categories, nameOf, iconOf],
  );

  const sortOptions = useMemo(
    () =>
      [
        {
          value: "newest",
          label: t("userProfile.sortNewest"),
          icon: "time-outline",
        },
        {
          value: "oldest",
          label: t("userProfile.sortOldest"),
          icon: "hourglass-outline",
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
        value: OwnerListingSort;
        label: string;
        icon: keyof typeof Ionicons.glyphMap;
      }[],
    [t],
  );

  const name = data?.fullName ?? t("chat.unknownUser");

  const header = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.lg }}>
      <View style={{ alignItems: "center", gap: spacing.sm }}>
        {/* avatarUrl first, thumb as the fallback — the thumb is what the chat
            list already had, so a profile opened from there paints instantly
            from cache while the full-size version loads.

            Tappable only when there is a photo: the initials fallback has no
            bigger version to open. */}
        <Pressable
          onPress={() => photo && setViewingAvatar(true)}
          disabled={!photo}
          accessibilityRole={photo ? "imagebutton" : "image"}
          accessibilityLabel={t("profile.viewPhoto")}
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Avatar
            uri={photo}
            name={data?.fullName}
            size={104}
            online={presence?.online}
          />
        </Pressable>
        <Text style={{ ...text.display, textAlign: "center" }}>{name}</Text>
        {/* Presence is what blocking is for: the server already withholds
            it, and this keeps the row from rendering an empty state. */}
        {blocked ? (
          <Text style={{ ...text.caption, color: colors.textMuted }}>
            {t("blocks.youBlocked")}
          </Text>
        ) : (
          <PresenceStatus presence={presence} />
        )}

        {data ? (
          <Text style={text.caption}>
            {t("userProfile.memberSince", {
              date: new Date(data.createdAt).toLocaleDateString(language, {
                year: "numeric",
                month: "long",
              }),
            })}
          </Text>
        ) : null}
      </View>

      {/* What this seller is worth knowing by, in their own numbers. Only
          things actually counted: no "0 sales" column that can never move. */}
      {data ? <StatsRow stats={stats} /> : null}

      {/* The two things anyone opens a seller's profile to do, side by side,
          with the number itself underneath — the call button dials it, and
          the line below is for the reader who wants to copy it or simply see
          who they are about to ring.

          Writing reopens the conversation you already have with this person,
          or starts one on their newest advert — which is what you would have
          tapped through to anyway. Each half is dropped when it cannot work,
          because a button that can only fail is worse than no button. */}
      {data && !isSelf && !blocked && (data.phoneNumber || chatTarget) ? (
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {data.phoneNumber ? (
            <View style={{ flex: 1 }}>
              <Button
                title={t("userProfile.call")}
                icon="call-outline"
                variant="secondary"
                // Swallowed: a device with no dialer (a simulator, a tablet)
                // would otherwise crash the screen on a tap.
                onPress={() =>
                  Linking.openURL(
                    `tel:${data.phoneNumber!.replace(/[^\d+]/g, "")}`,
                  ).catch(() => {})
                }
              />
            </View>
          ) : null}
          {chatTarget ? (
            <View style={{ flex: 1 }}>
              <Button
                title={t("userProfile.write")}
                icon="chatbubble-ellipses-outline"
                onPress={() =>
                  requirePhone(() =>
                    chatTarget.kind === "existing"
                      ? // No `prefill`: that seeds the composer with the
                        // listing-enquiry boilerplate, which is right when
                        // you arrive from an advert and wrong when you arrive
                        // from a person you were already talking to.
                        router.push({
                          pathname: "/chat/[id]",
                          params: { id: chatTarget.id },
                        })
                      : router.push({
                          pathname: "/chat/[id]",
                          params: {
                            id: "new",
                            listingId: chatTarget.listingId,
                          },
                        }),
                  )
                }
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {data?.phoneNumber && !isSelf && !blocked ? (
        <Text
          selectable
          style={{
            ...text.caption,
            textAlign: "center",
            marginTop: -spacing.sm,
          }}
        >
          {prettyPhone(data.phoneNumber)}
        </Text>
      ) : null}

      {/* Blocking lives at the bottom of the profile, the way it does in
          every messenger: it is the last thing you decide about someone, and
          it should not sit next to the button that writes to them. */}
      {data && !isSelf ? (
        <Pressable
          onPress={onToggleBlock}
          disabled={toggleBlock.isPending}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            paddingVertical: spacing.md,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons
            name={blocked ? "lock-open-outline" : "ban-outline"}
            size={16}
            color={blocked ? colors.primary : colors.danger}
          />
          <Text
            style={{
              ...text.caption,
              fontWeight: "600",
              color: blocked ? colors.primary : colors.danger,
            }}
          >
            {t(blocked ? "blocks.unblock" : "blocks.block")}
          </Text>
        </Pressable>
      ) : null}

      {/* Their listings, and the three ways to cut them down. The sheets are
          built from the seller's own inventory: a purpose or a category they
          have nothing in is not offered, so no filter here can come back
          empty. */}
      {data ? (
        <View style={{ gap: spacing.sm }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginLeft: spacing.xs,
            }}
          >
            <Text style={text.label}>
              {t("userProfile.ads")} · {shownTotal}
            </Text>
            {!isDefault ? (
              <Pressable
                onPress={() => setFilters({})}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text
                  style={{
                    ...type.caption,
                    fontWeight: "600",
                    color: colors.primary,
                  }}
                >
                  {t("userProfile.clearFilters")}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {data.listingCount > 0 ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
              }}
            >
              {purposeOptions.length > 2 ? (
                <FilterPill
                  icon={
                    filters.purpose
                      ? PURPOSE_ICONS[filters.purpose]
                      : "pricetag-outline"
                  }
                  label={
                    filters.purpose
                      ? t(`purposes.${filters.purpose}`)
                      : t("userProfile.filterPurpose")
                  }
                  active={!!filters.purpose}
                  count={
                    filters.purpose
                      ? facets.purposes[filters.purpose]
                      : undefined
                  }
                  onPress={() => setSheet("purpose")}
                  maxWidth="60%"
                />
              ) : null}

              {categoryOptions.length > 2 ? (
                <FilterPill
                  icon={
                    filters.category
                      ? iconOf(filters.category)
                      : "business-outline"
                  }
                  label={
                    filters.category
                      ? nameOf(filters.category)
                      : t("userProfile.filterCategory")
                  }
                  active={!!filters.category}
                  count={
                    filters.category
                      ? facets.categories[filters.category]
                      : undefined
                  }
                  onPress={() => setSheet("category")}
                  maxWidth="60%"
                />
              ) : null}

              {/* Sorting is worth offering the moment there are two things to
                  put in an order. */}
              {data.listingCount > 1 ? (
                <FilterPill
                  icon="swap-vertical-outline"
                  label={
                    sortOptions.find(
                      (o) => o.value === (filters.sort ?? "newest"),
                    )?.label ?? t("userProfile.filterSort")
                  }
                  active={!!filters.sort && filters.sort !== "newest"}
                  onPress={() => setSheet("sort")}
                  maxWidth="60%"
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  if (isLoading) {
    return (
      <Screen edges={HEADER_EDGES} scroll={false}>
        <Stack.Screen options={{ title: t("userProfile.title") }} />
        <ActivityIndicator
          style={{ marginTop: spacing.xxl }}
          color={colors.primary}
        />
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen edges={HEADER_EDGES} scroll={false}>
        <Stack.Screen options={{ title: t("userProfile.title") }} />
        {/* The real reason, not a blanket "failed to load": a profile can
            fail because the id is unknown, because the session lapsed, or
            because the server is down, and those need different reactions
            from the person holding the phone. */}
        <EmptyState
          icon="cloud-offline-outline"
          tone="danger"
          title={t("listings.loadError")}
          description={error ? errorMessage(error) : undefined}
          actionLabel={t("common.retry")}
          onAction={refetch}
        />
      </Screen>
    );
  }

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={HEADER_EDGES}>
      {/* The header carries the name once it is known, so the pushed screen
          does not sit under a generic title while the fetch lands. */}
      <Stack.Screen options={{ title: name }} />

      <FlatList<Listing>
        data={listings}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={{
          padding: spacing.lg,
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
        ListEmptyComponent={
          // A filter change is a new query with no cached page, so the list
          // empties for a beat. A spinner says "fetching"; the empty state
          // would say "this seller has nothing", which is a different and
          // wrong thing to tell someone who just tapped a filter.
          more.isLoading ? (
            <ActivityIndicator
              style={{ marginTop: spacing.xl }}
              color={colors.primary}
            />
          ) : isDefault ? (
            <EmptyState
              icon="home-outline"
              title={t("userProfile.noAds")}
              description={t("userProfile.noAdsHint")}
            />
          ) : (
            <EmptyState
              icon="funnel-outline"
              title={t("userProfile.noMatches")}
              actionLabel={t("userProfile.clearFilters")}
              onAction={() => setFilters({})}
            />
          )
        }
        renderItem={({ item }) => (
          <ListingCard listing={item} onPress={openListing} />
        )}
        // Half a screen early, so the next page is usually there by the time
        // the reader reaches the end.
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (more.hasNextPage && !more.isFetchingNextPage) {
            void more.fetchNextPage();
          }
        }}
        ListFooterComponent={
          more.isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} />
          ) : null
        }
      />

      {/* One sheet open at a time, which is all a finger can do anyway. An
          empty value is "all": it clears that one filter without touching the
          other two. */}
      <SelectSheet
        visible={sheet === "purpose"}
        title={t("userProfile.filterPurpose")}
        options={purposeOptions}
        value={filters.purpose ?? ""}
        onSelect={(v) =>
          setFilters((f) => ({
            ...f,
            purpose: (v as OfferPurpose) || undefined,
          }))
        }
        onClose={() => setSheet(null)}
      />

      <SelectSheet
        visible={sheet === "category"}
        title={t("userProfile.filterCategory")}
        options={categoryOptions}
        value={filters.category ?? ""}
        onSelect={(v) =>
          setFilters((f) => ({ ...f, category: v || undefined }))
        }
        onClose={() => setSheet(null)}
      />

      <SelectSheet
        visible={sheet === "sort"}
        title={t("userProfile.filterSort")}
        options={sortOptions}
        value={filters.sort ?? "newest"}
        onSelect={(v) => setFilters((f) => ({ ...f, sort: v }))}
        onClose={() => setSheet(null)}
      />

      {viewingAvatar ? (
        <ImageViewer
          uri={resolveMediaUrl(photo) ?? null}
          onClose={() => setViewingAvatar(false)}
        />
      ) : null}
    </Screen>
  );
}

/**
 * The three numbers under the name.
 *
 * Every one of them is something the platform actually counts. Joymee's
 * version of this row carries "calls" and "sales" columns that sit at zero on
 * most profiles forever; a stat nobody can move teaches a reader to ignore
 * the whole row.
 */
const StatsRow = memo(function StatsRow({ stats }: { stats: OwnerStats }) {
  const { colors, text } = useTheme();
  const t = useT();

  const cells = [
    { label: t("userProfile.statListings"), value: String(stats.listings) },
    { label: t("userProfile.statViews"), value: compact(stats.views) },
    {
      label: t("userProfile.statRating"),
      value: stats.ratingAvg.toFixed(1),
      // Only the rating needs a second line: "4.8" means nothing without
      // knowing whether it came from three people or three hundred.
      hint:
        stats.ratingCount > 0
          ? t("userProfile.ratingFrom", { count: stats.ratingCount })
          : undefined,
    },
  ];

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surfaceRaised,
        borderRadius: radii.lg,
        paddingVertical: spacing.md,
      }}
    >
      {cells.map((cell, i) => (
        <View
          key={cell.label}
          style={{
            flex: 1,
            alignItems: "center",
            gap: 2,
            // Hairlines between, not around: the row reads as one block.
            borderLeftWidth: i === 0 ? 0 : 1,
            borderLeftColor: colors.border,
          }}
        >
          <Text style={{ ...type.heading, fontSize: 19 }}>{cell.value}</Text>
          <Text style={text.caption} numberOfLines={1}>
            {cell.label}
          </Text>
          {cell.hint ? (
            <Text
              style={{ ...type.caption, fontSize: 11, color: colors.textFaint }}
              numberOfLines={1}
            >
              {cell.hint}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
});

/** 1200 → "1.2k". A seller with 40 000 views would otherwise push the three
 *  columns out of line on a narrow phone. */
function compact(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k < 10 ? k.toFixed(1) : Math.round(k)}k`;
}
