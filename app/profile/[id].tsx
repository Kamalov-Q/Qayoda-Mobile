// app/profile/[id].tsx
import { useCallback, useState } from "react";
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
import { ListingCard } from "../../src/features/listings/components/ListingCard";
import type { Listing } from "../../src/features/listings/api/listings.api";

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, text } = useTheme();
  const t = useT();
  const language = useLanguage();

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useUserProfile(id);
  const [viewingAvatar, setViewingAvatar] = useState(false);

  const photo = data?.avatarUrl ?? data?.avatarThumbUrl ?? null;

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
          <Avatar uri={photo} name={data?.fullName} size={104} />
        </Pressable>
        <Text style={{ ...text.display, textAlign: "center" }}>{name}</Text>
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
            <ContactRow
              icon="mail-outline"
              label={t("userProfile.email")}
              value={data.email}
              href={`mailto:${data.email}`}
            />
          </Card>
        </View>
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
        data={data.listings}
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
