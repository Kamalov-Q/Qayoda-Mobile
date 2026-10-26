// The author's own shelf: every video they have, in whatever state it is in.
//
// This screen exists because posting a video is not instant and is not free.
// A clip spends a minute being encoded, and if the wallet was empty when it
// finished, it waits here for 48 hours with a publish button on it. Hiding
// that behind the public feed would mean paying for something and seeing
// nothing happen.
import { memo, useCallback } from "react";
import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { router, Stack } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Button,
  EmptyState,
  HEADER_EDGES,
  LoadingView,
} from "@/src/components/ui";
import { radii, spacing, weight } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT, useLanguage, type TranslationKey } from "@/src/i18n";
import { confirm } from "@/src/lib/alerts";
import { handleChargeError } from "@/src/features/tariffs/lib/charge-errors";
import { toast } from "@/src/components/ui/Toast";
import { useMyVideos } from "@/src/features/videos/hooks/useMyVideos";
import {
  useDeleteVideo,
  usePublishVideo,
} from "@/src/features/videos/hooks/useVideoActions";
import type { Video } from "@/src/features/videos/api/videos.api";

export default function MyVideosScreen() {
  const { colors } = useTheme();
  const t = useT();
  const videos = useMyVideos();
  const publish = usePublishVideo();
  const remove = useDeleteVideo();

  const onPublish = useCallback(
    (video: Video) =>
      publish.mutate(video.id, {
        onSuccess: () => toast.successKey("videos.published"),
        // The one failure worth a dialog rather than a toast: an empty wallet
        // is fixable, and the fix is one screen away.
        onError: handleChargeError,
      }),
    [publish],
  );

  const onDelete = useCallback(
    (video: Video) =>
      confirm({
        titleKey: "videos.deleteTitle",
        messageKey: "videos.deleteMessage",
        confirmKey: "common.delete",
        destructive: true,
        onConfirm: () => remove.mutate(video.id),
      }),
    [remove],
  );

  /**
   * Shared by both branches on purpose.
   *
   * The "+" lived only on the LOADING screen's header, so it flashed up for
   * as long as the request took and then vanished — leaving the footer
   * button at the bottom of the list as the only way to add a second video,
   * and the empty state's button as the only way anybody found.
   */
  const headerOptions = {
    title: t("videos.mine"),
    headerRight: () => (
      <Pressable
        onPress={() => router.push("/videos/new")}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t("videos.add")}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Ionicons name="add" size={26} color={colors.primary} />
      </Pressable>
    ),
  };

  if (videos.isLoading) {
    return (
      <Screen scroll={false} edges={HEADER_EDGES}>
        <Stack.Screen options={headerOptions} />
        <LoadingView />
      </Screen>
    );
  }

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={HEADER_EDGES}>
      <Stack.Screen options={headerOptions} />

      <FlatList
        data={videos.items}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{
          padding: spacing.md,
          gap: spacing.md,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={videos.isRefetching}
            onRefresh={() => void videos.refetch()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="videocam-outline"
            title={t("videos.mineEmpty")}
            description={t("videos.emptyHint")}
            actionLabel={t("videos.add")}
            onAction={() => router.push("/videos/new")}
          />
        }
        ListFooterComponent={
          videos.items.length ? (
            <Button
              title={t("videos.add")}
              icon="add"
              variant="secondary"
              onPress={() => router.push("/videos/new")}
            />
          ) : undefined
        }
        renderItem={({ item }) => (
          <VideoRow
            video={item}
            onOpen={() =>
              item.status === "READY"
                ? router.push(`/videos/${item.id}`)
                : undefined
            }
            onEdit={() => router.push(`/videos/${item.id}/edit`)}
            onDelete={() => onDelete(item)}
            onPublish={() => onPublish(item)}
            publishing={publish.isPending}
          />
        )}
      />
    </Screen>
  );
}

/**
 * Where this video is, in the author's own terms.
 *
 * A failure says which failure: "not published" invites a support message,
 * "longer than a minute" is something the person can act on themselves.
 */
function statusKey(video: Video): TranslationKey {
  switch (video.status) {
    case "UPLOADING":
      return "videos.processing";
    case "AWAITING_PAYMENT":
      return "videos.awaitingPayment";
    case "READY":
      return "videos.published";
    case "EXPIRED":
      return "videos.expired";
    case "REMOVED":
      return "videos.removed";
    case "FAILED":
      return video.failReason === "TOO_LONG"
        ? "videos.failedTooLong"
        : video.failReason === "ENCODING_FAILED"
          ? "videos.failedEncoding"
          : video.failReason === "ABANDONED"
            ? "videos.failedAbandoned"
            : "videos.failed";
  }
}

/**
 * One video on the shelf.
 *
 * The caption used to be the loudest thing in the row and the only thing
 * with room — two lines of it, with the state and the view count trailing
 * underneath. That is backwards: on your own shelf you are looking for a
 * state ("did it publish?") and a number ("did anyone watch?"), and the
 * caption is how you recognise which clip you are looking at. So: a
 * reel-shaped still to recognise it by, one line of caption, and the state
 * where the eye lands.
 */
