// Posting a video.
//
// The order on this screen is the order the money moves in, and both are
// deliberate: pick a clip, say what it is, point it at one of your listings
// if it is selling one, then upload. The posting fee is charged at the far
// end — when Bunny confirms a real file of a minute or less — so a clip that
// turns out to be too long, or an upload that dies in a lift, costs nothing.
// What this screen does promise is the price, before anything starts.
import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Button,
  Card,
  HEADER_EDGES,
  SelectSheet,
  toast,
} from "@/src/components/ui";
import { radii, spacing, type, weight } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { pickFromLibrary } from "@/src/lib/image-picker";
import { useTariffs } from "@/src/features/tariffs/hooks/useTariffs";
import { PriceNotice } from "@/src/features/tariffs/components/PriceNotice";
import { useWalletOverview } from "@/src/features/wallet/hooks/useWalletOverview";
import { useMyListings } from "@/src/features/listings/hooks/useMyListings";
import { useVideoUpload } from "@/src/features/videos/hooks/useVideoUpload";
import {
  VIDEO_CAPTION_MAX,
  VIDEO_MAX_DURATION_SEC,
} from "@/src/features/videos/api/videos.api";

/**
 * One way to get a clip: a glass pill on the preview frame.
 *
 * Always white on dark, like every control that sits on media in this app —
 * the frame behind it is a video or a black box in both schemes.
 */
