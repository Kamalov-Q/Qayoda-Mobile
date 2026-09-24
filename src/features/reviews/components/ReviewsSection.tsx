// The reviews block on a listing page: the summary, a couple of reviews, and
// the way in to write one. Deliberately not the whole list — the detail page
// is already long, and "all 48 reviews" is its own screen.
import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { Button } from "@/src/components/ui";
import { confirm } from "@/src/lib/alerts";
import { requirePhone } from "@/src/features/auth/guest";
import { RatingSummary } from "./RatingSummary";
import { ReviewCard } from "./ReviewCard";
import { ReviewSheet } from "./ReviewSheet";
import { useDeleteReview, useReviews } from "../hooks/useReviews";

/** How many reviews the listing page shows before handing over to the list. */
const PREVIEW = 3;

interface Props {
  listingId: string;
  /** Owners read their reviews but cannot leave one on their own listing. */
  isOwner: boolean;
}

export function ReviewsSection({ listingId, isOwner }: Props) {
  const { colors, text } = useTheme();
  const t = useT();
  const [writing, setWriting] = useState(false);
  const { items, summary, mine, isLoading } = useReviews(listingId);
  const remove = useDeleteReview(listingId);

  const onDelete = () =>
    confirm({
      titleKey: "reviews.deleteTitle",
      messageKey: "reviews.deleteMessage",
      confirmKey: "common.delete",
      destructive: true,
      onConfirm: () => remove.mutate(),
    });

  if (isLoading) {
    return (
      <View style={{ paddingVertical: spacing.lg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const count = summary?.count ?? 0;
  const preview = items.slice(0, PREVIEW);

  return (
    <View style={{ gap: spacing.md }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={text.heading}>{t("reviews.title")}</Text>
        {count > PREVIEW ? (
          <Pressable
            onPress={() => router.push(`/listing/${listingId}/reviews`)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={{ ...text.caption, color: colors.primary, fontWeight: "600" }}
            >
              {t("reviews.seeAll", { count })}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      {count > 0 ? (
        <RatingSummary
          average={summary?.average ?? null}
          count={count}
          distribution={
            summary?.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
          }
        />
      ) : (
        // Not an EmptyState card: on a listing page an empty reviews block
        // should read as an invitation, not as something having gone wrong.
        <View
          style={{
            gap: spacing.xs,
            padding: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: colors.border,
          }}
        >
          <Text style={text.bodyStrong}>{t("reviews.emptyTitle")}</Text>
          <Text style={text.caption}>
            {t(isOwner ? "reviews.emptyOwner" : "reviews.emptyHint")}
          </Text>
        </View>
      )}

      {preview.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          own={!!mine && review.id === mine.id}
          onEdit={() => setWriting(true)}
          onDelete={onDelete}
        />
      ))}

      {/* Owners get no button: the server refuses a review of your own
          listing, so offering it would only produce a 403. Everyone else does
          — requirePhone sends a guest to sign in and a Telegram/Google user
          with no number to the one-screen flow that adds one. */}
      {!isOwner ? (
        <Button
          title={t(mine ? "reviews.editMine" : "reviews.write")}
          icon={mine ? "create-outline" : "star-outline"}
          variant="secondary"
          onPress={() => requirePhone(() => setWriting(true))}
        />
      ) : null}

      <ReviewSheet
        listingId={listingId}
        visible={writing}
        existing={mine}
        onClose={() => setWriting(false)}
      />
    </View>
  );
}
