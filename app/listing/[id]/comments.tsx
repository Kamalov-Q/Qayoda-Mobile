// The whole thread under one listing, with the composer pinned at the bottom.
import { useCallback, useState } from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Screen,
  EmptyState,
  ImageViewer,
  HEADER_EDGES,
  toast,
} from "../../../src/components/ui";
import { uploadImages } from "../../../src/lib/upload-client";
import { spacing } from "../../../src/theme/tokens";
import { useTheme } from "../../../src/theme/useTheme";
import { useT } from "../../../src/i18n";
import { errorMessage } from "../../../src/lib/api-error";
import { confirm } from "../../../src/lib/alerts";
import { requirePhone } from "../../../src/features/auth/guest";
import { useAuthStore } from "../../../src/features/auth/store/auth.store";
import { useListing } from "../../../src/features/listings/hooks/useListing";
import { CommentThreadItem } from "../../../src/features/comments/components/CommentThreadItem";
import {
  CommentComposer,
  type ComposerTarget,
} from "../../../src/features/comments/components/CommentComposer";
import {
  useComments,
  useDeleteComment,
  useEditComment,
  usePostComment,
  useToggleCommentLike,
} from "../../../src/features/comments/hooks/useComments";
import type {
  Comment,
  CommentImage,
  CommentThread,
} from "../../../src/features/comments/api/comments.api";

export default function ListingCommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();

  const viewerId = useAuthStore((s) => s.user?.id);
  const { data: listing } = useListing(id);
  const isListingOwner = !!viewerId && listing?.ownerId === viewerId;

  const comments = useComments(id);
  const post = usePostComment(id!);
  const edit = useEditComment(id!);
  const remove = useDeleteComment(id!);
  const like = useToggleCommentLike(id!);

  const [draft, setDraft] = useState("");
  // The picked photo lives here as a local URI for the preview, and as the
  // uploaded pair once the media endpoint answers. Uploading on pick rather
  // than on send keeps the send instant and puts the waiting where the
  // person can see what it is for.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photo, setPhoto] = useState<CommentImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  // What the composer is pointed at: a reply's parent, or the comment being
  // rewritten. Null means a plain new comment.
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [editing, setEditing] = useState<Comment | null>(null);

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
    // A photo on its own is a comment; an edit still needs words, since the
    // photo on an existing comment is not what an edit changes.
    if (!body && !photo) return;
    if (uploading) return;

    if (editing) {
      if (!body) return;
      edit.mutate({ id: editing.id, body }, { onSuccess: clearTarget });
      return;
    }
    // The gate runs here rather than on focus: typing is not the commitment,
    // sending is, and being bounced to a phone screen mid-sentence would
    // lose the sentence.
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
        onConfirm: () => remove.mutate(comment),
      }),
    [remove],
  );

  const onToggleLike = useCallback(
    (comment: Comment) =>
      requirePhone(() =>
        like.mutate({ id: comment.id, liked: !comment.likedByMe }),
      ),
    [like],
  );

  const body = comments.isLoading ? (
    <ActivityIndicator
      style={{ marginTop: spacing.xxl }}
      color={colors.primary}
    />
  ) : comments.isError ? (
    <EmptyState
      icon="cloud-offline-outline"
      tone="danger"
      title={t("listings.loadError")}
      description={comments.error ? errorMessage(comments.error) : undefined}
      actionLabel={t("common.retry")}
      onAction={comments.refetch}
    />
  ) : (
    <FlatList<CommentThread>
      data={comments.items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={comments.isRefetching}
          onRefresh={comments.refetch}
          tintColor={colors.primary}
        />
      }
      ListEmptyComponent={
        <EmptyState
          icon="chatbubble-outline"
          title={t("comments.emptyTitle")}
          description={t("comments.emptyHint")}
        />
      }
      renderItem={({ item }) => (
        <CommentThreadItem
          listingId={id!}
          thread={item}
          viewerId={viewerId}
          isListingOwner={isListingOwner}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
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
        ) : null
      }
    />
  );

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={HEADER_EDGES}>
      <Stack.Screen
        options={{
          title: comments.total
            ? t("comments.titleCount", { count: comments.total })
            : t("comments.title"),
        }}
      />

      {/* The composer has to ride above the keyboard — it is the only control
          on the screen, and a thread you cannot answer is a dead end. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 44}
      >
        <View style={{ flex: 1 }}>{body}</View>

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
          // An edit rewrites the words of a comment that already exists; its
          // photo is not up for changing, so the button is not offered.
          onPickPhoto={editing ? undefined : () => void pickPhoto()}
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
