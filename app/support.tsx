// The line to the support desk. One thread, ever — the same screen whether
// this is the first message or the fortieth.
import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  EmptyState,
  ImageViewer,
  HEADER_EDGES,
} from "../src/components/ui";
import { spacing, radii } from "../src/theme/tokens";
import { useTheme } from "../src/theme/useTheme";
import { useT, useLanguage } from "../src/i18n";
import { errorMessage } from "../src/lib/api-error";
import { resolveMediaUrl } from "../src/lib/media-url";
import { ChatInput } from "../src/features/chat/components/ChatInput";
import { VoiceMessage } from "../src/features/chat/components/VoiceMessage";
import type { SendMessageInput } from "../src/features/chat/api/chat.api";
import {
  useMarkSupportRead,
  useSendSupport,
  useSupport,
} from "../src/features/support/hooks/useSupport";
import type { SupportMessage } from "../src/features/support/api/support.api";

/** The composer is built for a chat; support has nothing to reply to or
 *  edit, so those handlers go nowhere. */
const noop = () => {};

export default function SupportScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const language = useLanguage();
  const listRef = useRef<FlatList<SupportMessage>>(null);

  const { data, isLoading, isError, error, refetch } = useSupport();
  const send = useSendSupport();
  useMarkSupportRead();

  const [viewing, setViewing] = useState<string | null>(null);

  const onSend = useCallback(
    (input: SendMessageInput) => {
      const isImage = input.type === "IMAGE";
      send.mutate({
        type: input.type,
        body: input.body,
        // The composer speaks one language for every attachment; support
        // keeps photos in their own pair, so they split here rather than in
        // three places on the server.
        ...(isImage && input.mediaUrl
          ? {
              image: {
                url: input.mediaUrl,
                thumbUrl: input.thumbUrl ?? input.mediaUrl,
              },
            }
          : {
              mediaUrl: input.mediaUrl,
              thumbUrl: input.thumbUrl,
            }),
        fileName: input.fileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        durationSec: input.durationSec,
        waveform: input.waveform,
      });
    },
    [send],
  );

  const messages = data?.messages ?? [];

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={HEADER_EDGES}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 44}
      >
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
          <FlatList<SupportMessage>
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{
              padding: spacing.md,
              gap: spacing.sm,
              flexGrow: 1,
            }}
            keyboardShouldPersistTaps="handled"
            // The newest message is the one being read; a thread that opens
            // at the top makes every visit start with a scroll.
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
            ListEmptyComponent={
              <EmptyState
                icon="chatbubble-ellipses-outline"
                title={t("support.emptyTitle")}
                description={t("support.emptyHint")}
              />
            }
            renderItem={({ item }) => (
              <Bubble
                message={item}
                language={language}
                // "Has the desk seen this?" — one stamp per side, compared
                // against the message's own time.
                readAt={data?.thread?.adminReadAt ?? null}
                onPressImage={setViewing}
              />
            )}
          />
        )}

        {/* The chat's own composer, in support mode: photos, files and voice
            all work here, and rebuilding them for this screen would have been
            a second implementation to keep in step with the first.

            Closed threads still take messages — from the customer's side
            there is no such thing as a conversation support has ended. */}
        {/* No padding of its own: `Screen` already carries the bottom safe
            area through HEADER_EDGES, and adding the inset again here was
            stacking two gaps under the composer. */}
        <View>
          <ChatInput
            conversationId=""
            support
            onSend={onSend}
            replyTo={null}
            onClearReply={noop}
            editing={null}
            onSubmitEdit={noop}
            onClearEdit={noop}
          />
        </View>
      </KeyboardAvoidingView>

      {viewing ? (
        <ImageViewer uri={viewing} onClose={() => setViewing(null)} />
      ) : null}
    </Screen>
  );
}

/** One message. Support on the left, you on the right — the arrangement every
 *  messenger uses, so nobody has to be told which side is which. */
