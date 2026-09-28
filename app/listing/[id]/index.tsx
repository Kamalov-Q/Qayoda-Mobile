import { memo, useState } from "react";
// app/listing/[id]/index.tsx
import {
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Share,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Button,
  Card,
  EmptyState,
  HEADER_EDGES,
  Avatar,
} from "../../../src/components/ui";
import { spacing, radii } from "../../../src/theme/tokens";
import { useTheme } from "../../../src/theme/useTheme";
import { useT, useLanguage, type TranslationKey } from "../../../src/i18n";
import { confirm } from "../../../src/lib/alerts";
import { useListing } from "../../../src/features/listings/hooks/useListing";
import type { RepairType } from "../../../src/features/listings/api/listings.api";
import { useListingLive } from "../../../src/features/listings/hooks/useListingLive";
import {
  useArchiveListing,
  useRestoreListing,
} from "../../../src/features/listings/hooks/useCreateListing";
import {
  useIsSaved,
  useToggleSave,
} from "../../../src/features/listings/hooks/useSavedListings";
import { ListingImageCarousel } from "../../../src/features/listings/components/ListingImageCarousel";
import { ListingLocationMap } from "../../../src/features/listings/components/ListingLocationMap";
import { SimilarListings } from "../../../src/features/listings/components/SimilarListings";
import { ReportListingSheet } from "../../../src/features/listings/components/ReportListingSheet";
import { useConversations } from "../../../src/features/chat/hooks/useConversations";
import { OfferBadge } from "../../../src/features/listings/components/OfferBadge";
import {
  htmlToText,
  useRelativeDate,
} from "../../../src/features/listings/utils/format";
import { useAuthStore } from "../../../src/features/auth/store/auth.store";
import { requireAuth, requirePhone } from "../../../src/features/auth/guest";
import { usePresence } from "../../../src/features/chat/hooks/usePresence";
import { useCategories } from "../../../src/features/listings/hooks/useCategories";
import { useAmenities } from "../../../src/features/listings/hooks/useAmenities";
import { PresenceStatus } from "../../../src/features/chat/components/PresenceStatus";
import { ReviewsSection } from "../../../src/features/reviews/components/ReviewsSection";
import { CommentsSection } from "../../../src/features/comments/components/CommentsSection";

