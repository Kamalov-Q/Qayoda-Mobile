import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { spacing, weight } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { CommentRow } from "@/src/features/comments/components/CommentRow";
import type { Comment } from "@/src/features/comments/api/comments.api";
import { useVideoReplies } from "../hooks/useVideoComments";
import type {
  VideoComment,
  VideoCommentThread as Thread,
} from "../api/videos.api";

/**
 * A video comment in the shape the comment components already speak.
 *
 * The two threads are the same thing to a reader, so they are the same thing
 * on screen: CommentRow, CommentComposer and the time formatter are reused
 * verbatim rather than copied. The two shapes differ in one field — a
 * listing's comment is keyed by `listingId`, a reel's by `videoId` — so that
 * is the only one rewritten here.
 *
 * The photo fields are NOT blanked. They used to be, from back when a reel's
 * comments were text only, and the override survived the photo feature: the
 * picker uploaded, the server stored the URL and returned it, and this line
 * threw it away on the last hop before the row that draws it.
 */
export const asComment = (c: VideoComment): Comment => ({
  ...c,
  // The row only ever passes this back to its own callbacks, and the video's
  // id is the thread's id here.
  listingId: c.videoId,
});

interface Props {
  videoId: string;
  thread: Thread;
  viewerId?: string;
  /** The video's author may delete anything under their own reel. */
  isVideoAuthor?: boolean;
  onReply: (comment: Comment) => void;
  onEdit: (comment: Comment) => void;
  onDelete: (comment: Comment) => void;
  onReport: (comment: Comment) => void;
  onToggleLike: (comment: Comment) => void;
  /** Opens a comment's photo full-screen. */
  onPressImage?: (url: string) => void;
}

/**
 * A top-level comment with its replies. Two arrive with the comment; the rest
 * are fetched only if somebody asks, because most threads are never expanded
 * and a request per comment on page load is the expensive way to render
 * nothing.
 */
export function VideoCommentThread({
  videoId,
  thread,
  viewerId,
  isVideoAuthor,
  onReply,
  onEdit,
  onDelete,
  onReport,
  onToggleLike,
  onPressImage,
}: Props) {
  const { colors, text } = useTheme();
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  const { data, isFetching } = useVideoReplies(videoId, thread.id, expanded);
  const replies = expanded ? (data?.items ?? thread.replies) : thread.replies;
  const hidden = thread.replyCount - replies.length;

  return (
    <View style={{ gap: spacing.sm }}>
      <CommentRow
        comment={asComment(thread)}
        viewerId={viewerId}
        isListingOwner={isVideoAuthor}
        onReply={onReply}
        onEdit={onEdit}
        onDelete={onDelete}
        onReport={onReport}
        onToggleLike={onToggleLike}
        onPressImage={onPressImage}
      />

      {replies.map((reply) => (
        <CommentRow
          key={reply.id}
          comment={asComment(reply)}
          inset
          viewerId={viewerId}
          isListingOwner={isVideoAuthor}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onReport={onReport}
          onToggleLike={onToggleLike}
          onPressImage={onPressImage}
        />
      ))}

      {hidden > 0 && !expanded ? (
        <Pressable
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginLeft: spacing.xxl,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              ...text.caption,
              ...weight("600"),
              color: colors.textMuted,
            }}
          >
            {t("comments.showReplies", { count: hidden })}
          </Text>
        </Pressable>
      ) : null}

      {expanded && isFetching ? (
        <ActivityIndicator color={colors.primary} />
      ) : null}
    </View>
  );
}