function Bubble({
  message,
  language,
  readAt,
  onPressImage,
}: {
  message: SupportMessage;
  language: string;
  readAt: string | null;
  onPressImage: (url: string) => void;
}) {
  const { colors, text } = useTheme();
  const t = useT();
  const mine = !message.fromAdmin;
  const photo = resolveMediaUrl(message.imageUrl ?? message.imageThumbUrl);
  const media = resolveMediaUrl(message.mediaUrl);
  // Read when the desk's stamp is later than this message was written.
  const seen =
    !!readAt && new Date(readAt).getTime() >= new Date(message.createdAt).getTime();

  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "85%",
        gap: 4,
        padding: spacing.sm,
        borderRadius: radii.lg,
        backgroundColor: mine ? colors.primarySoft : colors.surface,
        borderWidth: 1,
        borderColor: mine ? colors.primaryBorder : colors.border,
      }}
    >
      {!mine ? (
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
        >
          <Ionicons
            name="shield-checkmark"
            size={13}
            color={colors.primary}
          />
          <Text style={{ ...text.caption, color: colors.primary, fontWeight: "600" }}>
            {t("support.team")}
          </Text>
        </View>
      ) : null}

      {/* Forwarded out of a chat: whose words these originally were. */}
      {message.forwardedFromName ? (
        <Pressable
          onPress={() =>
            message.forwardedFromUserId &&
            router.push(`/profile/${message.forwardedFromUserId}`)
          }
          disabled={!message.forwardedFromUserId}
          accessibilityRole={message.forwardedFromUserId ? "button" : "text"}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons
            name="arrow-redo-outline"
            size={12}
            color={colors.textMuted}
          />
          <Text
            style={{
              ...text.caption,
              fontStyle: "italic",
              textDecorationLine: message.forwardedFromUserId
                ? "underline"
                : "none",
            }}
          >
            {t("chat.forwardedFrom", { name: message.forwardedFromName })}
          </Text>
        </Pressable>
      ) : null}

      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{
            width: 200,
            height: 150,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceRaised,
          }}
          contentFit="cover"
          onTouchEnd={() => onPressImage(photo)}
        />
      ) : null}

      {/* Voice, video and files arrive here only by forwarding, so they are
          shown as an openable row rather than with a full player: the point
          is that the desk can hear or read the thing, not that this screen
          becomes a second chat client. */}
      {media && message.type === "VOICE" ? (
        <VoiceMessage
          url={media}
          durationSec={message.durationSec}
          waveform={message.waveform}
          mine={mine}
        />
      ) : media ? (
        <Pressable
          onPress={() => void Linking.openURL(media)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: spacing.xs,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons
            name={
              message.type === "VOICE"
                ? "mic-outline"
                : message.type === "VIDEO" || message.type === "VIDEO_NOTE"
                  ? "videocam-outline"
                  : "document-outline"
            }
            size={18}
            color={colors.primary}
          />
          <Text
            style={{ ...text.bodyStrong, color: colors.primary, flexShrink: 1 }}
            numberOfLines={1}
          >
            {message.fileName ??
              t(
                message.type === "VOICE"
                  ? "chat.attachmentVoice"
                  : message.type === "VIDEO" || message.type === "VIDEO_NOTE"
                    ? "chat.attachmentVideo"
                    : "chat.attachmentFile",
              )}
          </Text>
        </Pressable>
      ) : null}

      {message.body ? <Text style={text.body}>{message.body}</Text> : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          alignSelf: "flex-end",
        }}
      >
        <Text style={text.caption}>
          {new Date(message.createdAt).toLocaleTimeString(language, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
        {/* Only on your own: a tick on the desk's message would be telling
            them something about yourself. */}
        {mine ? (
          <Ionicons
            name={seen ? "checkmark-done" : "checkmark"}
            size={14}
            color={seen ? colors.primary : colors.textFaint}
          />
        ) : null}
      </View>
    </View>
  );
}
