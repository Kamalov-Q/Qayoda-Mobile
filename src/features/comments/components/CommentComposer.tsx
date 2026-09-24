// The input bar at the bottom of the thread. Doubles as the reply box and the
// edit box — the banner above it says which, because the field itself looks
// identical in all three modes.
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { COMMENT_MAX_LENGTH } from "../api/comments.api";

export interface ComposerTarget {
  mode: "reply" | "edit";
  /** Whose comment — shown in the banner so the target is never a guess. */
  name: string;
}

interface Props {
  value: string;
  onChangeText: (next: string) => void;
  onSubmit: () => void;
  sending?: boolean;
  /** Null for a plain new comment. */
  target: ComposerTarget | null;
  onCancelTarget: () => void;
  /** Bottom padding — the safe area, or the keyboard's own inset. */
  bottomInset?: number;
  /** Local URI of the attached photo, before or during its upload. */
  photoUri?: string | null;
  /** True while that photo is on its way to the server. */
  uploading?: boolean;
  onPickPhoto?: () => void;
  onRemovePhoto?: () => void;
}

export function CommentComposer({
  value,
  onChangeText,
  onSubmit,
  sending,
  target,
  onCancelTarget,
  bottomInset = 0,
  photoUri,
  uploading,
  onPickPhoto,
  onRemovePhoto,
}: Props) {
  const { colors, text } = useTheme();
  const t = useT();

  // A photo on its own is a comment, so either one is enough to send — but
  // not while it is still uploading, since there would be nothing to attach.
  const canSend =
    (value.trim().length > 0 || !!photoUri) && !sending && !uploading;

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
        paddingBottom: bottomInset,
      }}
    >
      {target ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
          }}
        >
          <Text style={{ ...text.caption, flex: 1 }} numberOfLines={1}>
            {t(
              target.mode === "reply"
                ? "comments.replyingTo"
                : "comments.editing",
              { name: target.name },
            )}
          </Text>
          <Pressable
            onPress={onCancelTarget}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      {photoUri ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <View style={{ alignSelf: "flex-start" }}>
            <Image
              source={{ uri: photoUri }}
              style={{
                width: 64,
                height: 64,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceRaised,
              }}
              contentFit="cover"
            />
            {/* The spinner sits ON the thumbnail rather than beside it: the
                thing being waited for is that picture. */}
            {uploading ? (
              <View
                style={{
                  position: "absolute",
                  inset: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radii.md,
                  backgroundColor: colors.imageScrim,
                }}
              >
                <ActivityIndicator color="#FFFFFF" size="small" />
              </View>
            ) : (
              <Pressable
                onPress={onRemovePhoto}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("common.delete")}
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 22,
                  height: 22,
                  borderRadius: radii.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="close" size={13} color={colors.text} />
              </Pressable>
            )}
          </View>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: spacing.sm,
          padding: spacing.md,
        }}
      >
        {/* One photo per comment, so the button goes away once there is one. */}
        {onPickPhoto && !photoUri ? (
          <Pressable
            onPress={onPickPhoto}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={t("comments.attachPhoto")}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: radii.pill,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="image-outline" size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={t("comments.placeholder")}
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={COMMENT_MAX_LENGTH}
          editable={!sending}
          style={{
            ...text.body,
            flex: 1,
            // Grows with the text, up to the point where it would take the
            // thread over.
            minHeight: 40,
            maxHeight: 120,
            paddingHorizontal: spacing.md,
            paddingTop: 10,
            paddingBottom: 10,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceRaised,
            color: colors.text,
          }}
        />

        <Pressable
          onPress={onSubmit}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={t("comments.send")}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: canSend ? colors.primary : colors.surfaceRaised,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          {sending ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Ionicons
              name="arrow-up"
              size={20}
              color={canSend ? colors.onPrimary : colors.textFaint}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}
