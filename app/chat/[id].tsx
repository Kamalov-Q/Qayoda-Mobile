// app/chat/[id].tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { spacing } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT, useLanguage } from "../../src/i18n";
import { confirm } from "../../src/lib/alerts";
import { getChatSocket } from "../../src/lib/chat-socket";
import {
  chatApi,
  type ChatMessage,
  type Conversation,
} from "../../src/features/chat/api/chat.api";
import { useMessages } from "../../src/features/chat/hooks/useMessages";
import { useSendMessage } from "../../src/features/chat/hooks/useSendMessage";
import { MessageBubble } from "../../src/features/chat/components/MessageBubble";
import { TypingIndicator } from "../../src/features/chat/components/TypingIndicator";
import { ChatInput } from "../../src/features/chat/components/ChatInput";
import {
  MessageActionSheet,
  type MessageAction,
} from "../../src/features/chat/components/MessageActionSheet";
import { ImageViewer } from "../../src/features/chat/components/ImageViewer";
import { useAuthStore } from "../../src/features/auth/store/auth.store";

export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const { colors, text } = useTheme();
  const t = useT();
  const language = useLanguage();
  const headerHeight = useHeaderHeight();

  const { data: conversation } = useQuery({
    queryKey: ["chat", "conversation", id],
    queryFn: () => chatApi.getConversation(id),
  });

  const { data: messages, isLoading, loadOlder, loadingMore } = useMessages(id);
  const send = useSendMessage(id);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [actionsFor, setActionsFor] = useState<ChatMessage | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  // Mark read on open + whenever a new incoming message lands while open
  useEffect(() => {
    if (!messages?.length) return;
    const hasUnread = messages.some(
      (m) => m.senderId !== userId && !m.readAt && !m.deletedAt,
    );
    if (hasUnread) getChatSocket().emit("message:read", { conversationId: id });
  }, [id, messages, userId]);

  const onLongPress = useCallback((m: ChatMessage) => {
    if (m.deletedAt || m.pending) return;
    setActionsFor(m);
  }, []);

  const actions = useMemo<MessageAction[]>(() => {
    const m = actionsFor;
    if (!m) return [];
    const mine = m.senderId === userId;

    const list: MessageAction[] = [
      {
        key: "reply",
        labelKey: "chat.reply",
        icon: "arrow-undo-outline",
        onPress: () => {
          setEditing(null);
          setReplyTo(m);
        },
      },
    ];

    if (mine && m.type === "TEXT") {
      list.push({
        key: "edit",
        labelKey: "common.edit",
        icon: "create-outline",
        onPress: () => {
          setReplyTo(null);
          setEditing(m);
        },
      });
    }

    if (mine) {
      list.push({
        key: "delete",
        labelKey: "common.delete",
        icon: "trash-outline",
        destructive: true,
        onPress: () =>
          confirm({
            titleKey: "common.delete",
            confirmKey: "common.delete",
            destructive: true,
            onConfirm: () =>
              getChatSocket().emit("message:delete", { messageId: m.id }),
          }),
      });
    }

    return list;
  }, [actionsFor, userId]);

  const submitEdit = useCallback(
    (body: string) => {
      if (!editing) return;
      getChatSocket().emit("message:edit", { messageId: editing.id, body });
    },
    [editing],
  );

  const otherName = conversation
    ? [conversation.other.name, conversation.other.surname]
        .filter(Boolean)
        .join(" ") || t("chat.unknownUser")
    : "";

  const lastSeenLabel = (other: Conversation["other"]): string => {
    if (other.online) return t("chat.online");
    if (!other.lastSeenAt) return "";
    const d = new Date(other.lastSeenAt);
    const isToday = new Date().toDateString() === d.toDateString();
    return t("chat.lastSeen", {
      when: isToday
        ? d.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString(language),
    });
  };

  return (
    // Not <Screen>: the thread owns its own keyboard handling, which under a
    // stack header needs the header height as the avoidance offset.
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["left", "right", "bottom"]}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: () => (
            <View>
              <Text style={text.heading} numberOfLines={1}>
                {otherName}
              </Text>
              {conversation ? (
                <Text
                  style={{
                    ...text.caption,
                    color: conversation.other.online
                      ? colors.primary
                      : colors.textMuted,
                  }}
                >
                  {lastSeenLabel(conversation.other)}
                </Text>
              ) : null}
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        {isLoading ? (
          <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
        ) : (
          <FlatList
            data={messages ?? []}
            keyExtractor={(m) => m.id}
            inverted
            onEndReached={loadOlder}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator
                  style={{ padding: spacing.md }}
                  color={colors.primary}
                />
              ) : null
            }
            contentContainerStyle={{ paddingVertical: spacing.md }}
            removeClippedSubviews
            initialNumToRender={20}
            maxToRenderPerBatch={12}
            windowSize={9}
            keyboardDismissMode="on-drag"
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                mine={item.senderId === userId}
                onLongPress={onLongPress}
                onPressImage={setPhoto}
              />
            )}
          />
        )}

        <TypingIndicator conversationId={id} />

        <ChatInput
          conversationId={id}
          onSend={send}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          editing={editing}
          onSubmitEdit={submitEdit}
          onClearEdit={() => setEditing(null)}
        />
      </KeyboardAvoidingView>

      <MessageActionSheet
        visible={!!actionsFor}
        actions={actions}
        onClose={() => setActionsFor(null)}
      />

      <ImageViewer uri={photo} onClose={() => setPhoto(null)} />
    </SafeAreaView>
  );
}
