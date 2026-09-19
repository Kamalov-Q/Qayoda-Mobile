import { memo, useEffect, useRef, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  Text,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT } from "../../../i18n";
import { toast } from "../../../components/ui/Toast";
import { errorMessage } from "../../../lib/api-error";
import { getChatSocket } from "../../../lib/chat-socket";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { uploadChatAttachment } from "../hooks/useAttachmentUpload";
import type { ChatMessage, SendMessageInput } from "../api/chat.api";

interface Props {
  conversationId: string;
  /** Draft mode: no conversation exists yet — no typing signals, no
   *  attachments (they need a conversation id), text-only until first send. */
  draft?: boolean;
  /** Seeds the box once (draft boilerplate); anything typed wins over it. */
  initialText?: string;
  onSend: (input: SendMessageInput) => void;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
  editing: ChatMessage | null;
  onSubmitEdit: (body: string) => void;
  onClearEdit: () => void;
}

export const ChatInput = memo(function ChatInput({
  conversationId,
  draft,
  initialText,
  onSend,
  replyTo,
  onClearReply,
  editing,
  onSubmitEdit,
  onClearEdit,
}: Props) {
  const { colors, text: type } = useTheme();
  const t = useT();
  const [text, setText] = useState("");
  const touched = useRef(false);
  const [uploading, setUploading] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorder = useVoiceRecorder();

  // Load the body into the field when edit mode opens on a new message. Keyed
  // on the id so typing inside edit mode is not overwritten on every render.
  const editingId = editing?.id ?? null;
  useEffect(() => {
    if (editingId) setText(editing?.body ?? "");
  }, [editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // A pending "typing: true" must not outlive the screen, or the peer is left
  // with a typing bubble that never clears.
  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    },
    [],
  );

  // The boilerplate arrives async (the listing/conversation loads first), so
  // seed whenever it lands — but never over something the user already typed.
  // Not draft-only: reopening an existing thread FROM A LISTING prefills too.
  useEffect(() => {
    if (initialText && !touched.current) setText(initialText);
  }, [initialText]);

  const emitTyping = (isTyping: boolean, kind?: "text" | "voice") => {
    if (draft || !conversationId) return;
    getChatSocket().emit("typing", { conversationId, isTyping, kind });
  };

  const onChangeText = (v: string) => {
    touched.current = true;
    setText(v);
    emitTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 2000);
  };

  const submitText = () => {
    const body = text.trim();
    if (!body) return;
    if (editing) {
      onSubmitEdit(body);
      onClearEdit();
    } else {
      onSend({ type: "TEXT", body, replyToId: replyTo?.id });
      onClearReply();
    }
    setText("");
    emitTyping(false);
  };

  const pickImageOrVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const isVideo = asset.type === "video";

    setUploading(true);
    try {
      const att = await uploadChatAttachment(
        asset.uri,
        isVideo ? "VIDEO" : "IMAGE",
        asset.fileName ?? (isVideo ? "video.mp4" : "photo.jpg"),
        asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
      );
      onSend({
        type: isVideo ? "VIDEO" : "IMAGE",
        mediaUrl: att.url,
        thumbUrl: att.thumbUrl ?? undefined,
        fileName: att.fileName,
        fileSize: att.fileSize,
        mimeType: att.mimeType,
        durationSec: att.durationSec ?? undefined,
        width: att.width ?? undefined,
        height: att.height ?? undefined,
        replyToId: replyTo?.id,
      });
      onClearReply();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];

    setUploading(true);
    try {
      const att = await uploadChatAttachment(
        file.uri,
        "FILE",
        file.name,
        file.mimeType ?? "application/octet-stream",
      );
      onSend({
        type: "FILE",
        mediaUrl: att.url,
        fileName: att.fileName,
        fileSize: att.fileSize,
        mimeType: att.mimeType,
        replyToId: replyTo?.id,
      });
      onClearReply();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const onMicPressIn = () => {
    void recorder.start();
    emitTyping(true, "voice");
  };

  const onMicPressOut = async () => {
    emitTyping(false, "voice");
    const rec = await recorder.stop();
    if (!rec) return;
    setUploading(true);
    try {
      const att = await uploadChatAttachment(
        rec.uri,
        "VOICE",
        "voice.m4a",
        "audio/m4a",
      );
      onSend({
        type: "VOICE",
        mediaUrl: att.url,
        fileName: att.fileName,
        fileSize: att.fileSize,
        mimeType: att.mimeType,
        durationSec: att.durationSec ?? rec.durationSec,
        waveform: att.waveform ?? undefined,
        replyToId: replyTo?.id,
      });
      onClearReply();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const banner = editing
    ? {
        label: t("chat.editBanner"),
        preview: editing.body ?? "",
        onClear: onClearEdit,
      }
    : replyTo
      ? {
          label: t("chat.replyBanner"),
          preview: replyTo.body ?? replyTo.fileName ?? "",
          onClear: onClearReply,
        }
      : null;

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.bg,
      }}
    >
      {banner ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
          }}
        >
          <View
            style={{
              flex: 1,
              borderLeftWidth: 3,
              borderLeftColor: colors.primary,
              paddingLeft: spacing.sm,
            }}
          >
            <Text style={{ ...type.caption, color: colors.primary }}>
              {banner.label}
            </Text>
            <Text numberOfLines={1} style={type.caption}>
              {banner.preview}
            </Text>
          </View>
          <Pressable onPress={banner.onClear} hitSlop={10}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          padding: spacing.sm,
          gap: spacing.xs,
        }}
      >
        {draft ? null : (
          <>
            <Pressable
              onPress={() => void pickFile()}
              hitSlop={8}
              style={({ pressed }) => iconButton(colors, pressed)}
            >
              <Ionicons name="attach" size={20} color={colors.textMuted} />
            </Pressable>
            <Pressable
              onPress={() => void pickImageOrVideo()}
              hitSlop={8}
              style={({ pressed }) => iconButton(colors, pressed)}
            >
              <Ionicons
                name="image-outline"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </>
        )}

        <TextInput
          value={
            recorder.isRecording
              ? `${Math.floor(recorder.durationMs / 1000)}s`
              : text
          }
          onChangeText={onChangeText}
          editable={!recorder.isRecording}
          placeholder={t("chat.inputPlaceholder")}
          placeholderTextColor={colors.textFaint}
          multiline
          style={{
            flex: 1,
            maxHeight: 110,
            minHeight: 40,
            backgroundColor: colors.surfaceRaised,
            // The raised surface is near-invisible against the bg in light
            // mode — the border is what makes it read as an input there.
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            ...type.body,
            color: colors.text,
          }}
        />

        {uploading ? (
          <ActivityIndicator
            style={{ padding: spacing.sm }}
            color={colors.primary}
          />
        ) : text.trim() || editing ? (
          <Pressable onPress={submitText} style={sendButton(colors.primary)}>
            <Ionicons name="send" size={17} color={colors.onPrimary} />
          </Pressable>
        ) : draft ? (
          // Text-only until the conversation exists; a dimmed send reads as
          // "write something", where a mic would promise what draft can't do.
          <Pressable disabled style={sendButton(colors.borderStrong)}>
            <Ionicons name="send" size={17} color={colors.onPrimary} />
          </Pressable>
        ) : (
          <Pressable
            onPressIn={onMicPressIn}
            onPressOut={() => void onMicPressOut()}
            style={sendButton(
              recorder.isRecording ? colors.danger : colors.primary,
            )}
          >
            <Ionicons name="mic" size={19} color={colors.onPrimary} />
          </Pressable>
        )}
      </View>
    </View>
  );
});

const iconButton = (
  colors: { surface: string; surfaceRaised: string; border: string },
  pressed: boolean,
) =>
  ({
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
  }) as const;

const sendButton = (backgroundColor: string) =>
  ({
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor,
    justifyContent: "center",
    alignItems: "center",
  }) as const;
