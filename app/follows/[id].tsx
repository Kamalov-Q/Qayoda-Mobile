// Followers and following, as one screen with two tabs.
//
// One screen rather than two routes: the lists are identical in everything
// but which column they are read from, and a reader arriving at "followers"
// almost always wants a look at the other one too.
import { useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Avatar,
  DebouncedTextField,
  EmptyState,
  HEADER_EDGES,
  LoadingView,
  SegmentedControl,
} from "@/src/components/ui";
import { spacing, weight } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { errorMessage } from "@/src/lib/api-error";
import { useAuthStore } from "@/src/features/auth/store/auth.store";
import { FollowButton } from "@/src/features/follows/components/FollowButton";
import { useFollowList } from "@/src/features/follows/hooks/useFollow";
import type { FollowPerson } from "@/src/features/follows/api/follows.api";

type Tab = "followers" | "following";

export default function FollowsScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{
    id: string;
    tab?: Tab;
  }>();
  const { colors, text } = useTheme();
  const t = useT();
  const viewerId = useAuthStore((s) => s.user?.id);

  const [tab, setTab] = useState<Tab>(
    initialTab === "following" ? "following" : "followers",
  );
  /**
   * Narrows the list by name.
   *
   * Server-side, through the hook: these pages are 25 long, so filtering
   * what happens to be loaded would search the first screenful and silently
   * miss everyone below it. Kept across a tab switch on purpose — someone
   * checking whether they follow the person who follows them is looking for
   * the same name on both sides.
   */
  const [search, setSearch] = useState("");
  const list = useFollowList(id, tab, search);

  const segments = [
    { value: "followers" as const, label: t("follows.followers") },
    { value: "following" as const, label: t("follows.followingTitle") },
  ];

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={HEADER_EDGES}>
      <Stack.Screen
        options={{
          title:
            tab === "followers"
              ? t("follows.followers")
              : t("follows.followingTitle"),
        }}
      />

      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <SegmentedControl segments={segments} value={tab} onChange={setTab} />
        <DebouncedTextField
          placeholder={t("follows.searchPlaceholder")}
          icon="search-outline"
          initialValue={search}
          onChangeDebounced={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          round
        />
      </View>

      {list.isLoading ? (
        <LoadingView />
      ) : list.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          tone="danger"
          title={t("listings.loadError")}
          description={list.error ? errorMessage(list.error) : undefined}
          actionLabel={t("common.retry")}
          onAction={list.refetch}
        />
      ) : (
        <FlatList<FollowPerson>
          data={list.items}
          keyExtractor={(person) => person.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.xl,
            gap: spacing.sm,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching}
              onRefresh={list.refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            // "No followers yet" and "nobody here called that" are different
            // facts, and telling someone with 400 followers they have none
            // because they mistyped a name is the worse of the two mistakes.
            search.trim() ? (
              <EmptyState
                icon="search-outline"
                title={t("follows.noMatches")}
              />
            ) : (
              <EmptyState
                icon="people-outline"
                title={
                  tab === "followers"
                    ? t("follows.noFollowers")
                    : t("follows.noFollowing")
                }
              />
            )
          }
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) {
              void list.fetchNextPage();
            }
          }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/profile/${item.id}`)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingVertical: spacing.xs,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Avatar
                name={fullName(item, t("chat.unknownUser"))}
                uri={item.avatarThumbUrl ?? undefined}
                size={44}
              />

              <View style={{ flex: 1, gap: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Text
                    style={{ ...text.body, ...weight("600"), flexShrink: 1 }}
                    numberOfLines={1}
                  >
                    {fullName(item, t("chat.unknownUser"))}
                  </Text>
                  {item.isVerifiedRealtor ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={colors.primary}
                    />
                  ) : null}
                </View>
                <Text style={{ ...text.caption, color: colors.textFaint }}>
                  {t("follows.followerCount", { count: item.followerCount })}
                </Text>
              </View>

              {/* Actionable in place: the whole point of looking at an
                  agency's followers is finding people worth following. */}
              <FollowButton
                userId={item.id}
                isSelf={item.id === viewerId}
                size="sm"
              />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const fullName = (person: FollowPerson, fallback: string) =>
  [person.name, person.surname].filter(Boolean).join(" ") || fallback;
