// The line to the support desk. One thread, ever — the same screen whether
// this is the first message or the fortieth.
import { useRef, useState } from "react";
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
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  EmptyState,
  ImageViewer,
  HEADER_EDGES,
  toast,
} from "../src/components/ui";
import { spacing, radii } from "../src/theme/tokens";
import { useTheme } from "../src/theme/useTheme";
import { useT, useLanguage } from "../src/i18n";
import { errorMessage } from "../src/lib/api-error";
import { resolveMediaUrl } from "../src/lib/media-url";
import { uploadImages } from "../src/lib/upload-client";
import { CommentComposer } from "../src/features/comments/components/CommentComposer";
import {
  useMarkSupportRead,
  useSendSupport,
  useSupport,
} from "../src/features/support/hooks/useSupport";
import type {
  SupportImage,
  SupportMessage,
} from "../src/features/support/api/support.api";

export default function SupportScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const language = useLanguage();
  const listRef = useRef<FlatList<SupportMessage>>(null);

  const { data, isLoading, isError, error, refetch } = useSupport();
  const send = useSendSupport();
  useMarkSupportRead();

  const [draft, setDraft] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photo, setPhoto] = useState<SupportImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;
    setPhotoUri(uri);
    setUploading(true);
    try {
      const { images } = await uploadImages([uri]);
      if (!images.length) throw new Error("no image");
      setPhoto({ url: images[0].url, thumbUrl: images[0].thumbUrl });
    } catch (e) {
      setPhotoUri(null);
      setPhoto(null);
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = () => {
    const body = draft.trim();
    if ((!body && !photo) || uploading) return;

    send.mutate(
      { body, image: photo ?? undefined },
      {
        onSuccess: () => {
          setDraft("");
          setPhotoUri(null);
          setPhoto(null);
        },
      },
    );
  };

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
                onPressImage={setViewing}
              />
            )}
          />
        )}

        {/* Closed threads still take messages: from the customer's side there
            is no such thing as a conversation support has ended. */}
        <CommentComposer
          value={draft}
          onChangeText={setDraft}
          onSubmit={onSubmit}
          sending={send.isPending}
          target={null}
          onCancelTarget={() => setDraft("")}
          bottomInset={insets.bottom}
          photoUri={photoUri}
          uploading={uploading}
          onPickPhoto={() => void pickPhoto()}
          onRemovePhoto={() => {
            setPhotoUri(null);
            setPhoto(null);
          }}
        />
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
  onPressImage,
}: {
  message: SupportMessage;
  language: string;
  onPressImage: (url: string) => void;
}) {
  const { colors, text } = useTheme();
  const t = useT();
  const mine = !message.fromAdmin;
  const photo = resolveMediaUrl(message.imageUrl ?? message.imageThumbUrl);
  const media = resolveMediaUrl(message.mediaUrl);

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
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <Ionicons name="arrow-redo-outline" size={12} color={colors.textMuted} />
          <Text style={{ ...text.caption, fontStyle: "italic" }}>
            {t("chat.forwardedFrom", { name: message.forwardedFromName })}
          </Text>
        </View>
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
      {media ? (
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

      <Text style={{ ...text.caption, alignSelf: "flex-end" }}>
        {new Date(message.createdAt).toLocaleTimeString(language, {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );
}
