import { Stack } from "expo-router";
import { Screen, HEADER_EDGES } from "../../src/components/ui";
import { useT } from "../../src/i18n";
import { ActivityList } from "../../src/features/activity/components/ActivityList";
import { ActivityRow } from "../../src/features/activity/components/ActivityRow";
import { useActivity } from "../../src/features/activity/hooks/useActivity";

export default function MyLikesScreen() {
  const t = useT();
  const query = useActivity("likes");

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={HEADER_EDGES}>
      <Stack.Screen options={{ title: t("activity.likes") }} />

      <ActivityList
        query={query}
        keyOf={(c) => c.id}
        emptyIcon="heart-outline"
        emptyTitle="activity.likesEmpty"
        emptyHint="activity.likesEmptyHint"
        renderItem={(c) => (
          <ActivityRow
            listing={c.listing}
            body={c.body}
            createdAt={c.createdAt}
            imageThumbUrl={c.imageThumbUrl}
            badge="heart"
          />
        )}
      />
    </Screen>
  );
}