const VideoRow = memo(function VideoRow({
  video,
  onOpen,
  onEdit,
  onDelete,
  onPublish,
  publishing,
}: {
  video: Video;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPublish: () => void;
  publishing: boolean;
}) {
  const { colors, text } = useTheme();
  const t = useT();
  const language = useLanguage();

  const ready = video.status === "READY";
  const awaiting = video.status === "AWAITING_PAYMENT";
  const broken =
    video.status === "FAILED" ||
    video.status === "EXPIRED" ||
    video.status === "REMOVED";
  const tone = ready
    ? colors.primary
    : awaiting || broken
      ? colors.danger
      : colors.textMuted;

  const when = new Date(video.publishedAt ?? video.createdAt);

  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        {/* The still, in the shape the clip will play in. Tappable only when
            there is something to play: a row that navigates nowhere teaches
            people not to tap rows. */}
        <Pressable
          onPress={ready ? onOpen : undefined}
          disabled={!ready}
          accessibilityRole={ready ? "button" : "image"}
          accessibilityLabel={video.caption ?? t("videos.listingVideo")}
          style={({ pressed }) => ({
            width: 54,
            height: 96,
            borderRadius: radii.md,
            overflow: "hidden",
            backgroundColor: colors.surfaceRaised,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.8 : 1,
          })}
        >
          {video.thumbUrl ? (
            <Image
              source={{ uri: video.thumbUrl }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : (
            <Ionicons
              name="videocam-outline"
              size={18}
              color={colors.textFaint}
            />
          )}

          {ready ? (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
              pointerEvents="none"
            >
              <Ionicons
                name="play-circle"
                size={26}
                color="rgba(255,255,255,0.9)"
              />
            </View>
          ) : null}
        </Pressable>

        <View style={{ flex: 1, gap: 3 }}>
          {/* State first, in its own colour, with a dot so it reads as a
              status rather than as a second line of caption. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: tone,
              }}
            />
            <Text
              style={{ ...text.caption, ...weight("700"), color: tone }}
              numberOfLines={1}
            >
              {t(statusKey(video))}
            </Text>
          </View>

          <Text style={text.body} numberOfLines={1}>
            {video.caption || t("videos.listingVideo")}
          </Text>

          {/* What a published clip is actually worth knowing: who watched,
              who reacted. Hidden on everything else, where the numbers are
              all zero and say nothing. */}
          {ready ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <Stat icon="eye-outline" value={video.viewCount} />
              <Stat icon="heart-outline" value={video.likeCount} />
              <Stat icon="chatbubble-outline" value={video.commentCount} />
            </View>
          ) : null}

          <Text style={{ ...text.caption, color: colors.textFaint }}>
            {when.toLocaleDateString(language, {
              day: "numeric",
              month: "short",
            })}
          </Text>

          {/* Which advert this clip is attached to — the one thing about a
              video on your own shelf that is not visible from the still. */}
          {video.listing ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons name="home-outline" size={12} color={colors.primary} />
              <Text
                style={{ ...text.caption, color: colors.primary, flex: 1 }}
                numberOfLines={1}
              >
                {video.listing.title ?? t("listings.untitled")}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Edit and delete, as two quiet glyphs rather than one lonely bin.
            Editing a caption is the thing people come to this screen for;
            it had no way in at all. */}
        <View style={{ gap: spacing.xs }}>
          {!broken ? (
            <IconButton
              icon="create-outline"
              label={t("videos.edit")}
              onPress={onEdit}
            />
          ) : null}
          {video.status !== "REMOVED" ? (
            <IconButton
              icon="trash-outline"
              label={t("videos.delete")}
              onPress={onDelete}
              tone={colors.danger}
            />
          ) : null}
        </View>
      </View>

      {/* The one state with something to do about it. */}
      {awaiting ? (
        <View style={{ gap: spacing.xs }}>
          <Text style={{ ...text.caption, color: colors.textFaint }}>
            {t("videos.awaitingPaymentHint")}
          </Text>
          <Button
            title={t("videos.publish")}
            size="sm"
            loading={publishing}
            onPress={onPublish}
          />
        </View>
      ) : null}

      {video.status === "UPLOADING" ? (
        <Text style={{ ...text.caption, color: colors.textFaint }}>
          {t("videos.processingHint")}
        </Text>
      ) : null}
    </View>
  );
});

/** One number with its glyph. Muted: these are facts, not controls. */
const Stat = memo(function Stat({
  icon,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
}) {
  const { colors, text } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Ionicons name={icon} size={13} color={colors.textMuted} />
      <Text style={{ ...text.caption, color: colors.textMuted }}>{value}</Text>
    </View>
  );
});

/** A 32pt target around a 17pt glyph, which is the smallest honest button. */
const IconButton = memo(function IconButton({
  icon,
  label,
  onPress,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceRaised,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={17} color={tone ?? colors.textMuted} />
    </Pressable>
  );
});