function SourceChip({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingVertical: 6,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: "rgba(0,0,0,0.55)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.22)",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Ionicons name={icon} size={14} color="#FFFFFF" />
      <Text
        style={{ ...type.caption, ...weight("700"), color: "#FFFFFF" }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** The picker reports duration in milliseconds; phones round generously. */
const MAX_MS = (VIDEO_MAX_DURATION_SEC + 1) * 1000;

/** The sheet's "no listing" row. A sentinel, because Option values are strings. */
const NO_LISTING = "none";

export default function NewVideoScreen() {
  // Arriving from a listing ("film this flat") pre-selects it.
  const params = useLocalSearchParams<{ listingId?: string }>();
  const { colors, text } = useTheme();
  const t = useT();

  const [uri, setUri] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | undefined>();
  const [caption, setCaption] = useState("");
  const [listingId, setListingId] = useState<string>(
    params.listingId ?? NO_LISTING,
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const { priceOf } = useTariffs();
  const { data: wallet } = useWalletOverview();
  const { data: listings } = useMyListings();
  const upload = useVideoUpload();

  const price = priceOf("VIDEO_POST");

  const listingOptions = useMemo(
    () => [
      { value: NO_LISTING, label: t("videos.linkListingNone") },
      ...(listings ?? []).map((l) => ({
        value: l.id,
        label: l.title ?? t("listings.untitled"),
      })),
    ],
    [listings, t],
  );

  const selectedListing = listingOptions.find((o) => o.value === listingId);

  // A preview of what they picked. Muted and looping: this is a thumbnail
  // that moves, not a place to watch the clip back.
  const preview = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  const take = async (from: "library" | "camera") => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["videos"],
      // The picker's own limit, so most over-long clips are stopped before
      // they are even chosen. The server still measures the encoded file —
      // this is the courtesy, not the rule.
      videoMaxDuration: VIDEO_MAX_DURATION_SEC,
      quality: 0.8,
    };

    const result =
      from === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await pickFromLibrary(options);

    if (result.canceled) return;

    const asset = result.assets[0];
    // Android's gallery ignores videoMaxDuration, so the check has to happen
    // here too — otherwise the author pays for the upload of a clip the
    // server is going to refuse.
    if (asset.duration != null && asset.duration > MAX_MS) {
      toast.errorKey("videos.tooLong");
      return;
    }

    setUri(asset.uri);
    setMimeType(asset.mimeType);
  };

  const onCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      toast.errorKey("videos.permission");
      return;
    }
    await take("camera");
  };

  const onSubmit = async () => {
    if (!uri) {
      toast.errorKey("videos.pickFirst");
      return;
    }

    const videoId = await upload.start({
      uri,
      caption: caption.trim() || undefined,
      listingId: listingId === NO_LISTING ? undefined : listingId,
      mimeType,
    });
    if (!videoId) return;

    toast.successKey("videos.uploadDone");
    // The shelf, not the feed: the video is encoding, and this is the screen
    // that shows that happening — and the one with the publish button on it
    // if the wallet turns out to be short.
    router.replace("/videos/mine");
  };

  const percent = Math.round(upload.progress * 100);

  return (
    <Screen edges={HEADER_EDGES} style={{ gap: spacing.lg }}>
      <Stack.Screen options={{ title: t("videos.add") }} />

      {/* The clip, in a frame the shape of the thing it is going to become.
          A wide box was the wrong promise: a reel is portrait, and a
          letterboxed preview inside a landscape card tells a seller nothing
          about how their video will look in the feed. */}
      <View style={{ alignSelf: "center" }}>
        <Pressable
          onPress={() => void take("library")}
          accessibilityRole="button"
          accessibilityLabel={uri ? t("videos.replace") : t("videos.pick")}
          disabled={upload.isBusy}
          style={({ pressed }) => ({
            // Sized by height, with 9:16 deriving the width — the frame of
            // every clip this feed shows. Tall enough to judge the footage,
            // short enough that the caption and the price are still on the
            // same screenful.
            height: 340,
            aspectRatio: 9 / 16,
            borderRadius: radii.xl,
            overflow: "hidden",
            borderWidth: uri ? 0 : 1,
            borderColor: colors.border,
            backgroundColor: uri ? "#000000" : colors.surfaceRaised,
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          {uri ? (
            <VideoView
              player={preview}
              style={{ width: "100%", height: "100%" }}
              // The whole frame, not a crop of it: this is the one screen
              // whose job is showing what you actually picked.
              contentFit="contain"
              nativeControls={false}
            />
          ) : (
            <>
              <Ionicons
                name="videocam-outline"
                size={30}
                color={colors.textMuted}
              />
              <Text
                style={{
                  ...text.body,
                  color: colors.textMuted,
                  textAlign: "center",
                }}
              >
                {t("videos.pick")}
              </Text>
              <Text
                style={{
                  ...text.caption,
                  color: colors.textFaint,
                  textAlign: "center",
                }}
              >
                {t("videos.maxDuration")}
              </Text>
            </>
          )}
        </Pressable>

        {/* Gallery and camera, as chips ON the frame rather than two slabs
            under it. They used to be full-width secondary buttons, which
            took a whole row for two incidental choices — and "Снять на
            камеру" did not fit inside one, so the label ran off its own
            border. A chip is as wide as its words, whatever the language. */}
        {!upload.isBusy ? (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: spacing.sm,
              flexDirection: "row",
              justifyContent: "center",
              gap: spacing.xs,
            }}
            pointerEvents="box-none"
          >
            <SourceChip
              icon="images-outline"
              label={t("videos.gallery")}
              onPress={() => void take("library")}
            />
            <SourceChip
              icon="camera-outline"
              label={t("videos.camera")}
              onPress={() => void onCamera()}
            />
          </View>
        ) : null}
      </View>

      {/* Caption. Not required: plenty of good reels are a flat and no words. */}
      <View style={{ gap: spacing.xs }}>
        <Text style={text.label}>{t("videos.caption")}</Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={t("videos.captionPlaceholder")}
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={VIDEO_CAPTION_MAX}
          editable={!upload.isBusy}
          style={{
            ...type.body,
            color: colors.text,
            minHeight: 84,
            textAlignVertical: "top",
            padding: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        />
      </View>

      {/* The listing link: the whole reason a property app has a reel feed. */}
      <View style={{ gap: spacing.xs }}>
        <Text style={text.label}>{t("videos.linkListing")}</Text>
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          disabled={upload.isBusy}
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
            {selectedListing?.label ?? t("videos.linkListingNone")}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </Pressable>
        <Text style={{ ...text.caption, color: colors.textFaint }}>
          {listings?.length
            ? t("videos.linkListingHint")
            : t("videos.noListings")}
        </Text>
      </View>

      <PriceNotice price={price} balance={wallet?.balance} />

      {upload.isBusy ? (
        <Card style={{ gap: spacing.sm }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <ActivityIndicator color={colors.primary} />
            <Text style={{ ...text.body, flex: 1 }}>
              {/* Compressing and uploading both have a percentage and both
                  take a visible number of seconds; saying which one is
                  running is the difference between waiting and wondering. */}
              {upload.phase === "compressing"
                ? t("videos.compressing", { percent })
                : t("videos.uploading", { percent })}
            </Text>
          </View>

          {/* A real bar, because a 40 MB upload on mobile data is a minute of
              somebody's attention and a spinner says nothing about how much
              of it is left. */}
          <View
            style={{
              height: 4,
              borderRadius: radii.pill,
              backgroundColor: colors.border,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${percent}%`,
                height: 4,
                borderRadius: radii.pill,
                backgroundColor: colors.primary,
              }}
            />
          </View>

          <Text style={{ ...text.caption, color: colors.textFaint }}>
            {t("videos.uploadingHint")}
          </Text>

          <Pressable
            onPress={upload.cancel}
            accessibilityRole="button"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text
              style={{
                ...text.caption,
                ...weight("700"),
                color: colors.danger,
              }}
            >
              {t("videos.cancelUpload")}
            </Text>
          </Pressable>
        </Card>
      ) : (
        <Button
          title={t("videos.add")}
          icon="cloud-upload-outline"
          onPress={() => void onSubmit()}
          disabled={!uri}
        />
      )}

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
