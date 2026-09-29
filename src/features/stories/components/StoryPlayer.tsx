import { memo, useEffect, useMemo } from "react";
import { Dimensions, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
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
        <StoryVideo url={story.mediaUrl} active={active} paused={paused} />
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
  active,
  paused,
}: {
  url: string;
  active: boolean;
  paused: boolean;
}) {
  const source = useMemo(() => resolveMediaUrl(url) ?? url, [url]);
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(() => {
    // Off-screen pages hold a player that must not be heard. `paused` is the
    // finger held down; `active` is which page the pager is on.
    if (active && !paused) player.play();
    else player.pause();
  }, [active, paused, player]);

  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: "100%" }}
      contentFit="contain"
      // The story's own chrome is the control surface; the system overlay
      // would fight the tap-to-advance areas either side of the screen.
      nativeControls={false}
      allowsPictureInPicture={false}
    />
  );
});

/** The tap targets that move between stories: a third of the width on the
 *  left goes back, the rest goes forward — Instagram's proportions. */
export const TAP_BACK_WIDTH = SCREEN_W / 3;
