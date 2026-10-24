// People, by name — the "Odamlar" segment of the home search.
//
// A list of rows rather than a grid of avatars: the thing that decides
// whether a seller is worth a tap is their name, their badge and how much
// they have posted, and none of that survives being shrunk to a circle.
import { memo, useCallback } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, EmptyState } from "@/src/components/ui";
import { SearchLoading } from "./SearchStates";
import { spacing, radii } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { VerifiedBadge } from "@/src/features/users/components/VerifiedBadge";
import { useUserSearch } from "@/src/features/users/hooks/useUserSearch";
import type { UserSearchResult } from "@/src/features/users/api/users.api";

export function PeopleResults({
  query,
  contentPaddingTop = 0,
}: {
  /** Already debounced by the field that collected it. */
  query: string;
  /** Clears the floating header bar, as the feed below it does. */
  contentPaddingTop?: number;
}) {
  const { colors } = useTheme();
  const t = useT();
  const search = useUserSearch(query);

  const openProfile = useCallback((id: string) => {
    router.push(`/profile/${id}`);
  }, []);

  // Browse and search share one list, so there is no "type something"
  // state — only a first load, and a search that matched nobody.
  if (search.isLoading) {
    return <SearchLoading paddingTop={contentPaddingTop} />;
  }

  return (
    <FlatList
      data={search.items}
      keyExtractor={(u) => u.id}
      contentContainerStyle={{
        padding: spacing.md,
        paddingTop: contentPaddingTop + spacing.md,
        paddingBottom: spacing.xxl,
        gap: spacing.sm,
      }}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <PersonRow person={item} onPress={openProfile} />
      )}
      onEndReached={() => {
        if (search.hasNextPage && !search.isFetchingNextPage) {
          void search.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        search.isFetchingNextPage ? (
          <ActivityIndicator
            style={{ padding: spacing.md }}
            color={colors.primary}
          />
        ) : null
      }
      ListEmptyComponent={
        // "Nobody matched that" and "there are no sellers yet" are different
        // facts; the second only happens on an empty marketplace.
        <EmptyState
          icon={search.searching ? "search-outline" : "person-outline"}
          title={
            search.searching ? t("search.noPeople") : t("users.directoryEmpty")
          }
        />
      }
    />
  );
}


const PersonRow = memo(function PersonRow({
  person,
  onPress,
}: {
  person: UserSearchResult;
  onPress: (id: string) => void;
}) {
  const { colors, text } = useTheme();
  const t = useT();

  const fullName =
    [person.name, person.surname].filter(Boolean).join(" ") || t("chat.unknownUser");

  return (
    <Pressable
      onPress={() => onPress(person.id)}
      // "link", not "button": this navigates to a profile. Same reason the
      // listing cards use it — see ListingGridCard.
      accessibilityRole="link"
      accessibilityLabel={fullName}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
      })}
    >
      <Avatar uri={person.avatarThumbUrl} name={fullName} size={48} />

      <View style={{ flex: 1, gap: 2 }}>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
        >
          <Text style={text.bodyStrong} numberOfLines={1}>
            {fullName}
          </Text>
          {person.isVerifiedRealtor ? <VerifiedBadge size={15} /> : null}
        </View>

        {/* The two numbers that say "worth a tap", or — for somebody the
            viewer has blocked — the one fact that matters more than either.
            Replacing the counts rather than sitting beside them: the row has
            one line, and "you blocked this person" is why the profile behind
            it will look empty when they tap it. */}
        {person.blockedByMe ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            <Ionicons name="ban-outline" size={13} color={colors.danger} />
            <Text style={{ ...text.caption, color: colors.danger }}>
              {t("blocks.badge")}
            </Text>
          </View>
        ) : (
          <Text style={text.caption} numberOfLines={1}>
            {/* Listings first: this is a sellers directory, and how much
                somebody has posted is what the reader is weighing. */}
            <Text style={{ color: colors.text }}>
              {t("search.listingCount", { count: person.listingCount })}
            </Text>
            {person.followerCount
              ? ` · ${t("follows.followerCount", { count: person.followerCount })}`
              : ""}
          </Text>
        )}
      </View>

      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.textFaint}
      />
    </Pressable>
  );
});
