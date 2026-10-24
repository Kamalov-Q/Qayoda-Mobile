// The owner's control over their advert's walkthrough: add one, replace it,
// or take it off.
//
// It lives with the photos, on the media screen, because that is what it is
// to the person editing: another piece of the gallery. The states it has to
// show are the ones Bunny's pipeline actually produces — encoding takes a
// minute and the three-minute limit is checked against the ENCODED file, so
// "uploaded" and "will play" are genuinely different moments and a UI that
// pretends otherwise lies for a minute every time.
import { memo } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/src/components/ui";
import { radii, spacing, weight } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT, type TranslationKey } from "@/src/i18n";
import { confirm } from "@/src/lib/alerts";
import { toast } from "@/src/components/ui/Toast";
import { pickFromLibrary } from "@/src/lib/image-picker";
import {
  LISTING_VIDEO_MAX_DURATION_SEC,
  type ListingVideo,
} from "../api/listing-videos.api";
import {
  useDeleteListingVideo,
  useListingVideo,
  useListingVideoUpload,
} from "../hooks/useListingVideo";

/** Why it will never play, in the owner's terms. */
function failKey(video: ListingVideo): TranslationKey {
  switch (video.failReason) {
    case "TOO_LONG":
      return "listingVideo.failedTooLong";
    case "ENCODING_FAILED":
      return "listingVideo.failedEncoding";
    case "ABANDONED":
      return "listingVideo.failedAbandoned";
    default:
      return "listingVideo.failed";
  }
}

export const ListingVideoEditor = memo(function ListingVideoEditor({
  listingId,
}: {
  listingId: string;
}) {
  const { colors, text } = useTheme();
  const t = useT();

  const { data: video, isLoading } = useListingVideo(listingId);
  const upload = useListingVideoUpload(listingId);
  const remove = useDeleteListingVideo(listingId);

  const pick = async () => {
    const result = await pickFromLibrary({
      mediaTypes: ["videos"],
      quality: 1,
      // A hard cap the picker can enforce before a single byte is read. The
      // server checks the encoded file too — a phone can be talked out of
      // this one — but catching it here saves an upload and a minute.
      videoMaxDuration: LISTING_VIDEO_MAX_DURATION_SEC,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (
      asset.duration != null &&
      asset.duration / 1000 > LISTING_VIDEO_MAX_DURATION_SEC + 2
    ) {
      toast.errorKey("listingVideo.tooLongPick");
      return;
    }
    await upload.start({ uri: asset.uri, mimeType: asset.mimeType });
  };

  const onRemove = () =>
    confirm({
      titleKey: "listingVideo.removeTitle",
      messageKey: "listingVideo.removeMessage",
      confirmKey: "common.delete",
      destructive: true,
      onConfirm: () => remove.mutate(),
    });

  const busy = upload.isBusy;
  const encoding =
    video?.status === "UPLOADING" || upload.phase === "processing";

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ gap: 2 }}>
        <Text style={text.label}>{t("listingVideo.title")}</Text>
        <Text style={{ ...text.caption, color: colors.textFaint }}>
          {t("listingVideo.hint")}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <View
          style={{
            flexDirection: "row",
            gap: spacing.md,
            padding: spacing.sm,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          {/* The still, in the shape a gallery slide is. Empty frame with a
              glyph when there is nothing yet — a dashed box that says "no
              video" reads as a broken image. */}
          <Pressable
            onPress={busy ? undefined : () => void pick()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t(
              video ? "listingVideo.replace" : "listingVideo.add",
            )}
            style={({ pressed }) => ({
              width: 92,
              height: 64,
              borderRadius: radii.md,
              overflow: "hidden",
              backgroundColor: colors.surfaceRaised,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            {video?.thumbUrl ? (
              <Image
                source={{ uri: video.thumbUrl }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : (
              <Ionicons
                name="videocam-outline"
                size={22}
                color={colors.textFaint}
              />
            )}
          </Pressable>

          <View style={{ flex: 1, gap: spacing.xs, justifyContent: "center" }}>
            {busy ? (
              <>
                <Text style={{ ...text.caption, ...weight("700") }}>
                  {t(
                    upload.phase === "compressing"
                      ? "listingVideo.compressing"
                      : upload.phase === "preparing"
                        ? "listingVideo.preparing"
                        : "listingVideo.uploading",
                  )}
                </Text>
                {/* A real bar, not a spinner: a three-minute film over mobile
                    data is long enough that "is this moving?" is a fair
                    question to be able to answer. */}
                <View
                  style={{
                    height: 4,
                    borderRadius: radii.pill,
                    backgroundColor: colors.surfaceRaised,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(upload.progress * 100)}%`,
                      height: "100%",
                      backgroundColor: colors.primary,
                    }}
                  />
                </View>
                <Button
                  title={t("common.cancel")}
                  variant="link"
                  size="sm"
                  onPress={upload.cancel}
                />
              </>
            ) : encoding ? (
              <>
                <Text style={{ ...text.caption, ...weight("700") }}>
                  {t("listingVideo.processing")}
                </Text>
                <Text style={{ ...text.caption, color: colors.textFaint }}>
                  {t("listingVideo.processingHint")}
                </Text>
              </>
            ) : video?.status === "FAILED" ? (
              <>
                <Text
                  style={{
                    ...text.caption,
                    ...weight("700"),
                    color: colors.danger,
                  }}
                >
                  {t(failKey(video))}
                </Text>
                <Button
                  title={t("listingVideo.tryAgain")}
                  variant="secondary"
                  size="sm"
                  icon="refresh"
                  onPress={() => void pick()}
                />
              </>
            ) : video?.status === "READY" ? (
              <>
                <Text style={{ ...text.caption, ...weight("700") }}>
                  {t("listingVideo.ready")}
                </Text>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Button
                    title={t("listingVideo.replace")}
                    variant="secondary"
                    size="sm"
                    onPress={() => void pick()}
                  />
                  <Button
                    title={t("common.delete")}
                    variant="link"
                    size="sm"
                    loading={remove.isPending}
                    onPress={onRemove}
                  />
                </View>
              </>
            ) : (
              <Button
                title={t("listingVideo.add")}
                variant="secondary"
                size="sm"
                icon="videocam-outline"
                onPress={() => void pick()}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
});
