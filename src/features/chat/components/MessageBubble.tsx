import { memo } from "react";
import { View, Text, Pressable, Linking, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, type Palette } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT, useLanguage } from "../../../i18n";
import { resolveMediaUrl } from "../../../lib/media-url";
import { VoiceMessage } from "./VoiceMessage";
import type { ChatMessage } from "../api/chat.api";

interface Props {
  message: ChatMessage;
  mine: boolean;
  onLongPress: (m: ChatMessage) => void;
  /** Opens the full-screen viewer. Photos only — video and files hand off to
   *  the OS, which has players and viewers we are not going to beat. */
  onPressImage?: (uri: string) => void;
  onPressReply?: (replyToId: string) => void;
}

/** Upload names arrive percent-encoded from the storage URL; "Realtor%20Toolkit.docx"
 *  is not a filename anyone recognises. */
function displayName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name; // a stray "%" that isn't an escape — show it as-is
  }
}

/** MB reads "0.0 MB" for anything small, which looks like a failed upload. */
function fileSizeLabel(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Ticks({ m, color }: { m: ChatMessage; color: string }) {
  if (m.pending)
    return <Ionicons name="time-outline" size={12} color={color} />;
  return (
    <Ionicons
      name={m.status === "SENT" ? "checkmark" : "checkmark-done"}
      size={13}
      color={m.status === "READ" ? "#4FC3F7" : color}
    />
  );
}

export const MessageBubble = memo(function MessageBubble({
  message: m,
  mine,
  onLongPress,
  onPressImage,
  onPressReply,
}: Props) {
  const { colors, text } = useTheme();
  const t = useT();
  const language = useLanguage();

  // Text on an accent-filled bubble never follows the palette's text colour —
  // it has to stay legible against the fill in both schemes.
  const fg = mine ? colors.onPrimary : colors.text;
  const meta = mine ? "rgba(255,255,255,0.8)" : colors.textMuted;

  const time = new Date(m.createdAt).toLocaleTimeString(language, {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (m.deletedAt) {
    return (
      <View style={[bubbleStyle(mine, colors), { opacity: 0.6 }]}>
        <Text style={{ ...text.caption, fontStyle: "italic", color: meta }}>
          {t("chat.deletedMessage")}
        </Text>
      </View>
    );
  }

  const imgW = 220;
  const ratio = m.width && m.height ? m.height / m.width : 1;
  const media = resolveMediaUrl(m.mediaUrl);
  const openMedia = () => media && Linking.openURL(media);

  return (
    <Pressable
      onLongPress={() => onLongPress(m)}
      style={bubbleStyle(mine, colors)}
    >
      {m.replyTo ? (
        <Pressable
          onPress={() => onPressReply?.(m.replyTo!.id)}
          style={{
            borderLeftWidth: 3,
            borderLeftColor: mine ? colors.onPrimary : colors.primary,
            paddingLeft: spacing.sm,
            marginBottom: spacing.xs,
            opacity: 0.85,
          }}
        >
          <Text numberOfLines={1} style={{ fontSize: 12, color: fg }}>
            {m.replyTo.preview}
          </Text>
        </Pressable>
      ) : null}

      {m.type === "TEXT" && (
        <Text style={{ ...text.body, color: fg }}>{m.body}</Text>
      )}

      {(m.type === "IMAGE" ||
        m.type === "VIDEO" ||
        m.type === "VIDEO_NOTE") && (
        <View>
          {/* The tap target is the photo itself, and it keeps the long-press so
              reply/edit/delete still reach media messages. */}
          <Pressable
            onPress={() =>
              m.type === "IMAGE"
                ? media && onPressImage?.(media)
                : openMedia()
            }
            onLongPress={() => onLongPress(m)}
          >
            <Image
              source={{
                uri: resolveMediaUrl(m.thumbUrl) ?? media,
              }}
              style={{
                width: imgW,
                height: Math.min(imgW * ratio || imgW, 320),
                borderRadius: radii.md,
              }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </Pressable>
          {m.type !== "IMAGE" && (
            <Pressable
              onPress={openMedia}
              style={{
                position: "absolute",
                top: "40%",
                alignSelf: "center",
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.overlay,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="play" size={20} color="#FFFFFF" />
            </Pressable>
          )}
          {m.body ? (
            <Text style={{ ...text.body, marginTop: spacing.xs, color: fg }}>
              {m.body}
            </Text>
          ) : null}
        </View>
      )}

      {m.type === "VOICE" && media && (
        <VoiceMessage
          url={media}
          waveform={m.waveform}
          durationSec={m.durationSec}
          mine={mine}
        />
      )}

      {m.type === "FILE" && (
        <Pressable
          onPress={openMedia}
          onLongPress={() => onLongPress(m)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <Ionicons name="document-attach-outline" size={22} color={fg} />
          <View style={{ flexShrink: 1 }}>
            <Text numberOfLines={1} style={{ ...text.body, color: fg }}>
              {m.fileName ? displayName(m.fileName) : t("chat.file")}
            </Text>
            {m.fileSize ? (
              <Text style={{ fontSize: 11, color: meta }}>
                {fileSizeLabel(m.fileSize)}
              </Text>
            ) : null}
          </View>
        </Pressable>
      )}

      <View
        style={{
          flexDirection: "row",
          gap: 4,
          alignSelf: "flex-end",
          marginTop: 2,
          alignItems: "center",
        }}
      >
        {m.editedAt ? (
          <Text style={{ fontSize: 10, color: meta }}>{t("chat.edited")}</Text>
        ) : null}
        <Text style={{ fontSize: 10, color: meta }}>{time}</Text>
        {mine ? <Ticks m={m} color={meta} /> : null}
      </View>
    </Pressable>
  );
});

function bubbleStyle(mine: boolean, colors: Palette): ViewStyle {
  return {
    maxWidth: "78%",
    alignSelf: mine ? "flex-end" : "flex-start",
    backgroundColor: mine ? colors.primary : colors.surface,
    borderRadius: radii.lg,
    borderBottomRightRadius: mine ? 4 : radii.lg,
    borderBottomLeftRadius: mine ? radii.lg : 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: 2,
    marginHorizontal: spacing.md,
  };
}
