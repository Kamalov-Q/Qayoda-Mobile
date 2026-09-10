// app/chat/[id].tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Avatar, ImageViewer } from "../../src/components/ui";
import { spacing, radii } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT, useLanguage } from "../../src/i18n";
import { confirm } from "../../src/lib/alerts";
import { getChatSocket } from "../../src/lib/chat-socket";
import {
  chatApi,
  type ChatMessage,
  type Conversation,
} from "../../src/features/chat/api/chat.api";
import { clearUnread } from "../../src/features/chat/utils/cache";
import { useMessages } from "../../src/features/chat/hooks/useMessages";
import { useSendMessage } from "../../src/features/chat/hooks/useSendMessage";
import { MessageBubble } from "../../src/features/chat/components/MessageBubble";
import { TypingIndicator } from "../../src/features/chat/components/TypingIndicator";
import { ChatInput } from "../../src/features/chat/components/ChatInput";
import {
  MessageActionSheet,
  type MessageAction,
} from "../../src/features/chat/components/MessageActionSheet";
import { useAuthStore } from "../../src/features/auth/store/auth.store";
import { Image } from "expo-image";
import { resolveMediaUrl } from "../../src/lib/media-url";
import { listingApi, type Listing } from "../../src/features/listings/api/listings.api";
import { usersApi } from "../../src/features/users/api/users.api";
import {
  usePriceFormatter,
  useSpecsFormatter,
} from "../../src/features/listings/utils/format";
import { useStartConversation } from "../../src/features/chat/hooks/useStartConversation";

