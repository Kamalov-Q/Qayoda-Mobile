import { memo, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView, type VideoPlayerStatus } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { spacing, type } from "@/src/theme/tokens";
import { resolveMediaUrl } from "@/src/lib/media-url";
import { STORY_BACKGROUNDS, type Story } from "../api/stories.api";

const { width: SCREEN_W } = Dimensions.get("window");

/** How long a photo or a text story stays up before it advances itself. */
export const STILL_DURATION_MS = 6000;

interface Props {
  story: Story;
  /** False while this page is off-screen in the pager — a video two pages
   *  away should not be playing to nobody. */
  active: boolean;
  paused: boolean;
  /** Videos open silent, like every feed does; the reader turns it on. */
  muted: boolean;
  /** Notify parent when the video is still buffering so timer can pause. */
  onBufferingChange?: (buffering: boolean) => void;
}

/**
 * One story, filling the screen.
 *
 * Three shapes in one component because a story is one thing to a reader:
 * a photo, a video, or words on a colour — any of which may carry a caption.
 * Splitting them would mean three components that must agree on layout.
 */
export const StoryPlayer = memo(function StoryPlayer({
  story,
  active,
  paused,
  muted,
  onBufferingChange,
}: Props) {
  const background =
    STORY_BACKGROUNDS[story.background] ?? STORY_BACKGROUNDS[0];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: background[1],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {story.type === "VIDEO" && story.mediaUrl ? (
        <StoryVideo
          url={story.mediaUrl}
          thumbUrl={story.thumbUrl}
          active={active}
          paused={paused}
          muted={muted}
          onBufferingChange={onBufferingChange}
        />
      ) : story.type === "IMAGE" && story.mediaUrl ? (
        <Image
          source={{ uri: resolveMediaUrl(story.mediaUrl) }}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : (
        <TextStory story={story} />
      )}

      {/* A caption over media. Scrollable, because six hundred characters
          over a photo is a wall unless the reader can move it. */}
      {story.body && story.type !== "TEXT" ? (
        <ScrollView
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: 180,
          }}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.xxl,
          }}
        >
          <Text
            style={{
              ...type.body,
              color: "#FFFFFF",
              textShadowColor: "rgba(0,0,0,0.85)",
              textShadowRadius: 6,
            }}
          >
            {story.body}
          </Text>
        </ScrollView>
      ) : null}
    </View>
  );
});

/** Words on a colour. Sized to the words: a short shout is big, a paragraph
 *  settles down to something readable. */
const TextStory = memo(function TextStory({ story }: { story: Story }) {
  const body = story.body ?? "";
  const fontSize = body.length < 40 ? 34 : body.length < 140 ? 26 : 19;

  return (
    <ScrollView
      style={{ width: "100%" }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        padding: spacing.xl,
      }}
    >
      <Text
        style={{
          fontSize,
          lineHeight: fontSize * 1.32,
          fontWeight: "700",
          color: "#FFFFFF",
          textAlign: "center",
        }}
      >
        {body}
      </Text>
    </ScrollView>
  );
});

const StoryVideo = memo(function StoryVideo({
  url,
  thumbUrl,
  active,
  paused,
  muted,
  onBufferingChange,
}: {
  url: string;
  thumbUrl?: string | null;
  active: boolean;
  paused: boolean;
  muted: boolean;
  onBufferingChange?: (buffering: boolean) => void;
}) {
  const source = useMemo(() => resolveMediaUrl(url) ?? url, [url]);
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.muted = true;
  });

  const [status, setStatus] = useState<VideoPlayerStatus>(player.status);

  // Monitor buffering and readiness
  useEffect(() => {
    const isBuffering = player.status !== "readyToPlay";
    if (active) {
      onBufferingChange?.(isBuffering);
    }

    const sub = player.addListener("statusChange", ({ status: s }) => {
      setStatus(s);
      if (active) {
        onBufferingChange?.(s !== "readyToPlay");
      }
    });

    return () => {
      sub.remove();
    };
  }, [player, active, onBufferingChange]);

  useEffect(() => {
    // Off-screen pages hold a player that must not be heard. `paused` is the
    // finger held down; `active` is which page the pager is on.
    if (active && !paused && status === "readyToPlay") {
      player.play();
    } else {
      player.pause();
    }
  }, [active, paused, status, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  const isReady = status === "readyToPlay";
  const isError = status === "error";
  const isLoading = !isReady && !isError;

  return (
    <View style={styles.videoContainer}>
      <VideoView
        player={player}
        style={styles.fullMedia}
        contentFit="contain"
        nativeControls={false}
        allowsPictureInPicture={false}
      />

      {/* Render thumbnail as placeholder while buffering */}
      {!isReady && thumbUrl && (
        <Image
          source={{ uri: resolveMediaUrl(thumbUrl) }}
          style={[styles.fullMedia, StyleSheet.absoluteFill]}
          contentFit="contain"
        />
      )}

      {/* High-quality buffering spinner overlay */}
      {isLoading && (
        <View style={styles.overlayCenter} pointerEvents="none">
          <View style={styles.loadingGlass}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.loadingText}>Yuklanmoqda...</Text>
          </View>
        </View>
      )}

      {/* Error state with retry */}
      {isError && (
        <View style={styles.overlayCenter}>
          <View style={styles.errorGlass}>
            <Ionicons name="alert-circle-outline" size={26} color="#EF4444" />
            <Text style={styles.errorText}>{"Videoni yuklab bo'lmadi"}</Text>
            <Pressable
              onPress={() => {
                player.replay();
              }}
              style={styles.retryBtn}
            >
              <Text style={styles.retryBtnText}>Qayta urinish</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  videoContainer: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  fullMedia: {
    width: "100%",
    height: "100%",
  },
  overlayCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  loadingGlass: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  errorGlass: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 13,
    fontWeight: "600",
  },
  retryBtn: {
    marginTop: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});

/** The tap targets that move between stories: a third of the width on the
 *  left goes back, the rest goes forward — Instagram's proportions. */
export const TAP_BACK_WIDTH = SCREEN_W / 3;
