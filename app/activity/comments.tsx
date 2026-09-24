import { Stack } from "expo-router";
import { Screen, HEADER_EDGES } from "../../src/components/ui";
import { useT } from "../../src/i18n";
import { ActivityList } from "../../src/features/activity/components/ActivityList";
import { ActivityRow } from "../../src/features/activity/components/ActivityRow";
import { useActivity } from "../../src/features/activity/hooks/useActivity";

export default function MyCommentsScreen() {
  const t = useT();
  const query = useActivity("comments");

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={HEADER_EDGES}>
      <Stack.Screen options={{ title: t("activity.comments") }} />

      <ActivityList
        query={query}
        keyOf={(c) => c.id}
        emptyIcon="chatbubble-outline"
        emptyTitle="activity.commentsEmpty"
        emptyHint="activity.commentsEmptyHint"
        renderItem={(c) => (
          <ActivityRow
            listing={c.listing}
            body={c.body}
            createdAt={c.createdAt}
            imageThumbUrl={c.imageThumbUrl}
            // A reply is marked, because out of its thread it otherwise reads
            // as a comment that answers nothing.
            badge={c.isReply ? "return-down-forward-outline" : undefined}
          />
        )}
      />
    </Screen>
  );
}
