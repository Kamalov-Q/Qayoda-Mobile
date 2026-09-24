import { Stack } from "expo-router";
import { Screen, HEADER_EDGES } from "../../src/components/ui";
import { useT } from "../../src/i18n";
import { ActivityList } from "../../src/features/activity/components/ActivityList";
import { ActivityRow } from "../../src/features/activity/components/ActivityRow";
import { useActivity } from "../../src/features/activity/hooks/useActivity";

export default function MyReviewsScreen() {
  const t = useT();
  const query = useActivity("reviews");

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={HEADER_EDGES}>
      <Stack.Screen options={{ title: t("activity.reviews") }} />

      <ActivityList
        query={query}
        keyOf={(r) => r.id}
        emptyIcon="star-outline"
        emptyTitle="activity.reviewsEmpty"
        emptyHint="activity.reviewsEmptyHint"
        renderItem={(r) => (
          <ActivityRow
            listing={r.listing}
            body={r.comment}
            createdAt={r.createdAt}
            rating={r.rating}
          />
        )}
      />
    </Screen>
  );
}
