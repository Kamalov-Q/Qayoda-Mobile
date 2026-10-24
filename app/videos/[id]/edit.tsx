// Editing a video after the fact: its caption, and the listing it points at.
//
// Not the footage. Replacing that is a different file, a different encode and
// a different charge — which is why this screen says nothing about it and the
// shelf offers "post another" instead.
import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Button,
  EmptyState,
  HEADER_EDGES,
  LoadingView,
  SelectSheet,
} from "@/src/components/ui";
import { radii, spacing, type } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { errorMessage } from "@/src/lib/api-error";
import { useMyListings } from "@/src/features/listings/hooks/useMyListings";
import { useVideo } from "@/src/features/videos/hooks/useVideoFeed";
import { useUpdateVideo } from "@/src/features/videos/hooks/useVideoActions";
import {
  VIDEO_CAPTION_MAX,
  type Video as VideoRow,
} from "@/src/features/videos/api/videos.api";

/** The sheet's "no listing" row. A sentinel, because Option values are strings. */
const NO_LISTING = "none";

export default function EditVideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();

  const { data: video, isLoading, isError, error, refetch } = useVideo(id);

  if (isLoading) {
    return (
      <Screen scroll={false} edges={HEADER_EDGES}>
        <Stack.Screen options={{ title: t("videos.editTitle") }} />
        <LoadingView />
      </Screen>
    );
  }

  if (isError || !video) {
    return (
      <Screen scroll={false} edges={HEADER_EDGES}>
        <Stack.Screen options={{ title: t("videos.editTitle") }} />
        <EmptyState
          icon="videocam-off-outline"
          tone="danger"
          title={t("videos.unavailable")}
          description={error ? errorMessage(error) : undefined}
          actionLabel={t("common.retry")}
          onAction={refetch}
        />
      </Screen>
    );
  }

  // The form is its own component so its fields can START from the video
  // rather than being synchronised into state by an effect once the fetch
  // lands — which is the same thing, two renders later, and a cascading
  // render the compiler is right to complain about.
  return <EditForm video={video} />;
}

function EditForm({ video }: { video: VideoRow }) {
  const { colors, text } = useTheme();
  const t = useT();
  const { data: listings } = useMyListings();
  const update = useUpdateVideo();

  const [caption, setCaption] = useState(video.caption ?? "");
  const [listingId, setListingId] = useState<string>(
    video.listingId ?? NO_LISTING,
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const listingOptions = useMemo(
    () => [
      { value: NO_LISTING, label: t("videos.linkListingNone") },
      ...(listings ?? []).map((l) => ({
        value: l.id,
        label: l.title ?? t("listings.untitled"),
      })),
      // A listing that has since been archived is still what this video
      // points at; without this row the picker would silently show "no
      // listing" and saving would quietly unlink it.
      ...(video.listingId && !listings?.some((l) => l.id === video.listingId)
        ? [
            {
              value: video.listingId,
              label: video.listing?.title ?? t("listings.untitled"),
            },
          ]
        : []),
    ],
    [listings, video, t],
  );

  const selected = listingOptions.find((o) => o.value === listingId);

  // Nothing to save until something actually differs — a disabled button is
  // clearer than a request that changes nothing.
  const dirty =
    caption.trim() !== (video.caption ?? "") ||
    (listingId === NO_LISTING ? null : listingId) !== video.listingId;

  const onSave = () => {
    if (!dirty) return;
    update.mutate(
      {
        id: video.id,
        caption: caption.trim(),
        listingId: listingId === NO_LISTING ? null : listingId,
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Screen edges={HEADER_EDGES} style={{ gap: spacing.lg }}>
      <Stack.Screen options={{ title: t("videos.editTitle") }} />

      {/* The clip, as a still. It is here to confirm which video is being
          edited, not to be watched — a player would invite a second set of
          expectations about what this screen can change. */}
      <View
        style={{
          flexDirection: "row",
          gap: spacing.md,
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 64,
            height: 96,
            borderRadius: radii.md,
            overflow: "hidden",
            backgroundColor: colors.surfaceRaised,
          }}
        >
          {video.thumbUrl ? (
            <Image
              source={{ uri: video.thumbUrl }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={text.bodyStrong} numberOfLines={1}>
            {video.caption || t("videos.listingVideo")}
          </Text>
          <Text style={{ ...text.caption, color: colors.textFaint }}>
            {t("videos.viewCount", { count: video.viewCount })}
          </Text>
        </View>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text style={text.label}>{t("videos.caption")}</Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={t("videos.captionPlaceholder")}
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={VIDEO_CAPTION_MAX}
          editable={!update.isPending}
          style={{
            ...type.body,
            color: colors.text,
            minHeight: 110,
            textAlignVertical: "top",
            padding: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        />
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text style={text.label}>{t("videos.linkListing")}</Text>
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          disabled={update.isPending}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="home-outline" size={18} color={colors.textMuted} />
          <Text style={{ ...text.body, flex: 1 }} numberOfLines={1}>
            {selected?.label ?? t("videos.linkListingNone")}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </Pressable>
        <Text style={{ ...text.caption, color: colors.textFaint }}>
          {t("videos.linkListingHint")}
        </Text>
      </View>

      <Button
        title={t("common.save")}
        icon="checkmark"
        onPress={onSave}
        loading={update.isPending}
        disabled={!dirty}
      />

      <SelectSheet
        visible={sheetOpen}
        title={t("videos.linkListing")}
        options={listingOptions}
        value={listingId}
        onSelect={setListingId}
        onClose={() => setSheetOpen(false)}
      />
    </Screen>
  );
}
