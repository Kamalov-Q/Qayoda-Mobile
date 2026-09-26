// app/profile/[id].tsx
import { useCallback, useMemo, useState } from "react";
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
  Card,
  Avatar,
  Button,
  EmptyState,
  ImageViewer,
  HEADER_EDGES,
} from "../../src/components/ui";
import { spacing, radii } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT, useLanguage } from "../../src/i18n";
import { errorMessage } from "../../src/lib/api-error";
import { resolveMediaUrl } from "../../src/lib/media-url";
import { useUserProfile } from "../../src/features/users/hooks/useUserProfile";
import { useUserListings } from "../../src/features/users/hooks/useUserListings";
import { ListingCard } from "../../src/features/listings/components/ListingCard";
import type { Listing } from "../../src/features/listings/api/listings.api";
import { usePresence } from "../../src/features/chat/hooks/usePresence";
import { useConversations } from "../../src/features/chat/hooks/useConversations";
import { requirePhone } from "../../src/features/auth/guest";
import { useToggleBlock } from "../../src/features/blocks/hooks/useBlocks";
import { confirm } from "../../src/lib/alerts";
import { useAuthStore } from "../../src/features/auth/store/auth.store";
import { PresenceStatus } from "../../src/features/chat/components/PresenceStatus";

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
  // Page one rides along with the profile; this fetches the rest on scroll.
  const more = useUserListings(id, data?.listingCount ?? 0);
  const listings = useMemo(
    () => [...(data?.listings ?? []), ...(more.data?.pages.flat() ?? [])],
    [data?.listings, more.data],
  );

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
    return listing
      ? { kind: "new" as const, listingId: listing.id }
      : null;
  }, [id, viewerId, conversations, listings]);

  const openListing = useCallback(
    (listingId: string) => router.push(`/listing/${listingId}`),
    [],
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

        {/* Write to them. Conversations here are bound to a listing, so this
            reopens the one you already have with this person, or starts one
            on their newest advert — which is what you would have tapped
            through to anyway. Hidden when there is neither: a button that
            can only fail is worse than no button. */}
        {chatTarget && !blocked ? (
          <Button
            title={t("chat.contactOwner")}
            icon="chatbubble-ellipses-outline"
            variant="secondary"
            onPress={() =>
              requirePhone(() =>
                chatTarget.kind === "existing"
                  ? // No `prefill`: that seeds the composer with the
                    // listing-enquiry boilerplate, which is right when you
                    // arrive from an advert and wrong when you arrive from a
                    // person you were already talking to.
                    router.push({
                      pathname: "/chat/[id]",
                      params: { id: chatTarget.id },
                    })
                  : router.push({
                      pathname: "/chat/[id]",
                      params: { id: "new", listingId: chatTarget.listingId },
                    }),
              )
            }
          />
        ) : null}
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

      {data ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ ...text.label, marginLeft: spacing.xs }}>
            {t("userProfile.contact")}
          </Text>
          <Card flush>
            <ContactRow
              icon="call-outline"
              label={t("userProfile.phone")}
              value={data.phoneNumber}
              emptyLabel={t("userProfile.noPhone")}
              href={
                data.phoneNumber
                  ? `tel:${data.phoneNumber.replace(/[^\d+]/g, "")}`
                  : null
              }
              first
            />
          </Card>
        </View>
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

      {data ? (
        <Text style={{ ...text.label, marginLeft: spacing.xs }}>
          {t("userProfile.ads")} · {data.listingCount}
        </Text>
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
          <EmptyState
            icon="home-outline"
            title={t("userProfile.noAds")}
            description={t("userProfile.noAdsHint")}
          />
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
 * One contact line. A missing number still gets a row rather than vanishing:
 * "not given" is an answer, and a card that silently loses a line reads as a
 * layout bug when you know the other person has a number.
 */
function ContactRow({
  icon,
  label,
  value,
  emptyLabel,
  href,
  first,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | null;
  emptyLabel?: string;
  href: string | null;
  first?: boolean;
}) {
  const { colors, text } = useTheme();

  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.pill,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text style={text.caption}>{label}</Text>
        <Text
          style={{
            ...text.bodyStrong,
            color: value ? colors.text : colors.textMuted,
          }}
          numberOfLines={1}
        >
          {value ?? emptyLabel}
        </Text>
      </View>

      {href ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      ) : null}
    </View>
  );

  if (!href) return body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      // Swallowed: a device with no dialer or mail client (a simulator, a
      // tablet) would otherwise crash the screen on a tap.
      onPress={() => Linking.openURL(href).catch(() => {})}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceRaised : "transparent",
      })}
    >
      {body}
    </Pressable>
  );
}