/** The six levels, as the detail page names them. */
const REPAIR_LABELS: Record<RepairType, TranslationKey> = {
  NEEDS_REPAIR: "add.repairNeeds",
  AVERAGE: "add.repairAverage",
  COSMETIC: "add.repairCosmetic",
  EURO: "add.repairEuro",
  DESIGNER: "add.repairDesigner",
  CAPITAL: "add.repairCapital",
};

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: listing, isLoading, isError, refetch } = useListing(id);
  const userId = useAuthStore((s) => s.user?.id);
  const archive = useArchiveListing();
  const restore = useRestoreListing();
  const isSaved = useIsSaved(id ?? "");
  const toggleSave = useToggleSave();
  const { colors, text } = useTheme();
  const t = useT();
  const language = useLanguage();
  // Categories are admin-managed; the name comes from the server's list.
  const { nameOf: categoryName } = useCategories();
  const { nameOf: amenityName } = useAmenities();
  const [reporting, setReporting] = useState(false);
  // For "Xabar yozish": an existing thread about THIS listing reopens instead
  // of drafting a duplicate — the server would merge them on send anyway, but
  // reopening shows the history immediately.
  const { data: conversations } = useConversations();
  // Called before the early returns (hooks can't be conditional); an owner
  // looking at their own listing doesn't need to be told they're online.
  const ownerPresence = usePresence(
    listing && listing.ownerId !== userId ? listing.ownerId : undefined,
  );

  // Also before the early returns, and for the same reason. Records this
  // visit and then tracks the count live over the listings socket.
  // Records the view, then keeps every counter on this page moving: views,
  // comments and the rating all land in the cached listing below.
  useListingLive(listing?.id);
  const relativeDate = useRelativeDate();

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

  // A seller who never filled in their name still needs something to tap.
  const ownerName =
    [listing.owner?.name, listing.owner?.surname].filter(Boolean).join(" ") ||
    t("chat.unknownUser");

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
    { key: "listings.specType", value: categoryName(listing.category) },
    // Above the measurements: who is selling and whether the block is new
    // are what a buyer decides on before they read a single number.
    {
      key: "listings.specSeller",
      value: listing.sellerType
        ? t(
            listing.sellerType === "OWNER"
              ? "add.sellerTypeOwner"
              : "add.sellerTypeRealtor",
          )
        : null,
    },
    {
      key: "listings.specRepair",
      value: listing.repairType ? t(REPAIR_LABELS[listing.repairType]) : null,
    },
    {
      key: "listings.specBuilding",
      value: listing.buildingType
        ? t(
            listing.buildingType === "NEW"
              ? "add.buildingTypeNew"
              : "add.buildingTypeSecondary",
          )
        : null,
    },
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
    // HTML first: it is what the seller wrote, and it still carries the
    // line breaks even for listings saved while stripHtml was flattening
    // them. `descriptionText` is the fallback for rows that have no HTML.
    htmlToText(listing.descriptionHtml) ||
    listing.descriptionText?.trim() ||
    "";

  const posted = relativeDate(listing.publishedAt ?? listing.createdAt);

  const isArchived = listing.status === "ARCHIVED";

  // Archiving is destructive (the photos go with it), so it asks first.
  // Restoring only puts the listing back, so it just runs.
  /**
   * Share the listing. A deep link the app can open, with the title as the
   * message — pasted into Telegram, that is what the other person sees.
   */
  const onShare = () => {
    void Share.share({
      title: listing.title ?? undefined,
      // A deep link built from the app's own scheme. When the public site
      // exists this becomes an https URL — which is the version that works
      // for someone who does not have the app yet.
      message: `${listing.title ?? t("listings.untitled")}\n${Linking.createURL(
        `/listing/${listing.id}`,
      )}`,
    }).catch(() => {
      // Dismissing the sheet rejects on some platforms; that is not an error.
    });
  };

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
        <View>
          <ListingImageCarousel images={listing.images} />

          {/* One cluster, top-right: share, save, report. Grouped in a
              single capsule because they are all "things you do about this
              listing" — three separate floating discs read as three
              unrelated controls and eat the photo. */}
          <View
            style={{
              position: "absolute",
              top: spacing.md,
              right: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              borderRadius: radii.pill,
              backgroundColor: colors.imageScrim,
            }}
          >
            <PhotoAction
              icon="paper-plane-outline"
              label={t("listings.share")}
              onPress={onShare}
            />

            {/* Signed-in only: a guest has no saved set, so the heart would
                have nothing to fill in. */}
            {userId ? (
              <PhotoAction
                icon={isSaved ? "heart" : "heart-outline"}
                tint={isSaved ? colors.danger : undefined}
                label={t(isSaved ? "saved.unsave" : "saved.save")}
                selected={isSaved}
                disabled={toggleSave.isPending}
                onPress={() =>
                  toggleSave.mutate({
                    listingId: listing.id,
                    listing,
                    next: !isSaved,
                  })
                }
              />
            ) : null}

            {!isOwner ? (
              <PhotoAction
                icon="alert-circle-outline"
                label={t("report.action")}
                onPress={() => requirePhone(() => setReporting(true))}
              />
            ) : null}
          </View>
        </View>

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

            {/* How this listing is doing, under the name of what it is. It
                used to ride the photo, opposite the save heart, where it read
                well and then scrolled away — and the number is worth more to
                someone deciding than to someone still looking at the picture.

                Views are live: they move while the page is open, because
                other people are opening it at the same time. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <MetaStat
                icon="eye-outline"
                value={String(listing.viewCount)}
                label={t("listings.viewCount", { count: listing.viewCount })}
              />
              <MetaStat
                icon="chatbubble-outline"
                value={String(listing.commentCount)}
                label={t("comments.title")}
              />
              <MetaStat
                icon="time-outline"
                value={posted}
                label={t("listings.posted")}
              />
            </View>

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
                    style={{
                      ...text.bodyStrong,
                      flexShrink: 1,
                      textAlign: "right",
                    }}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          {/* The boundary is the app's whole pitch — the detail page is
              exactly where it has to show up. */}
          <View style={{ gap: spacing.sm }}>
            <Text style={text.label}>{t("location.title")}</Text>
            <ListingLocationMap
              coordinates={listing.geom?.coordinates}
              centroid={listing.centroid?.coordinates}
              address={listing.address}
            />
          </View>

          {listing.properties?.length ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={text.label}>{t("listings.propertiesTitle")}</Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                {listing.properties.map((key) => (
                  <View
                    key={key}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: 6,
                      borderRadius: radii.pill,
                      borderWidth: 1,
                      borderColor: colors.primaryBorder,
                      backgroundColor: colors.primarySoft,
                    }}
                  >
                    <Text style={{ ...text.caption, color: colors.primary }}>
                      {amenityName(key)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
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
                title={t(
                  isArchived ? "listings.unarchive" : "listings.archive",
                )}
                icon={isArchived ? "arrow-undo-outline" : "archive-outline"}
                variant={isArchived ? "secondary" : "danger"}
                loading={archive.isPending || restore.isPending}
                onPress={onToggleArchive}
              />
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              {/* Who is selling — a name and a face carry more than "Sotuvchi",
                  and the whole row opens their profile and their other ads.
                  Through requireAuth: the profile endpoint needs a session,
                  so a guest is sent to sign in rather than to a 401. */}
              {listing.owner ? (
                <Pressable
                  onPress={() =>
                    requireAuth(() =>
                      router.push(`/profile/${listing.owner!.id}`),
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t("userProfile.openProfile")}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    padding: spacing.md,
                    borderRadius: radii.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: pressed
                      ? colors.surfaceRaised
                      : colors.surface,
                  })}
                >
                  <Avatar
                    uri={
                      listing.owner.avatarThumbUrl ?? listing.owner.avatarUrl
                    }
                    name={ownerName}
                    size={48}
                    online={ownerPresence?.online}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.xs,
                      }}
                    >
                      <Text style={text.bodyStrong} numberOfLines={1}>
                        {ownerName}
                      </Text>
                      {listing.owner.isVerifiedRealtor ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={colors.primary}
                        />
                      ) : null}
                    </View>
                    {/* Presence when it is known, otherwise how long they have
                        been on the app — both answer "can I trust a reply?" */}
                    {ownerPresence ? (
                      <PresenceStatus presence={ownerPresence} />
                    ) : (
                      <Text style={text.caption}>
                        {t("userProfile.memberSince", {
                          date: new Date(
                            listing.owner.createdAt,
                          ).toLocaleDateString(language, {
                            year: "numeric",
                            month: "long",
                          }),
                        })}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textFaint}
                  />
                </Pressable>
              ) : (
                // The account is gone; the listing outlives it.
                <PresenceStatus
                  presence={ownerPresence}
                  prefix={t("listings.seller")}
                />
              )}
              {/* The way in for everyone else — guests included: the tap routes
                through requirePhone, so a signed-out user lands on the login
                flow instead of a silent 401, and one without a verified
                number is asked for it before a stranger's inbox is opened.
                Sending the opener is what creates the conversation, so the
                first message is written for them. */}
              <Button
                title={t("chat.contactOwner")}
                icon="chatbubble-ellipses-outline"
                // Opens the thread in DRAFT mode: composer prefilled, nothing
                // sent until the buyer presses send themselves.
                onPress={() =>
                  requirePhone(() => {
                    const existing = conversations?.find(
                      (c) => c.listingId === listing.id && c.role === "guest",
                    );
                    if (existing) {
                      router.push({
                        pathname: "/chat/[id]",
                        params: { id: existing.id, prefill: "1" },
                      });
                      return;
                    }
                    router.push({
                      pathname: "/chat/[id]",
                      params: { id: "new", listingId: listing.id },
                    });
                  })
                }
              />
            </View>
          )}

          {/* Reporting moved up into the photo's action cluster — two ways
              to the same sheet, one of them buried under a scroll, is one
              way too many. */}

          {/* Above "similar listings" on purpose: what people said about
              THIS place belongs before the offer to go look at another one. */}
          <ReviewsSection listingId={listing.id} isOwner={isOwner} />

          {/* Under the reviews: a rating is a verdict on the place, the
              thread below is the questions people still have about it. */}
          <CommentsSection listingId={listing.id} />

          <SimilarListings
            listingId={listing.id}
            purpose={activeOffers[0]?.purpose ?? "SALE"}
          />
        </View>
      </ScrollView>

      <ReportListingSheet
        listingId={listing.id}
        visible={reporting}
        onClose={() => setReporting(false)}
      />
    </Screen>
  );
}

/**
 * One button in the photo's action cluster. Uniform 44pt targets so the three
 * of them read as one control strip rather than three sizes of disc.
 */
function PhotoAction({
  icon,
  label,
  tint,
  selected,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
        transform: [{ scale: pressed ? 0.9 : 1 }],
      })}
    >
      <Ionicons name={icon} size={21} color={tint ?? "#FFFFFF"} />
    </Pressable>
  );
}

/**
 * One figure on the line under the title: an icon and a number, no sentence.
 * A readout rather than a control — the screen already has a row of things to
 * press, and these three are facts about the listing, not offers to act.
 */
const MetaStat = memo(function MetaStat({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | null;
  label: string;
}) {
  const { colors, text } = useTheme();

  if (!value) return null;

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}
    >
      <Ionicons name={icon} size={14} color={colors.textFaint} />
      <Text style={{ ...text.caption, color: colors.textMuted }}>{value}</Text>
    </View>
  );
});
