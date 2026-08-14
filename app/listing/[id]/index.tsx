// app/listing/[id]/index.tsx
import { Text, View, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Button,
  Card,
  EmptyState,
  HEADER_EDGES,
} from "../../../src/components/ui";
import { spacing, radii } from "../../../src/theme/tokens";
import { useTheme } from "../../../src/theme/useTheme";
import { useT, type TranslationKey } from "../../../src/i18n";
import { confirm } from "../../../src/lib/alerts";
import { useListing } from "../../../src/features/listings/hooks/useListing";
import {
  useArchiveListing,
  useRestoreListing,
} from "../../../src/features/listings/hooks/useCreateListing";
import { ListingImageCarousel } from "../../../src/features/listings/components/ListingImageCarousel";
import { OfferBadge } from "../../../src/features/listings/components/OfferBadge";
import { htmlToText } from "../../../src/features/listings/utils/format";
import { useAuthStore } from "../../../src/features/auth/store/auth.store";

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: listing, isLoading, isError, refetch } = useListing(id);
  const userId = useAuthStore((s) => s.user?.id);
  const archive = useArchiveListing();
  const restore = useRestoreListing();
  const { colors, text } = useTheme();
  const t = useT();

  if (isLoading) {
    return (
      <Screen centered edges={HEADER_EDGES}>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (isError || !listing) {
    return (
      <Screen centered edges={HEADER_EDGES}>
        <EmptyState
          icon="alert-circle-outline"
          tone="danger"
          title={t(isError ? "listings.loadError" : "listings.notFound")}
          actionLabel={t("common.retry")}
          onAction={refetch}
        />
      </Screen>
    );
  }

  const isOwner = !!userId && userId === listing.ownerId;

  // Inactive offers are hidden, but a listing whose offers are all inactive
  // still needs a price on screen rather than an empty row.
  const activeOffers = listing.offers.filter((o) => o.isActive);
  const offers = activeOffers.length ? activeOffers : listing.offers;

  const floor =
    listing.floor == null
      ? null
      : listing.totalFloors == null
        ? String(listing.floor)
        : `${listing.floor}/${listing.totalFloors}`;

  const specs: { key: TranslationKey; value: string | null }[] = [
    { key: "listings.specType", value: t(`categories.${listing.category}`) },
    {
      key: "listings.specArea",
      value: listing.areaM2 ? `${Number(listing.areaM2)} m²` : null,
    },
    {
      key: "listings.specRooms",
      value:
        listing.rooms == null
          ? null
          : t("listings.roomsShort", { count: listing.rooms }),
    },
    { key: "listings.specFloor", value: floor },
    { key: "listings.specAddress", value: listing.address },
    { key: "listings.specPhone", value: listing.contactPhone },
  ];
  const rows = specs.filter((s) => s.value);

  // The API now returns a plain-text twin of the HTML; fall back to flattening
  // the markup ourselves for listings written before that column existed.
  const description =
    listing.descriptionText?.trim() || htmlToText(listing.descriptionHtml);

  const isArchived = listing.status === "ARCHIVED";

  // Archiving is destructive (the photos go with it), so it asks first.
  // Restoring only puts the listing back, so it just runs.
  const onToggleArchive = () => {
    if (isArchived) {
      restore.mutate(listing.id);
      return;
    }
    confirm({
      titleKey: "listings.archiveConfirmTitle",
      messageKey: "listings.archiveConfirmMessage",
      confirmKey: "listings.archive",
      destructive: true,
      onConfirm: () => archive.mutate(listing.id),
    });
  };

  return (
    // scroll={false}: this screen brings its own ScrollView, and Screen's would
    // have nested one inside the other. edges drop "top" — the stack header
    // already clears the notch.
    <Screen style={{ padding: 0 }} scroll={false} edges={HEADER_EDGES}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <ListingImageCarousel images={listing.images} />

        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          {offers.length ? (
            <View
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                flexWrap: "wrap",
              }}
            >
              {offers.map((o) => (
                <OfferBadge
                  key={o.id}
                  price={o.price}
                  currency={o.currency}
                  purpose={o.purpose}
                />
              ))}
            </View>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <Text style={text.title}>
              {listing.title ?? t("listings.untitled")}
            </Text>

            {/* The toggle's label alone doesn't say which state you're in —
                this does, and it explains why the listing is off the map. */}
            {listing.status !== "ACTIVE" ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                  borderRadius: radii.pill,
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons
                  name="archive-outline"
                  size={13}
                  color={colors.textMuted}
                />
                <Text style={text.label}>
                  {t(`statuses.${listing.status}`)}
                </Text>
              </View>
            ) : null}
          </View>

          {rows.length ? (
            <Card flush>
              {rows.map((row, index) => (
                <View
                  key={row.key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: spacing.md,
                    padding: spacing.md,
                    // Separators between rows only — a trailing hairline on
                    // the last row reads as an unfinished list.
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Text style={text.caption}>{t(row.key)}</Text>
                  <Text
                    style={{ ...text.bodyStrong, flexShrink: 1, textAlign: "right" }}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          {description ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={text.label}>{t("listings.description")}</Text>
              <Text style={text.body}>{description}</Text>
            </View>
          ) : null}

          {isOwner ? (
            <View style={{ gap: spacing.sm }}>
              <Button
                title={t("listings.editImages")}
                icon="images-outline"
                variant="secondary"
                onPress={() =>
                  router.push(`/listing/${listing.id}/edit-images`)
                }
              />
              {/* One toggle, labelled with what the tap will do. Archived
                  listings still open from "my listings", which is where the
                  way back has to live. */}
              <Button
                title={t(isArchived ? "listings.unarchive" : "listings.archive")}
                icon={isArchived ? "arrow-undo-outline" : "archive-outline"}
                variant={isArchived ? "secondary" : "danger"}
                loading={archive.isPending || restore.isPending}
                onPress={onToggleArchive}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
