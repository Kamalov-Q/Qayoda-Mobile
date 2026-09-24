// A top-level comment with its replies. The first couple arrive with the
// comment; the rest are fetched only if someone asks — most threads are never
// expanded, and a request per comment on every page load would be the
// expensive way to render nothing.
import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { CommentRow } from "./CommentRow";
import { useReplies } from "../hooks/useComments";
import type { Comment, CommentThread } from "../api/comments.api";

interface Props {
  listingId: string;
  thread: CommentThread;
  viewerId?: string;
  isListingOwner?: boolean;
  onReply: (comment: Comment) => void;
  onEdit: (comment: Comment) => void;
  onDelete: (comment: Comment) => void;
  onToggleLike: (comment: Comment) => void;
  /** Opens a comment's photo full-screen. */
  onPressImage?: (url: string) => void;
}

export function CommentThreadItem({
  listingId,
  thread,
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
  const [expanded, setExpanded] = useState(false);

  const { data, isFetching } = useReplies(listingId, thread.id, expanded);

  // Expanded shows everything fetched; collapsed shows what rode along with
  // the comment.
  const replies = expanded ? (data?.items ?? thread.replies) : thread.replies;
  const hidden = thread.replyCount - replies.length;

  const rowProps = {
    viewerId,
    isListingOwner,
    onEdit,
    onDelete,
    onToggleLike,
    onPressImage,
  };

  return (
    <View>
      <CommentRow comment={thread} onReply={onReply} {...rowProps} />

      {replies.map((reply) => (
        <CommentRow key={reply.id} comment={reply} inset {...rowProps} />
      ))}

      {hidden > 0 && !expanded ? (
        <Pressable
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            paddingLeft: spacing.xl + 34 + spacing.sm,
            paddingVertical: spacing.xs,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ ...text.caption, fontWeight: "600" }}>
            {t("comments.showReplies", { count: hidden })}
          </Text>
        </Pressable>
      ) : null}

      {expanded && isFetching ? (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginLeft: spacing.xl }}
        />
      ) : null}
    </View>
  );
}
