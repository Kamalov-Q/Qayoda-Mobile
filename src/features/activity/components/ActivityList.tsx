// The body of all three activity screens: one paged list, an empty state, and
// the row the caller renders. Only the data and the wording differ, so only
// those are props.
import { FlatList, ActivityIndicator, RefreshControl } from "react-native";
import type { ReactElement } from "react";
import { EmptyState } from "@/src/components/ui";
import { spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT, type TranslationKey } from "@/src/i18n";
import { errorMessage } from "@/src/lib/api-error";
import type { Ionicons } from "@expo/vector-icons";

interface Props<T> {
  query: {
    items: T[];
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isRefetching: boolean;
    refetch: () => void;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => void;
  };
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactElement;
  emptyIcon: keyof typeof Ionicons.glyphMap;
  emptyTitle: TranslationKey;
  emptyHint: TranslationKey;
}

export function ActivityList<T>({
  query,
  keyOf,
  renderItem,
  emptyIcon,
  emptyTitle,
  emptyHint,
}: Props<T>) {
  const { colors } = useTheme();
  const t = useT();

  if (query.isLoading) {
    return (
      <ActivityIndicator
        style={{ marginTop: spacing.xxl }}
        color={colors.primary}
      />
    );
  }

  if (query.isError) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        tone="danger"
        title={t("listings.loadError")}
        description={query.error ? errorMessage(query.error) : undefined}
        actionLabel={t("common.retry")}
        onAction={query.refetch}
      />
    );
  }

  return (
    <FlatList<T>
      data={query.items}
      keyExtractor={keyOf}
      contentContainerStyle={{
        padding: spacing.lg,
        gap: spacing.sm,
        flexGrow: 1,
      }}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={query.refetch}
          tintColor={colors.primary}
        />
      }
      ListEmptyComponent={
        <EmptyState
          icon={emptyIcon}
          title={t(emptyTitle)}
          description={t(emptyHint)}
        />
      }
      renderItem={({ item }) => renderItem(item)}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      }}
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <ActivityIndicator color={colors.primary} />
        ) : null
      }
    />
  );
}
