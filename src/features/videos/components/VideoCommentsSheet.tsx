// The comments on a reel, in a sheet over the video — not a page away from it.
//
// A pushed screen took the reel off the display to talk about it, which is
// backwards: a comment is nearly always about the thing you are looking at,
// and half of them are written while it loops in the background. So the video
// keeps playing behind this, exactly as it does everywhere else short-form
// video has comments.
import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  EmptyState,
  ImageViewer,
  LoadingView,
  toast,
} from "@/src/components/ui";
import { radii, spacing, type } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { errorMessage } from "@/src/lib/api-error";
import { confirm } from "@/src/lib/alerts";
import { pickFromLibrary } from "@/src/lib/image-picker";
import { uploadImages } from "@/src/lib/upload-client";
import { requirePhone } from "@/src/features/auth/guest";
import { useAuthStore } from "@/src/features/auth/store/auth.store";
import {
  CommentComposer,
  type ComposerTarget,
} from "@/src/features/comments/components/CommentComposer";
import type { Comment } from "@/src/features/comments/api/comments.api";
import { VideoCommentThread } from "./VideoCommentThread";
import { ReportVideoSheet } from "./ReportVideoSheet";
import {
  useDeleteVideoComment,
  useEditVideoComment,
  usePostVideoComment,
  useToggleVideoCommentLike,
  useVideoComments,
} from "../hooks/useVideoComments";
import type {
  Video,
  VideoCommentImage,
  VideoCommentThread as Thread,
} from "../api/videos.api";

/**
 * The quick row above the composer.
 *
 * Not a sticker pack — those are image sets with licensing and a server to
 * host them. These are the eight reactions a property feed actually gets,
 * one tap from the thread, and a photo covers the rest: a screenshot of the
 * floor plan, a picture of the same street.
 */
const QUICK = ["❤️", "🔥", "👏", "😍", "🤔", "👍", "🏠", "💰"] as const;

/** Most of the screen, but never all of it: the reel stays visible above. */
const SHEET_RATIO = 0.74;

