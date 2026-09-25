// app/(tabs)/saved.tsx
import { useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import {
  Screen,
  EmptyState,
  BackButton,
  TAB_EDGES,
} from "../../src/components/ui";
import { spacing } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";
import { useSavedListings } from "../../src/features/listings/hooks/useSavedListings";
import { ListingCard } from "../../src/features/listings/components/ListingCard";

export default function SavedScreen() {
  const { text, colors } = useTheme();
  const t = useT();
  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSavedListings();

  const onPress = useCallback((id: string) => router.push(`/listing/${id}`), []);

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={TAB_EDGES}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          gap: 2,
        }}
      >
        {/* This screen left the tab bar (`href: null`) and is now only ever
            pushed — from "my activity". Without a way back it is a dead end,
            and the sibling activity screens all have one from the stack
            header this one does not get. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <BackButton fallback="/activity" />
          <Text style={{ ...text.title, flex: 1 }} numberOfLines={1}>
            {t("saved.title")}
          </Text>
        </View>
        {!isLoading && !isError && data?.length ? (
          <Text style={text.caption}>
            {t("listings.countFound", { count: data.length })}
          </Text>
        ) : null}
      </View>

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
          data={data}
          keyExtractor={(item) => item.id}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator
                color={colors.primary}
                style={{ paddingVertical: 16 }}
              />
            ) : null
          }
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
              icon="heart-outline"
              title={t("saved.empty")}
              description={t("saved.emptyHint")}
              actionLabel={t("saved.browse")}
              onAction={() => router.push("/(tabs)/sotuv")}
            />
          }
          renderItem={({ item }) => (
            <ListingCard listing={item} onPress={onPress} />
          )}
        />
      )}
    </Screen>
  );
}
