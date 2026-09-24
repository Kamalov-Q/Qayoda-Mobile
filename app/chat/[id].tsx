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
import { useMutation, useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useHeaderHeight } from "expo-router/react-navigation";
import { Avatar, ImageViewer, toast } from "../../src/components/ui";
import { spacing, radii, sizing } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT, useLanguage, type TranslationKey } from "../../src/i18n";
import { confirm } from "../../src/lib/alerts";
import { errorMessage } from "../../src/lib/api-error";
import { getChatSocket } from "../../src/lib/chat-socket";
import {
  chatApi,
  type ChatMessage,
  type Conversation,
} from "../../src/features/chat/api/chat.api";
import { clearUnread } from "../../src/features/chat/utils/cache";
import { useMessages } from "../../src/features/chat/hooks/useMessages";
import { formatPresence } from "../../src/features/chat/hooks/usePresence";
import { useSendMessage } from "../../src/features/chat/hooks/useSendMessage";
import { MessageBubble } from "../../src/features/chat/components/MessageBubble";
import { ReportChatSheet } from "../../src/features/chat/components/ReportChatSheet";
import { TypingIndicator } from "../../src/features/chat/components/TypingIndicator";
import { ChatInput } from "../../src/features/chat/components/ChatInput";
import { ForwardSheet } from "../../src/features/chat/components/ForwardSheet";
import {
  MessageActionSheet,
  type MessageAction,
} from "../../src/features/chat/components/MessageActionSheet";
import { useAuthStore } from "../../src/features/auth/store/auth.store";
import { Image } from "expo-image";
import { resolveMediaUrl } from "../../src/lib/media-url";
import {
  listingApi,
  type Listing,
} from "../../src/features/listings/api/listings.api";
import { usersApi } from "../../src/features/users/api/users.api";
import {
  usePriceFormatter,
  useSpecsFormatter,
} from "../../src/features/listings/utils/format";
import { useStartConversation } from "../../src/features/chat/hooks/useStartConversation";

