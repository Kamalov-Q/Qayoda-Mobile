// app/(tabs)/chat.tsx
import { memo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Screen, EmptyState, Avatar, TAB_EDGES } from "../../src/components/ui";
import { spacing } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT, useLanguage } from "../../src/i18n";
import { useConversations } from "../../src/features/chat/hooks/useConversations";
import type { Conversation } from "../../src/features/chat/api/chat.api";

export default function ChatInboxScreen() {
  const { text, colors } = useTheme();
  const t = useT();
  const { data, isLoading, isError, refetch, isRefetching } =
    useConversations();

  const onPress = useCallback((id: string) => router.push(`/chat/${id}`), []);
  const onPressAvatar = useCallback(
    (userId: string) => router.push(`/profile/${userId}`),
    [],
  );

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={TAB_EDGES}>
      <View
        style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}
      >
        <Text style={text.display} numberOfLines={1}>
          {t("chat.title")}
        </Text>
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
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingTop: spacing.md, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title={t("chat.empty")}
              description={t("chat.emptyHint")}
            />
          }
          renderItem={({ item }) => (
            <ConversationRow
              item={item}
              onPress={onPress}
              onPressAvatar={onPressAvatar}
            />
          )}
        />
      )}
    </Screen>
  );
}

const ConversationRow = memo(function ConversationRow({
  item,
  onPress,
  onPressAvatar,
}: {
  item: Conversation;
  onPress: (id: string) => void;
  onPressAvatar: (userId: string) => void;
}) {
  const { colors, text } = useTheme();
  const t = useT();
  const language = useLanguage();

  const name =
    [item.other.name, item.other.surname].filter(Boolean).join(" ") ||
    t("chat.unknownUser");
  const time = item.lastMessageAt
    ? new Date(item.lastMessageAt).toLocaleTimeString(language, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <Pressable
      onPress={() => onPress(item.id)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? colors.surface : "transparent",
      })}
    >
      {/* The avatar opens the profile, the rest of the row opens the thread —
          the same split every messenger uses. hitSlop keeps the 48pt circle
          from being a fiddly target inside a row that is itself pressable. */}
      <Pressable
        onPress={() => onPressAvatar(item.other.id)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t("userProfile.openProfile")}
      >
        <Avatar
          uri={item.other.avatarThumbUrl ?? item.other.avatarUrl}
          name={name}
          size={48}
          online={item.other.online}
        />
      </Pressable>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ ...text.heading, flex: 1 }} numberOfLines={1}>
            {name}
          </Text>
          <Text style={text.caption}>{time}</Text>
        </View>
        {item.listingTitle ? (
          <Text
            style={{ ...text.caption, color: colors.primary }}
            numberOfLines={1}
          >
            {item.listingTitle}
          </Text>
        ) : null}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <Text style={{ ...text.caption, flex: 1 }} numberOfLines={1}>
            {item.lastMessagePreview ?? ""}
          </Text>
          {item.unreadCount > 0 ? (
            <View
              style={{
                minWidth: 22,
                height: 22,
                borderRadius: 11,
                paddingHorizontal: 6,
                backgroundColor: colors.primary,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.onPrimary,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {item.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});
