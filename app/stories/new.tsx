// The composer: a photo, a video, or words on a colour — with an optional
// caption, an optional listing of yours to point at, and how long it stays up.
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Button,
  SelectSheet,
  HEADER_EDGES,
} from "../../src/components/ui";
import { radii, sizing, spacing, type } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";
import { toast } from "../../src/components/ui/Toast";
import { errorMessage } from "../../src/lib/api-error";
import { useMyListings } from "../../src/features/listings/hooks/useMyListings";
import { usePostStory } from "../../src/features/stories/hooks/useStories";
import {
  MAX_STORY_MB,
  measureStoryMedia,
  uploadStoryMedia,
} from "../../src/features/stories/api/story-upload";
import {
  STORY_BACKGROUNDS,
  STORY_BODY_MAX,
  STORY_HOURS,
  type StoryHours,
  type StoryType,
} from "../../src/features/stories/api/stories.api";

interface PickedMedia {
  localUri: string;
  kind: "IMAGE" | "VIDEO";
  fileName: string;
}

export default function NewStoryScreen() {
  const { colors, text } = useTheme();
  const t = useT();

  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [body, setBody] = useState("");
  const [background, setBackground] = useState(0);
  const [hours, setHours] = useState<StoryHours>(24);
  const [listingId, setListingId] = useState<string | null>(null);
  const [listingOpen, setListingOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const post = usePostStory();
  const { data: myListings } = useMyListings();

  // Only live listings: a story pointing at an archived advert is a dead end,
  // and the server refuses it anyway.
  const linkable = useMemo(
    () => (myListings ?? []).filter((l) => l.status === "ACTIVE"),
    [myListings],
  );

  const listingOptions = useMemo(
    () => [
      { value: "", label: t("stories.noLink"), icon: "close-circle-outline" as const },
      ...linkable.map((l) => ({
        value: l.id,
        label: l.title ?? t("listings.untitled"),
        icon: "home-outline" as const,
      })),
    ],
    [linkable, t],
  );

  const hourOptions = useMemo(
    () =>
      STORY_HOURS.map((h) => ({
        value: String(h),
        label: t("stories.hours", { count: h }),
        icon: "time-outline" as const,
      })),
    [t],
  );

  const pick = async (kind: "IMAGE" | "VIDEO") => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "VIDEO" ? ["videos"] : ["images"],
      quality: 0.9,
    });
    if (result.canceled) return;

    const asset = result.assets[0];

    // Checked here rather than after the upload: a phone pushing a 60MB
    // video over mobile data deserves to be told before it spends the five
    // minutes, not after the proxy refuses it.
    const { tooLarge } = await measureStoryMedia(asset.uri);
    if (tooLarge) {
      toast.error(t("errors.fileTooLarge", { mb: MAX_STORY_MB }));
      return;
    }

    setMedia({
      localUri: asset.uri,
      kind,
      fileName: asset.fileName ?? (kind === "VIDEO" ? "story.mp4" : "story.jpg"),
    });
  };

  const type_: StoryType = media ? media.kind : "TEXT";
  const canPost = media ? true : body.trim().length > 0;

  const submit = async () => {
    if (!canPost) {
      toast.errorKey(media ? "stories.needMedia" : "stories.needText");
      return;
    }

    try {
      let uploaded = null;
      if (media) {
        setUploading(true);
        uploaded = await uploadStoryMedia(
          media.localUri,
          media.kind,
          media.fileName,
        );
      }

      post.mutate(
        {
          type: type_,
          mediaUrl: uploaded?.url,
          thumbUrl: uploaded?.thumbUrl ?? undefined,
          width: uploaded?.width ?? undefined,
          height: uploaded?.height ?? undefined,
          durationSec: uploaded?.durationSec ?? undefined,
          body: body.trim() || undefined,
          background,
          listingId: listingId ?? undefined,
          hours,
        },
        {
          onSuccess: () => {
            toast.successKey("stories.posted");
            router.back();
          },
        },
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const palette = STORY_BACKGROUNDS[background] ?? STORY_BACKGROUNDS[0];
  const busy = uploading || post.isPending;

  return (
    <Screen edges={HEADER_EDGES} scroll={false}>
      <Stack.Screen options={{ title: t("stories.compose") }} />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {/* The story itself, at the shape it will be seen in. A text story is
            edited ON its background rather than in a plain field — what you
            are typing is what people will read. */}
        <View
          style={{
            height: 320,
            borderRadius: radii.xl,
            overflow: "hidden",
            backgroundColor: media ? colors.surfaceRaised : palette[1],
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {media ? (
            media.kind === "VIDEO" ? (
              // The video itself, playing and looping. An icon and a cache
              // filename told the poster nothing about what they had picked —
              // which is the one thing this box exists to show.
              <VideoPreview uri={media.localUri} />
            ) : (
              <Image
                source={{ uri: media.localUri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            )
          ) : (
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={t("stories.textPlaceholder")}
              placeholderTextColor="rgba(255,255,255,0.7)"
              multiline
              maxLength={STORY_BODY_MAX}
              style={{
                width: "100%",
                paddingHorizontal: spacing.lg,
                fontSize: 24,
                lineHeight: 32,
                fontWeight: "700",
                color: "#FFFFFF",
                textAlign: "center",
              }}
            />
          )}

          {media ? (
            <Pressable
              onPress={() => setMedia(null)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
              style={{
                position: "absolute",
                top: spacing.sm,
                right: spacing.sm,
                width: 32,
                height: 32,
                borderRadius: radii.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0,0,0,0.45)",
              }}
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>

        {/* What it is made of. Picking media turns the text into a caption
            rather than replacing it — the two go together. */}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <SourceButton
            icon="image-outline"
            label={t("stories.photo")}
            active={media?.kind === "IMAGE"}
            onPress={() => void pick("IMAGE")}
          />
          <SourceButton
            icon="videocam-outline"
            label={t("stories.video")}
            active={media?.kind === "VIDEO"}
            onPress={() => void pick("VIDEO")}
          />
          <SourceButton
            icon="text-outline"
            label={t("stories.text")}
            active={!media}
            onPress={() => setMedia(null)}
          />
        </View>

        {media ? (
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={t("stories.caption")}
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={STORY_BODY_MAX}
            style={{
              minHeight: 72,
              padding: spacing.md,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              color: colors.text,
              ...type.body,
            }}
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Text style={text.label}>{t("stories.background")}</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {STORY_BACKGROUNDS.map((colours, i) => (
                <Pressable
                  key={i}
                  onPress={() => setBackground(i)}
                  accessibilityRole="button"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: radii.pill,
                    backgroundColor: colours[0],
                    borderWidth: background === i ? 3 : 0,
                    borderColor: colors.text,
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* Where it sends people, and how long it lives. */}
        <Row
          icon="link-outline"
          label={t("stories.linkListing")}
          value={
            listingId
              ? (linkable.find((l) => l.id === listingId)?.title ??
                t("listings.untitled"))
              : t("stories.noLink")
          }
          hint={t("stories.linkListingHint")}
          disabled={!linkable.length}
          onPress={() => setListingOpen(true)}
        />
        <Row
          icon="time-outline"
          label={t("stories.duration")}
          value={t("stories.hours", { count: hours })}
          onPress={() => setHoursOpen(true)}
        />

        <Button
          title={busy ? "" : t("stories.post")}
          icon={busy ? undefined : "send"}
          loading={busy}
          disabled={!canPost || busy}
          onPress={() => void submit()}
        />
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : null}
      </ScrollView>

      <SelectSheet
        visible={listingOpen}
        title={t("stories.linkListing")}
        options={listingOptions}
        value={listingId ?? ""}
        onSelect={(v) => setListingId(v || null)}
        onClose={() => setListingOpen(false)}
      />

      <SelectSheet
        visible={hoursOpen}
        title={t("stories.duration")}
        options={hourOptions}
        value={String(hours)}
        onSelect={(v) => setHours(Number(v) as StoryHours)}
        onClose={() => setHoursOpen(false)}
      />
    </Screen>
  );
}

/** The picked video, looping silently — a preview, not a player. */
function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    // Muted: the composer is a place to look at what you picked, and a
    // preview that shouts is a preview people close.
    p.muted = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: "100%" }}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

function SourceButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flex: 1,
        height: sizing.control,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: active ? colors.primaryBorder : colors.border,
        backgroundColor: active
          ? colors.primarySoft
          : pressed
            ? colors.surfaceRaised
            : colors.surface,
      })}
    >
      <Ionicons
        name={icon}
        size={18}
        color={active ? colors.primary : colors.textMuted}
      />
      <Text
        style={{
          ...type.bodyStrong,
          fontSize: 14,
          color: active ? colors.primary : colors.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Row({
  icon,
  label,
  value,
  hint,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  hint?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors, text } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Ionicons name={icon} size={19} color={colors.primary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={text.caption}>{label}</Text>
        <Text style={text.bodyStrong} numberOfLines={1}>
          {value}
        </Text>
        {hint ? (
          <Text style={{ ...type.caption, color: colors.textFaint }}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}