export default function ChatThreadScreen() {
  const { id, listingId, prefill } = useLocalSearchParams<{
    id: string;
    listingId?: string;
    prefill?: string;
  }>();
  // "new" + a listing = draft mode: the composer opens prefilled and NOTHING
  // exists server-side until the user sends — the send creates the thread and
  // this screen is replaced by the real one.
  const isDraft = id === "new" && !!listingId;
  const userId = useAuthStore((s) => s.user?.id);
  const { colors, text } = useTheme();
  const t = useT();
  const language = useLanguage();
  const headerHeight = useHeaderHeight();

  const { data: conversation } = useQuery({
    queryKey: ["chat", "conversation", id],
    queryFn: () => chatApi.getConversation(id),
    enabled: !isDraft,
  });

  const { data: draftListing } = useQuery({
    queryKey: ["listings", "byId", listingId],
    queryFn: () => listingApi.getById(listingId!),
    enabled: isDraft,
  });
  const ownerId = draftListing?.ownerId;
  // Old conversations predate `listingTitle` being denormalised onto the row;
  // the prefill then needs the listing itself or it says "Nomsiz e'lon".
  const { data: prefillListing } = useQuery({
    queryKey: ["listings", "byId", conversation?.listingId],
    queryFn: () => listingApi.getById(conversation!.listingId),
    enabled: prefill === "1" && !!conversation && !conversation.listingTitle,
  });
  const { data: ownerCard } = useQuery({
    queryKey: ["users", "profile", ownerId],
    queryFn: () => usersApi.getProfile(ownerId!),
    enabled: isDraft && !!ownerId,
  });
  const startChat = useStartConversation(listingId ?? "", true);

  const { data: messages, isLoading, loadOlder, loadingMore } = useMessages(
    id,
    !isDraft,
  );
  const send = useSendMessage(id);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [actionsFor, setActionsFor] = useState<ChatMessage | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  /**
   * Read on open, unconditionally. The unread messages may sit older than the
   * thirty this first page holds, and then no message in `messages` looks
   * unread while the inbox still shows a badge — which is exactly how a badge
   * survived opening the thread. The sweep is idempotent server-side.
   *
   * The local clear does not wait for the receipt to come back: the badge is
   * on the screen the user just left, and a round trip of latency there reads
   * as the bug rather than as loading.
   */
  useEffect(() => {
    if (isDraft) return;
    getChatSocket().emit("message:read", { conversationId: id });
    clearUnread(id);
  }, [id, isDraft]);

  // And again for anything that lands while the thread is open.
  useEffect(() => {
    if (isDraft || !messages?.length) return;
    const hasUnread = messages.some(
      (m) => m.senderId !== userId && !m.readAt && !m.deletedAt,
    );
    if (!hasUnread) return;
    getChatSocket().emit("message:read", { conversationId: id });
    clearUnread(id);
  }, [id, isDraft, messages, userId]);

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
    : isDraft
      ? (ownerCard?.fullName ?? t("chat.composeTitle"))
      : "";

  const openProfile = () => {
    const target = conversation?.other.id ?? (isDraft ? ownerId : undefined);
    if (target) router.push(`/profile/${target}`);
  };

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
          // Left, not centred: the avatar makes the title wide enough that
          // iOS's centred slot would squeeze the name, and sitting next to the
          // back chevron is the messenger convention anyway.
          headerTitleAlign: "left",
          // Our own chevron instead of the native one. With a custom, left-
          // aligned title the native header on Android let the title view
          // grow across the back slot, and the chevron underneath stopped
          // receiving taps — the thread became a dead end. A JS-owned button
          // has no such overlap and pops the same way.
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/(tabs)/chat")
              }
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t("common.back")}
              // Same capsule as the app's BackButton — a bare chevron read
              // as part of the title, not as a control.
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                marginLeft: Platform.OS === "ios" ? 0 : spacing.xs,
                marginRight: spacing.sm,
                borderRadius: radii.md,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
              })}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
          ),
          // Avatar + name + presence, and the whole thing opens the peer's
          // profile — the same target a tap on the title has in every
          // messenger, and the only route to their ads from inside a thread.
          headerTitle: () => (
            <Pressable
              onPress={openProfile}
              disabled={!conversation && !ownerId}
              accessibilityRole="button"
              accessibilityLabel={t("userProfile.openProfile")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                // Hug the content: a stretching title is what covered the
                // back button in the first place.
                alignSelf: "flex-start",
                flexShrink: 1,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Avatar
                uri={
                  conversation?.other.avatarThumbUrl ??
                  conversation?.other.avatarUrl ??
                  ownerCard?.avatarThumbUrl ??
                  ownerCard?.avatarUrl
                }
                name={otherName}
                size={34}
                online={conversation?.other.online}
              />
              <View style={{ flexShrink: 1 }}>
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
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // "padding" on BOTH platforms: with edge-to-edge enabled, Android no
        // longer resizes the window for the keyboard, so `undefined` left the
        // composer buried under it — typing was invisible.
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      >
        {isDraft ? (
          <DraftContext listing={draftListing} />
        ) : isLoading ? (
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

        {isDraft ? null : <TypingIndicator conversationId={id} />}

        <ChatInput
          conversationId={id}
          draft={isDraft}
          initialText={
            isDraft && draftListing
              ? t("chat.starterTemplate", {
                  title: draftListing.title ?? t("listings.untitled"),
                })
              : // Arrived from the listing page into an existing thread: the
                // same template lands in the box, still unsent, still theirs
                // to edit. From the inbox the box stays empty.
                prefill === "1" && conversation
                ? t("chat.starterTemplate", {
                    title:
                      conversation.listingTitle ??
                      prefillListing?.title ??
                      t("listings.untitled"),
                  })
                : undefined
          }
          onSend={isDraft ? (input) => startChat.mutate(input) : send}
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

/** What the draft is about, sitting where messages will be: the listing's
 *  photo and facts, plus the one-line explanation that nothing is sent yet. */
function DraftContext({ listing }: { listing: Listing | undefined }) {
  const { colors, text } = useTheme();
  const t = useT();
  const formatPrice = usePriceFormatter();
  const formatSpecs = useSpecsFormatter();

  if (!listing) {
    return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  }

  const offer = listing.offers.find((o) => o.isActive) ?? listing.offers[0];
  const thumb = resolveMediaUrl(
    (listing.images.find((i) => i.isPrimary) ?? listing.images[0])?.thumbUrl ??
      null,
  );

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.xl,
        gap: spacing.md,
      }}
    >
      <View
        style={{
          width: "100%",
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radii.xl,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radii.md,
            overflow: "hidden",
            backgroundColor: colors.surfaceRaised,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {thumb ? (
            <Image
              source={{ uri: thumb }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : (
            <Ionicons name="image-outline" size={22} color={colors.textFaint} />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          {offer ? (
            <Text style={text.bodyStrong} numberOfLines={1}>
              {formatPrice(offer.price, offer.currency, offer.purpose)}
            </Text>
          ) : null}
          <Text style={text.caption} numberOfLines={2}>
            {listing.title ?? t("listings.untitled")}
          </Text>
          {formatSpecs(listing) ? (
            <Text
              style={{ ...text.caption, color: colors.textMuted }}
              numberOfLines={1}
            >
              {formatSpecs(listing)}
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={{ ...text.caption, textAlign: "center" }}>
        {t("chat.draftHint")}
      </Text>
    </View>
  );
}
