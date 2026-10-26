// app/saved.tsx
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
  HEADER_EDGES,
  LoadingView,
} from "../src/components/ui";
import { spacing } from "../src/theme/tokens";
import { useTheme } from "../src/theme/useTheme";
import { useT } from "../src/i18n";
import { useSavedListings } from "../src/features/listings/hooks/useSavedListings";
import { ListingCard } from "../src/features/listings/components/ListingCard";

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
    <Screen style={{ padding: 0 }} scroll={false} edges={HEADER_EDGES}>
      {/* The count only. The screen used to repeat its own name here in
          display type, directly under the navigation bar already showing it —
          two titles, and the lower one truncated ("Избранные объяв…") because
          it had one line to say what the bar said in full. */}
      {!isLoading && !isError && data?.length ? (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xs,
          }}
        >
          <Text style={text.caption}>
            {t("listings.countFound", { count: data.length })}
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <LoadingView />
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
            ) : undefined
          }
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="heart-outline"
              title={t("saved.empty")}
              description={t("saved.emptyHint")}
              actionLabel={t("saved.browse")}
              onAction={() => router.push("/(tabs)/home")}
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
