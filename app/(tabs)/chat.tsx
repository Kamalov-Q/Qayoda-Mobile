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
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT, useLanguage } from "../../src/i18n";
import { useConversations } from "../../src/features/chat/hooks/useConversations";
import type { Conversation } from "../../src/features/chat/api/chat.api";
import { useIsAuthed } from "../../src/features/auth/guest";
import { GuestPrompt } from "../../src/features/auth/components/GuestPrompt";
import { useSupportUnread } from "../../src/features/support/hooks/useSupport";

export default function ChatInboxScreen() {
  const { text, colors, shadow } = useTheme();
  const t = useT();
  const authed = useIsAuthed();
  const supportUnread = useSupportUnread();
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

      {!authed ? (
        <GuestPrompt subtitle={t("auth.guestChatSubtitle")} />
      ) : isLoading ? (
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
          // Room for the button to float over without covering the last row.
          contentInset={{ bottom: FAB_CLEARANCE }}
          ListFooterComponent={<View style={{ height: FAB_CLEARANCE }} />}
        />
      )}

      {/* The way to the support desk, from the screen people are already on
          when something has gone wrong with a conversation. Floating rather
          than a list row: it is not one of your chats, and sorting it in
          among them would either put it at the top forever or bury it. */}
      {authed ? (
        <Pressable
          onPress={() => router.push("/support")}
          accessibilityRole="button"
          accessibilityLabel={t("support.title")}
          style={({ pressed }) => ({
            position: "absolute",
            right: spacing.lg,
            bottom: spacing.lg,
            width: 56,
            height: 56,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
            transform: [{ scale: pressed ? 0.94 : 1 }],
            ...shadow.raised,
          })}
        >
          <Ionicons
            name="headset"
            size={26}
            color={colors.onPrimary}
          />

          {supportUnread > 0 ? (
            <View
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                minWidth: 22,
                height: 22,
                paddingHorizontal: 6,
                borderRadius: radii.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.danger,
                borderWidth: 2,
                borderColor: colors.bg,
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {supportUnread}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </Screen>
  );
}

/** Height the floating button needs kept clear at the bottom of the list. */
const FAB_CLEARANCE = 80;

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
