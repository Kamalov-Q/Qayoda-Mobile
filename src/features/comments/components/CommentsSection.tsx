// The comments block on a listing page: the newest few and the way into the
// rest. Not the whole thread and not a composer — the detail page is already
// long, and writing belongs on the screen where the keyboard has room.
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { requirePhone } from "@/src/features/auth/guest";
import { CommentRow } from "./CommentRow";
import { useComments, useToggleCommentLike } from "../hooks/useComments";
import type { Comment } from "../api/comments.api";

/** How many of the newest comments the listing page shows. */
const PREVIEW = 3;

export function CommentsSection({ listingId }: { listingId: string }) {
  const { colors, text } = useTheme();
  const t = useT();
  const comments = useComments(listingId);
  const like = useToggleCommentLike(listingId);

  const open = () => router.push(`/listing/${listingId}/comments`);

  if (comments.isLoading) {
    return (
      <View style={{ paddingVertical: spacing.lg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const preview = comments.items.slice(0, PREVIEW);

  return (
    <View style={{ gap: spacing.sm }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={text.heading}>{t("comments.title")}</Text>
        {comments.total > PREVIEW ? (
          <Pressable
            onPress={open}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                ...text.caption,
                color: colors.primary,
                fontWeight: "600",
              }}
            >
              {t("comments.seeAll", { count: comments.total })}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      {preview.map((comment: Comment) => (
        <CommentRow
          key={comment.id}
          comment={comment}
          onToggleLike={() =>
            requirePhone(() =>
              like.mutate({ id: comment.id, liked: !comment.likedByMe }),
            )
          }
        />
      ))}

      {/* Doubles as the empty state: with nothing to preview this is the only
          thing in the block, and "be the first" is a better empty than a
          crossed-out speech bubble. */}
      <Pressable
        onPress={open}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          padding: spacing.md,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderStyle: preview.length ? "solid" : "dashed",
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceRaised : "transparent",
        })}
      >
        <Ionicons
          name="chatbubble-outline"
          size={16}
          color={colors.textMuted}
        />
        <Text style={{ ...text.caption, flex: 1 }}>
          {t(preview.length ? "comments.addYours" : "comments.emptyHint")}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      </Pressable>
    </View>
  );
}