export function VideoCommentsSheet({
  video,
  visible,
  onClose,
}: {
  video: Video | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors, text } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const t = useT();

  const viewerId = useAuthStore((s) => s.user?.id);
  const videoId = video?.id;
  const isVideoAuthor = !!viewerId && video?.authorId === viewerId;

  const comments = useVideoComments(visible ? videoId : undefined);
  const post = usePostVideoComment(videoId ?? "");
  const edit = useEditVideoComment(videoId ?? "");
  const remove = useDeleteVideoComment(videoId ?? "");
  const like = useToggleVideoCommentLike(videoId ?? "");

  const [draft, setDraft] = useState("");
  // The picked photo lives here as a local URI for the preview, and as the
  // uploaded pair once the media endpoint answers. Uploading on pick rather
  // than on send keeps the send instant.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photo, setPhoto] = useState<VideoCommentImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [editing, setEditing] = useState<Comment | null>(null);
  /** Which comment is being flagged. The sheet below is the video's own. */
  const [reporting, setReporting] = useState<Comment | null>(null);

  const nameOf = useCallback(
    (c: Comment) =>
      [c.author?.name, c.author?.surname].filter(Boolean).join(" ") ||
      t("chat.unknownUser"),
    [t],
  );

  const target: ComposerTarget | null = editing
    ? { mode: "edit", name: nameOf(editing) }
    : replyTo
      ? { mode: "reply", name: nameOf(replyTo) }
      : null;

  const clearTarget = () => {
    setReplyTo(null);
    setEditing(null);
    setDraft("");
    setPhotoUri(null);
    setPhoto(null);
  };

  const close = () => {
    clearTarget();
    onClose();
  };

  const pickPhoto = async () => {
    const result = await pickFromLibrary({
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
      setPhoto(images[0]);
    } catch (error) {
      // Drop the preview with it: a thumbnail that will never send is worse
      // than no thumbnail, because the send button would stay lit.
      setPhotoUri(null);
      setPhoto(null);
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = () => {
    const body = draft.trim();
    if ((!body && !photo) || uploading || !videoId) return;

    if (editing) {
      if (!body) return;
      edit.mutate({ id: editing.id, body }, { onSuccess: clearTarget });
      return;
    }

    // The gate runs on send, not on focus: typing is not the commitment, and
    // being bounced to a phone screen mid-sentence loses the sentence.
    requirePhone(() =>
      post.mutate(
        { body, parentId: replyTo?.id, image: photo ?? undefined },
        { onSuccess: clearTarget },
      ),
    );
  };

  const onReply = useCallback((comment: Comment) => {
    setEditing(null);
    setReplyTo(comment);
    setDraft("");
  }, []);

  const onEdit = useCallback((comment: Comment) => {
    setReplyTo(null);
    setEditing(comment);
    setDraft(comment.body);
  }, []);

  const onDelete = useCallback(
    (comment: Comment) =>
      confirm({
        titleKey: "comments.deleteTitle",
        messageKey: comment.parentId
          ? "comments.deleteMessage"
          : "comments.deleteThreadMessage",
        confirmKey: "common.delete",
        destructive: true,
        onConfirm: () =>
          remove.mutate({
            ...comment,
            videoId: videoId!,
          }),
      }),
    [remove, videoId],
  );

  const onReport = useCallback(
    (comment: Comment) => requirePhone(() => setReporting(comment)),
    [],
  );

  const onToggleLike = useCallback(
    (comment: Comment) =>
      requirePhone(() =>
        like.mutate({ id: comment.id, liked: !comment.likedByMe }),
      ),
    [like],
  );

  return (
    // Kept MOUNTED and driven by `visible` — the same iOS dismissal-race
    // avoidance as every other sheet in this app.
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      // Both bars, not just the top one. statusBarTranslucent alone leaves
      // the modal window stopping ABOVE the navigation bar, so a sheet that
      // anchors its footer to the bottom has that footer clipped by the
      // system strip — and the dim never reaches it either, so whatever is
      // behind shows through at full brightness. Android is edge-to-edge
      // from targetSdk 35, which makes this the matching half of a pair.
      navigationBarTranslucent
      onRequestClose={close}
    >
      {/* The same container every other sheet in this app uses: the avoider
          IS the backdrop, and the panel inside it is sized in points. A
          percentage height inside a content-sized avoider resolves against
          nothing and collapses. */}
      <KeyboardAvoidingView
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: colors.overlay,
        }}
        // Android resizes the window for the keyboard on its own; adding
        // padding on top of that pushes the sheet off the screen.
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* The reel is still playing up there; tapping it closes the sheet. */}
        <Pressable
          style={{ position: "absolute", inset: 0 }}
          accessibilityElementsHidden
          importantForAccessibility="no"
          onPress={close}
        />

        <View
          accessibilityViewIsModal
          style={{
            height: Math.round(windowHeight * SHEET_RATIO),
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xxl,
            borderTopRightRadius: radii.xxl,
            overflow: "hidden",
          }}
        >
          {/* The grab handle and the count, which is the title. */}
          <View
            style={{
              alignItems: "center",
              paddingTop: spacing.sm,
              paddingBottom: spacing.xs,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: radii.pill,
                backgroundColor: colors.border,
                marginBottom: spacing.sm,
              }}
            />
            <Text style={text.bodyStrong}>
              {comments.total
                ? t("comments.titleCount", { count: comments.total })
                : t("comments.title")}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            {comments.isLoading ? (
              <LoadingView />
            ) : comments.isError ? (
              <EmptyState
                icon="cloud-offline-outline"
                tone="danger"
                title={t("listings.loadError")}
                description={
                  comments.error ? errorMessage(comments.error) : undefined
                }
                actionLabel={t("common.retry")}
                onAction={comments.refetch}
              />
            ) : (
              <FlatList<Thread>
                data={comments.items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{
                  padding: spacing.md,
                  gap: spacing.md,
                  flexGrow: 1,
                }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                ListEmptyComponent={
                  <EmptyState
                    icon="chatbubble-outline"
                    title={t("comments.emptyTitle")}
                    description={t("comments.addYours")}
                  />
                }
                renderItem={({ item }) => (
                  <VideoCommentThread
                    videoId={videoId!}
                    thread={item}
                    viewerId={viewerId}
                    isVideoAuthor={isVideoAuthor}
                    onReply={onReply}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onReport={onReport}
                    onToggleLike={onToggleLike}
                    onPressImage={setViewing}
                  />
                )}
                onEndReachedThreshold={0.5}
                onEndReached={() => {
                  if (comments.hasNextPage && !comments.isFetchingNextPage) {
                    void comments.fetchNextPage();
                  }
                }}
                ListFooterComponent={
                  comments.isFetchingNextPage ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : undefined
                }
              />
            )}
          </View>

          {/* One tap to say the obvious thing — a strip that belongs to the
              composer, sitting directly on top of it.

              `flexGrow: 0` is load-bearing. React Native gives a horizontal
              ScrollView `flexGrow: 1, flexShrink: 1`, so in a column this one
              split the sheet's leftover height with the list above it and
              left the emoji stranded in the middle of the panel with a
              couple of hundred points of nothing under them. Pinned to its
              own content, it sits where a reaction row belongs. */}
          {!editing ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{
                flexGrow: 0,
                flexShrink: 0,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
              contentContainerStyle={{
                alignItems: "center",
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                gap: spacing.md,
              }}
            >
              {QUICK.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => setDraft((d) => `${d}${emoji}`)}
                  accessibilityRole="button"
                  accessibilityLabel={emoji}
                  hitSlop={6}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.5 : 1,
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                  })}
                >
                  <Text style={{ ...type.heading, fontSize: 24 }}>{emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <CommentComposer
            value={draft}
            onChangeText={setDraft}
            onSubmit={onSubmit}
            sending={post.isPending || edit.isPending}
            target={target}
            onCancelTarget={clearTarget}
            bottomInset={insets.bottom}
            photoUri={photoUri}
            uploading={uploading}
            // An edit rewrites the words of a comment that already exists;
            // its photo is not up for changing, so the button is not offered.
            onPickPhoto={editing ? undefined : () => void pickPhoto()}
            onRemovePhoto={() => {
              setPhotoUri(null);
              setPhoto(null);
            }}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Flagging a comment. The same sheet the reel itself uses, pointed at
          a comment id — one queue, one set of reasons, one moderator. */}
      <ReportVideoSheet
        videoId={videoId ?? ""}
        commentId={reporting?.id}
        visible={!!reporting}
        onClose={() => setReporting(null)}
      />

      {viewing ? (
        <ImageViewer uri={viewing} onClose={() => setViewing(null)} />
      ) : null}
    </Modal>
  );
}