/** What a pinned attachment says when it has no caption to show. */
const ATTACHMENT_LABEL: Record<string, TranslationKey> = {
  IMAGE: "chat.attachmentImage",
  VIDEO: "chat.attachmentVideo",
  VIDEO_NOTE: "chat.attachmentVideo",
  VOICE: "chat.attachmentVoice",
  FILE: "chat.attachmentFile",
};

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

  const {
    data: messages,
    isLoading,
    loadOlder,
    loadingMore,
  } = useMessages(id, !isDraft);
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

  // null = closed; "" = reported from the header, an id = from that message.
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(
    null,
  );
  const [forwarding, setForwarding] = useState<string | null>(null);

  // The conversation is the source of truth; `live` only holds what the
  // socket or an optimistic pin has said since it was last fetched. Derived
  // rather than copied into state by an effect, so a refetch cannot briefly
  // show the old pin.
  const [live, setLive] = useState<{ id: string; pinned: string | null } | null>(
    null,
  );
  const pinnedId =
    live && live.id === id
      ? live.pinned
      : (conversation?.pinnedMessageId ?? null);
  const setPinnedId = useCallback(
    (next: string | null) => id && setLive({ id, pinned: next }),
    [id],
  );

  useEffect(() => {
    const socket = getChatSocket();
    const onPin = (payload: {
      conversationId: string;
      pinnedMessageId: string | null;
    }) => {
      if (payload.conversationId === id) setPinnedId(payload.pinnedMessageId);
    };
    socket.on("conversation:pin", onPin);
    return () => {
      socket.off("conversation:pin", onPin);
    };
  }, [id, setPinnedId]);

  // Only shown when the pinned message is among the ones loaded: scrolling
  // back far enough to find it is the client's job, and a bar that says
  // "pinned message" with nothing in it would be worse than no bar.
  const pinnedMessage = useMemo(
    () => (pinnedId ? (messages ?? []).find((m) => m.id === pinnedId) : null),
    [pinnedId, messages],
  );

  const pin = useMutation({
    mutationFn: (messageId: string | null) =>
      chatApi.setPinned(id!, messageId),
    // Optimistic: the bar appearing is the confirmation, and a pin that waits
    // for a round trip reads as a tap that did nothing.
    onMutate: (messageId) => {
      const previous = pinnedId;
      setPinnedId(messageId);
      return { previous };
    },
    onError: (error, _vars, context) => {
      setPinnedId(context?.previous ?? null);
      toast.error(errorMessage(error));
    },
  });

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

    list.push({
      key: "forward",
      labelKey: "chat.forward",
      icon: "arrow-redo-outline",
      onPress: () => setForwarding(m.id),
    });

    // Either participant may pin: a two-person thread has no owner, and a
    // rule about who is allowed to would be a rule with no reason behind it.
    list.push({
      key: "pin",
      labelKey: pinnedId === m.id ? "chat.unpin" : "chat.pin",
      icon: pinnedId === m.id ? "remove-circle-outline" : "pin-outline",
      onPress: () => pin.mutate(pinnedId === m.id ? null : m.id),
    });

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

    if (!mine) {
      // Only their messages: reporting your own says nothing to a moderator,
      // and the server refuses it anyway.
      list.push({
        key: "report",
        labelKey: "chatReport.action",
        icon: "flag-outline",
        destructive: true,
        onPress: () => setReportingMessageId(m.id),
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
  }, [actionsFor, userId, pinnedId, pin]);

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

  // Same wording as the profile and listing screens, from one formatter.
  const lastSeenLabel = (other: Conversation["other"]): string =>
    formatPresence(other, language);

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
          // Both the native chevron and the left slot are given up, and the
          // whole row — chevron, avatar, name — is rendered as the title.
          // Two sibling slots is what kept going wrong here: the native
          // header sizes the custom title itself, and on both platforms it
          // has at some point been laid over the back button, either eating
          // its taps or clipping the avatar behind it. One view in one slot
          // cannot overlap itself.
          headerBackVisible: false,
          headerLeft: () => null,
          // Reporting the thread itself, not one message — the header is
          // where "this conversation is a problem" belongs.
          headerRight: () =>
            !isDraft ? (
              <Pressable
                onPress={() => setReportingMessageId("")}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t("chatReport.action")}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Ionicons
                  name="flag-outline"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            ) : null,
          // Avatar + name + presence, and the whole thing opens the peer's
          // profile — the same target a tap on the title has in every
          // messenger, and the only route to their ads from inside a thread.
          headerTitle: () => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                // The native header keeps its own left inset even with the
                // left slot given up, so the row is pulled back across it —
                // a back button belongs at the screen edge, not indented
                // into the middle of the header.
                marginLeft: Platform.OS === "ios" ? -spacing.md : -spacing.sm,
                flexShrink: 1,
              }}
            >
              <Pressable
                onPress={() =>
                  router.canGoBack()
                    ? router.back()
                    : router.replace("/(tabs)/chat")
                }
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t("common.back")}
                // Same capsule as the app's BackButton — a bare chevron read
                // as part of the title, not as a control.
                style={({ pressed }) => ({
                  width: sizing.controlSm,
                  height: sizing.controlSm,
                  borderRadius: radii.md,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed
                    ? colors.surfaceRaised
                    : colors.surface,
                })}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </Pressable>

              <Pressable
                onPress={openProfile}
                disabled={!conversation && !ownerId}
                accessibilityRole="button"
                accessibilityLabel={t("userProfile.openProfile")}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
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
            </View>
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
        {/* Above the list, not inside it: an inverted FlatList puts its
            header at the bottom, and a pin belongs at the top of the thread
            no matter which way the list is drawn. */}
        {pinnedMessage ? (
          <Pressable
            onPress={() => setActionsFor(pinnedMessage)}
            accessibilityRole="button"
            accessibilityLabel={t("chat.pinned")}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: pressed
                ? colors.surfaceRaised
                : colors.surface,
            })}
          >
            <Ionicons name="pin" size={15} color={colors.primary} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text
                style={{ ...text.caption, color: colors.primary, fontWeight: "600" }}
              >
                {t("chat.pinned")}
              </Text>
              <Text style={text.caption} numberOfLines={1}>
                {pinnedMessage.body ||
                  t(ATTACHMENT_LABEL[pinnedMessage.type] ?? "chat.attachment")}
              </Text>
            </View>
            <Pressable
              onPress={() => pin.mutate(null)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("chat.unpin")}
            >
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </Pressable>
        ) : null}

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

      <ForwardSheet
        messageId={forwarding}
        fromConversationId={id ?? ""}
        onClose={() => setForwarding(null)}
      />

      {/* A draft thread has no conversation yet — nothing to report. */}
      {!isDraft ? (
        <ReportChatSheet
          conversationId={id}
          visible={reportingMessageId !== null}
          messageId={reportingMessageId || undefined}
          onClose={() => setReportingMessageId(null)}
        />
      ) : null}

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
