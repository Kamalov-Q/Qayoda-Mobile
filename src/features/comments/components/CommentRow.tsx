// One comment: who, what they said, when, a heart, and — on a top-level
// comment — the way into its replies. Instagram's layout, because it is the
// one everybody already knows how to read.
import { memo, useCallback, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/src/components/ui";
import { spacing, radii } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { resolveMediaUrl } from "@/src/lib/media-url";
import type { Comment } from "../api/comments.api";
import { useCommentTime } from "../utils/time";

interface Props {
  comment: Comment;
  /** Replies sit indented under their parent. */
  inset?: boolean;
  /** The signed-in reader's id, for "can I edit this?". */
  viewerId?: string;
  /** The listing's owner may delete anything under their own advert. */
  isListingOwner?: boolean;
  onReply?: (comment: Comment) => void;
  onEdit?: (comment: Comment) => void;
  onDelete?: (comment: Comment) => void;
  onToggleLike?: (comment: Comment) => void;
  onPressImage?: (url: string) => void;
}

/** Widest a comment photo gets. Tall shots are capped by aspect ratio below. */
const PHOTO_MAX_HEIGHT = 220;

export const CommentRow = memo(function CommentRow({
  comment,
  inset,
  viewerId,
  isListingOwner,
  onReply,
  onEdit,
  onDelete,
  onToggleLike,
  onPressImage,
}: Props) {
  const { colors, text } = useTheme();
  const t = useT();
  const timeAgo = useCommentTime();
  // Edit and delete hide behind the "…" until asked for. Inline, they made a
  // four-item row that ran off the right edge of the screen on a phone —
  // and they are the two actions nobody needs to see while reading.
  const [menuOpen, setMenuOpen] = useState(false);

  const mine = !!viewerId && comment.authorId === viewerId;
  const canManage = mine || !!isListingOwner;
  const name =
    [comment.author?.name, comment.author?.surname].filter(Boolean).join(" ") ||
    t("chat.unknownUser");

  const edited = comment.updatedAt !== comment.createdAt;
  const photo = resolveMediaUrl(comment.imageUrl ?? comment.imageThumbUrl);
  // Portrait shots would otherwise take the whole thread; the cap wins.
  const ratio =
    comment.imageWidth && comment.imageHeight
      ? comment.imageWidth / comment.imageHeight
      : 4 / 3;

  const like = useCallback(
    () => onToggleLike?.(comment),
    [onToggleLike, comment],
  );

  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.sm,
        paddingLeft: inset ? spacing.xl : 0,
        paddingVertical: spacing.sm,
      }}
    >
      <Avatar
        uri={comment.author?.avatarThumbUrl}
        name={name}
        size={inset ? 28 : 36}
      />

      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        {/* Name and time on their own line: inline with the body they wrapped
            mid-sentence, and the timestamp ended up in the middle of a word. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          {/* The name yields, the timestamp does not. Without flexShrink the
              name takes whatever width it wants and pushes the time out past
              the column, underneath the heart. */}
          <Text style={{ ...text.bodyStrong, flexShrink: 1 }} numberOfLines={1}>
            {name}
          </Text>
          <Text style={{ ...text.caption, flexShrink: 0 }} numberOfLines={1}>
            {timeAgo(comment.createdAt)}
            {edited ? ` · ${t("comments.edited")}` : ""}
          </Text>
        </View>

        {comment.body ? <Text style={text.body}>{comment.body}</Text> : null}

        {photo ? (
          <Pressable
            onPress={() => onPressImage?.(photo)}
            disabled={!onPressImage}
            accessibilityRole="image"
            style={({ pressed }) => ({
              marginTop: 2,
              alignSelf: "flex-start",
              maxWidth: "100%",
              borderRadius: radii.md,
              overflow: "hidden",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Image
              source={{ uri: photo }}
              style={{
                width: Math.min(PHOTO_MAX_HEIGHT * ratio, 240),
                height: PHOTO_MAX_HEIGHT,
                backgroundColor: colors.surfaceRaised,
              }}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
            />
          </Pressable>
        ) : null}

        {/* Two items at most, so it cannot outgrow the row. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            marginTop: 2,
          }}
        >
          {comment.likeCount > 0 ? (
            <Text style={text.caption}>
              {t("comments.likeCount", { count: comment.likeCount })}
            </Text>
          ) : null}

          {/* Replies hang off the top-level comment only: the server refuses
              a reply to a reply, so offering one would be a dead button. */}
          {onReply && !comment.parentId ? (
            <TextAction
              label={t("comments.reply")}
              onPress={() => onReply(comment)}
            />
          ) : null}

          {canManage && (onEdit || onDelete) ? (
            <Pressable
              onPress={() => setMenuOpen((open) => !open)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("common.more")}
              accessibilityState={{ expanded: menuOpen }}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={16}
                color={colors.textFaint}
              />
            </Pressable>
          ) : null}
        </View>

        {menuOpen && canManage ? (
          <View
            style={{
              flexDirection: "row",
              gap: spacing.lg,
              paddingVertical: spacing.xs,
            }}
          >
            {mine && onEdit ? (
              <TextAction
                label={t("common.edit")}
                tone={colors.primary}
                onPress={() => {
                  setMenuOpen(false);
                  onEdit(comment);
                }}
              />
            ) : null}
            {onDelete ? (
              <TextAction
                label={t("common.delete")}
                tone={colors.danger}
                onPress={() => {
                  setMenuOpen(false);
                  onDelete(comment);
                }}
              />
            ) : null}
          </View>
        ) : null}
      </View>

      {onToggleLike ? (
        <Pressable
          onPress={like}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityState={{ selected: comment.likedByMe }}
          accessibilityLabel={t("comments.like")}
          // A fixed width rather than hugging the glyph: the text column is
          // flex:1 and will happily take every pixel this does not claim.
          style={({ pressed }) => ({
            width: 24,
            paddingTop: 2,
            alignItems: "flex-end",
            opacity: pressed ? 0.5 : 1,
            transform: [{ scale: pressed ? 0.9 : 1 }],
          })}
        >
          <Ionicons
            name={comment.likedByMe ? "heart" : "heart-outline"}
            size={17}
            color={comment.likedByMe ? colors.danger : colors.textFaint}
          />
        </Pressable>
      ) : null}
    </View>
  );
});

/** The small text buttons under a comment — deliberately not Buttons: at this
 *  size a chrome-less label is the control. */
function TextAction({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone?: string;
  onPress: () => void;
}) {
  const { colors, text } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <Text
        style={{
          ...text.caption,
          fontWeight: "600",
          color: tone ?? colors.textMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
