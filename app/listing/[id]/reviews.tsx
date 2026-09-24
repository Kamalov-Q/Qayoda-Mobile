// Every review for one listing, paged. The listing page shows three; this is
// where "all 48" goes.
import { useState } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Button,
  EmptyState,
  HEADER_EDGES,
} from "../../../src/components/ui";
import { spacing } from "../../../src/theme/tokens";
import { useTheme } from "../../../src/theme/useTheme";
import { useT } from "../../../src/i18n";
import { errorMessage } from "../../../src/lib/api-error";
import { confirm } from "../../../src/lib/alerts";
import { requirePhone } from "../../../src/features/auth/guest";
import { useAuthStore } from "../../../src/features/auth/store/auth.store";
import { useListing } from "../../../src/features/listings/hooks/useListing";
import { RatingSummary } from "../../../src/features/reviews/components/RatingSummary";
import { ReviewCard } from "../../../src/features/reviews/components/ReviewCard";
import { ReviewSheet } from "../../../src/features/reviews/components/ReviewSheet";
import {
  useDeleteReview,
  useReviews,
} from "../../../src/features/reviews/hooks/useReviews";
import type { Review } from "../../../src/features/reviews/api/reviews.api";

export default function ListingReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, text } = useTheme();
  const t = useT();
  const [writing, setWriting] = useState(false);

  const userId = useAuthStore((s) => s.user?.id);
  // Only to answer "is this my listing?" — it is already in cache from the
  // detail page the reader came from, so this costs no request.
  const { data: listing } = useListing(id);
  const isOwner = !!userId && !!listing && listing.ownerId === userId;

  const reviews = useReviews(id);
  const remove = useDeleteReview(id!);

  const onDelete = () =>
    confirm({
      titleKey: "reviews.deleteTitle",
      messageKey: "reviews.deleteMessage",
      confirmKey: "common.delete",
      destructive: true,
      onConfirm: () => remove.mutate(),
    });

  const summary = reviews.summary;

  const header = summary ? (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <RatingSummary
        average={summary.average}
        count={summary.count}
        distribution={summary.distribution}
      />
      {!isOwner ? (
        <Button
          title={t(reviews.mine ? "reviews.editMine" : "reviews.write")}
          icon={reviews.mine ? "create-outline" : "star-outline"}
          variant="secondary"
          onPress={() => requirePhone(() => setWriting(true))}
        />
      ) : null}
    </View>
  ) : null;

  if (reviews.isLoading) {
    return (
      <Screen edges={HEADER_EDGES} scroll={false}>
        <Stack.Screen options={{ title: t("reviews.title") }} />
        <ActivityIndicator
          style={{ marginTop: spacing.xxl }}
          color={colors.primary}
        />
      </Screen>
    );
  }

  if (reviews.isError) {
    return (
      <Screen edges={HEADER_EDGES} scroll={false}>
        <Stack.Screen options={{ title: t("reviews.title") }} />
        <EmptyState
          icon="cloud-offline-outline"
          tone="danger"
          title={t("listings.loadError")}
          description={
            reviews.error ? errorMessage(reviews.error) : undefined
          }
          actionLabel={t("common.retry")}
          onAction={reviews.refetch}
        />
      </Screen>
    );
  }

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={HEADER_EDGES}>
      <Stack.Screen options={{ title: t("reviews.title") }} />

      <FlatList<Review>
        data={reviews.items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={reviews.isRefetching}
            onRefresh={reviews.refetch}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="star-outline"
            title={t("reviews.emptyTitle")}
            description={t(isOwner ? "reviews.emptyOwner" : "reviews.emptyHint")}
          />
        }
        renderItem={({ item }) => (
          <ReviewCard
            review={item}
            own={!!reviews.mine && item.id === reviews.mine.id}
            onEdit={() => setWriting(true)}
            onDelete={onDelete}
          />
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (reviews.hasNextPage && !reviews.isFetchingNextPage) {
            void reviews.fetchNextPage();
          }
        }}
        ListFooterComponent={
          reviews.isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} />
          ) : !reviews.hasNextPage && reviews.items.length ? (
            // Only once there is genuinely nothing left — saying "that's all"
            // while a next page is waiting to be fetched is a lie.
            <Text style={{ ...text.caption, textAlign: "center" }}>
              {t("reviews.allShown")}
            </Text>
          ) : null
        }
      />

      <ReviewSheet
        listingId={id!}
        visible={writing}
        existing={reviews.mine}
        onClose={() => setWriting(false)}
      />
    </Screen>
  );
}
