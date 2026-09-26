// The people you have blocked. Telegram keeps this in settings; here it sits
// with the rest of "your activity", which is where everything else you have
// done to the app already lives.
import { View, Text, FlatList, ActivityIndicator, Pressable } from "react-native";
import { Stack, router } from "expo-router";
import { Avatar, Screen, EmptyState, HEADER_EDGES } from "../../src/components/ui";
import { spacing, radii } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT, useLanguage } from "../../src/i18n";
import { errorMessage } from "../../src/lib/api-error";
import { confirm } from "../../src/lib/alerts";
import {
  useBlocks,
  useToggleBlock,
} from "../../src/features/blocks/hooks/useBlocks";
import type { BlockedPerson } from "../../src/features/blocks/api/blocks.api";

export default function BlockedScreen() {
  const { colors, text } = useTheme();
  const t = useT();
  const language = useLanguage();
  const { data, isLoading, isError, error, refetch } = useBlocks();
  const toggle = useToggleBlock();

  const onUnblock = (person: BlockedPerson) =>
    confirm({
      titleKey: "blocks.unblock",
      confirmKey: "blocks.unblock",
      onConfirm: () => toggle.mutate({ userId: person.id, block: false }),
    });

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={HEADER_EDGES}>
      <Stack.Screen options={{ title: t("blocks.title") }} />

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
          description={error ? errorMessage(error) : undefined}
          actionLabel={t("common.retry")}
          onAction={refetch}
        />
      ) : (
        <FlatList<BlockedPerson>
          data={data ?? []}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.sm,
            flexGrow: 1,
          }}
          ListEmptyComponent={
            <EmptyState
              icon="ban-outline"
              title={t("blocks.emptyTitle")}
              description={t("blocks.emptyHint")}
            />
          }
          renderItem={({ item }) => {
            const name =
              [item.name, item.surname].filter(Boolean).join(" ") ||
              t("chat.unknownUser");
            return (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radii.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                {/* Their profile stays reachable: blocking someone is not a
                    reason to lose the way to check who they were. */}
                <Pressable
                  onPress={() => router.push(`/profile/${item.id}`)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    flex: 1,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Avatar uri={item.avatarThumbUrl} name={name} size={44} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={text.bodyStrong} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={text.caption}>
                      {new Date(item.blockedAt).toLocaleDateString(language, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => onUnblock(item)}
                  hitSlop={8}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Text
                    style={{
                      ...text.caption,
                      color: colors.primary,
                      fontWeight: "600",
                    }}
                  >
                    {t("blocks.unblock")}
                  </Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}
