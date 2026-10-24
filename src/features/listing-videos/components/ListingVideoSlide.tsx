// The tour, as the first slide of the listing's gallery.
//
// In the gallery rather than in a section of its own, because that is what
// it is: a photo of the property that moves. A separate "Video" block
// further down the page would be a second place to look for the same thing
// — and the one thing a walkthrough is better than the photos at is being
// the FIRST impression, which it cannot be from below the fold.
//
// It does not autoplay. A listing page is often opened in a quiet room or on
// mobile data, and a video that starts talking by itself is the reason
// people learn to scroll past galleries. Tap the poster, it plays with
// sound; tap again, it stops.
import { memo, useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { radii, spacing, type, weight } from "@/src/theme/tokens";
import { useT } from "@/src/i18n";
import type { ListingVideo } from "../api/listing-videos.api";

/** "2:14" — the only time format a three-minute film ever needs. */
function mmss(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const ListingVideoSlide = memo(function ListingVideoSlide({
  video,
  width,
  height,
  /** False once the gallery has been swiped off this slide. */
  visible,
}: {
  video: ListingVideo;
  width: number;
  height: number;
  visible: boolean;
}) {
  const t = useT();
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Created with no source: a listing page that is never scrolled to the
  // video should not have opened an HLS stream for it.
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    // Unmuted, unlike a reel. Nothing plays until a deliberate tap, and a
    // walkthrough with the agent's commentary muted is half a walkthrough.
    p.muted = false;
  });

  // Hand the clip over on the first tap and never again.
  useEffect(() => {
    if (!started || !video.hlsUrl) return;
    void player
      .replaceAsync({ uri: video.hlsUrl, contentType: "hls" })
      .then(() => player.play())
      .catch(() => undefined);
  }, [started, video.hlsUrl, player]);

  // Swiping to a photo stops the sound. Leaving it running behind a picture
  // of the kitchen is the kind of thing people close the whole app over.
  useEffect(() => {
    if (!visible) player.pause();
  }, [visible, player]);

  useEffect(() => {
    const sub = player.addListener("playingChange", ({ isPlaying }) =>
      setPlaying(isPlaying),
    );
    return () => sub.remove();
  }, [player]);

  const onTap = useCallback(() => {
    if (!started) {
      setStarted(true);
      return;
    }
    if (player.playing) player.pause();
    else player.play();
  }, [started, player]);

  return (
    <Pressable
      onPress={onTap}
      accessibilityRole="button"
      accessibilityLabel={t(
        playing ? "listingVideo.pause" : "listingVideo.play",
      )}
      style={{ width, height, backgroundColor: "#000000" }}
    >
      {/* The poster stays underneath for the whole life of the slide: it is
          what fills the frame before the first tap, and again for the second
          or two between the tap and the first decoded frame. */}
      {video.thumbUrl ? (
        <Image
          source={{ uri: video.thumbUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
        />
      ) : null}

      {started ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
          allowsPictureInPicture={false}
        />
      ) : null}

      {/* The play badge, and the only thing that tells a first-time viewer
          this slide is not a photo. Hidden while it is actually playing. */}
      {!playing ? (
        <View
          style={[StyleSheet.absoluteFill, styles.centre]}
          pointerEvents="none"
        >
          <View style={styles.badge}>
            <Ionicons
              name="play"
              size={32}
              color="rgba(255,255,255,0.95)"
              // Optically centred: a triangle's mass sits left of its box.
              style={{ marginLeft: 4 }}
            />
          </View>
        </View>
      ) : null}

      {/* "Video · 2:14", bottom left, clear of the gallery's own dots. A
          viewer swiping a gallery deserves to know how long the one slide
          that costs them data is going to take. */}
      <View style={styles.tag} pointerEvents="none">
        <Ionicons name="videocam" size={12} color="#FFFFFF" />
        <Text style={styles.tagText}>
          {t("listingVideo.tag")}
          {video.durationSec ? ` · ${mmss(video.durationSec)}` : ""}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center" },
  badge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    // Dark enough to hold the glyph over a bright frame, light enough that
    // the room behind it is still the thing you are looking at.
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  tag: {
    position: "absolute",
    left: spacing.md,
    bottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  tagText: { ...type.caption, ...weight("700"), color: "#FFFFFF" },
});
