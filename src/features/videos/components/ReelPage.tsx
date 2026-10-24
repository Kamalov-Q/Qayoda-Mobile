import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Avatar } from "@/src/components/ui";
import { radii, spacing, type, weight } from "@/src/theme/tokens";
import { useT } from "@/src/i18n";
import { formatThousands } from "@/src/features/wallet/components/VirtualCard";
import { useVideoLive } from "../hooks/useVideoLive";
import { useImmersiveStore } from "../store/immersive.store";
import type { Video } from "../api/videos.api";

/** How long a tap waits to find out whether it was the first of two. */
const DOUBLE_TAP_MS = 220;

/**
 * The scrubber.
 *
 * A hairline most of the time, thick enough to grab while you are grabbing
 * it. The touch area is far taller than the line it draws — a 2pt target is
 * not a target, and the alternative (a permanently chunky bar) is a slab of
 * UI across the bottom of somebody's living room.
 */
const SCRUB_TOUCH_HEIGHT = 28;
const SCRUB_LINE = 2;
const SCRUB_LINE_ACTIVE = 5;
/** Seeking an HLS stream on every frame of a drag is how a player stutters. */
const SEEK_THROTTLE_MS = 120;

/** 0:07 — the only time format a clip of under a minute ever needs. */
function mmss(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface Props {
  video: Video;
  /** The page's height, measured by the pager — one reel fills exactly one. */
  height: number;
  /** The one page the pager has settled on. Exactly one may be true. */
  active: boolean;
  /**
   * Near enough to be worth loading: the active page and its immediate
   * neighbours. Everything else keeps its poster and no player source at all.
   */
  near: boolean;
  muted: boolean;
  onToggleSound: () => void;
  onLike: (video: Video) => void;
  onComment: (video: Video) => void;
  onShare: (video: Video) => void;
  /** Absent on your own reel — the author has a delete button, not a flag. */
  onReport?: (video: Video) => void;
  /** Watch time, handed over when this reel stops being the active one. */
  onWatched?: (videoId: string, watchedMs: number) => void;
}

/**
 * One reel: the video, full-bleed, with the author and caption over the
 * bottom of the picture and the actions up the right edge.
 *
 * The performance of the whole tab is decided by three rules in here, and
 * they are the difference between a feed that scrolls and a phone that gets
 * hot:
 *
 * 1. **One player has a source.** A sourceless `expo-video` player is an
 *    empty native object; the clip is only handed to it when the page is the
 *    active one or next to it. Mounting three decoders with three live HLS
 *    streams is what makes every Instagram clone stutter.
 * 2. **Only the active page plays.** The neighbour is loaded and paused, so
 *    the swipe into it starts instantly without it ever having decoded in the
 *    background.
 * 3. **The poster is shown until the first frame is ready.** A still from the
 *    CDN arrives in a fraction of the time the manifest does, so the feed
 *    looks instant on a slow connection instead of showing black.
 */
export const ReelPage = memo(function ReelPage({
  video,
  height,
  active,
  near,
  muted,
  onToggleSound,
  onLike,
  onComment,
  onShare,
  onReport,
  onWatched,
}: Props) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [firstFrame, setFirstFrame] = useState(false);
  /** Tapped to a stop. Only ever true on the page the pager has settled on. */
  const [paused, setPaused] = useState(false);
  /**
   * Held down for a clear look: the clip stops and every overlay leaves.
   *
   * Separate from `paused` because they end differently. A tap-pause lasts
   * until the next tap; a hold lasts exactly as long as the finger, and
   * lifting it puts the reel back the way it was — including leaving it
   * stopped, if it was stopped before the hold.
   */
  const [holding, setHolding] = useState(false);
  const [burst, setBurst] = useState(0);
  const [expanded, setExpanded] = useState(false);
  /**
   * 0–1 of the way through the clip, on the UI thread.
   *
   * A shared value, not state: it moves twice a second while playing and on
   * every frame of a drag, and none of that should re-render a video.
   */
  const progress = useSharedValue(0);
  /** True while a finger owns the position — the player stops driving it. */
  const scrubbing = useRef(false);
  const [scrubbingUI, setScrubbingUI] = useState(false);
  /** The time bubble's text, refreshed at the seek throttle, not per frame. */
  const [scrubLabel, setScrubLabel] = useState("");

  // Created with no source: see rule 1. Looping, because a reel repeats until
  // you swipe off it — that is the format.
  const player = useVideoPlayer(null, (p) => {
    p.loop = true;
    p.muted = true;
    // Four seconds ahead is plenty for a clip of sixty, and it is data the
    // viewer only pays for if they stay.
    p.bufferOptions = { preferredForwardBufferDuration: 4 };
  });

  // The counters, live, for as long as this is the page being watched.
  useVideoLive(video.id, active);

  const source = video.hlsUrl;

  /**
   * Fill the page, or show the whole frame.
   *
   * `cover` only when the clip is already within a few per cent of the
   * page's own shape, where the crop is a hairline. Everything else is shown
   * whole: a 9:16 clip on a 19.5:9 phone loses a fifth of its width to
   * `cover`, which is exactly the "why is it zoomed in" that a seller notices
   * when the room they filmed arrives with its walls cut off.
   *
   * The dimensions come from Bunny's probe of the encoded file, so a video
   * still being processed has none — and letterboxing something whose shape
   * we do not know is the safe way round.
   */
  const { width: pageWidth } = useWindowDimensions();
  const fit = useMemo<"cover" | "contain">(() => {
    if (!video.width || !video.height || !height || !pageWidth) {
      return "contain";
    }
    const clip = video.width / video.height;
    const page = pageWidth / height;
    return Math.abs(clip - page) / page <= 0.06 ? "cover" : "contain";
  }, [video.width, video.height, height, pageWidth]);

  useEffect(() => {
    if (!source) return;

    // replaceAsync, not replace: on iOS the synchronous version loads the
    // asset on the main thread — it is deprecated for exactly that reason,
    // and in a pager that swaps sources on every swipe it is a visible hitch.
    // The rejection is swallowed because the only way it fails is the page
    // being recycled mid-load, which is not a thing to crash a feed over.
    if (near) {
      void player
        .replaceAsync({ uri: source, contentType: "hls" })
        .catch(() => undefined);
    } else {
      // Off the window: hand the decoder back rather than keeping a stream
      // open for a page nobody is near.
      void player.replaceAsync(null).catch(() => undefined);
      setFirstFrame(false);
    }
  }, [near, source, player]);

  useEffect(() => {
    if (!active) {
      player.pause();
      // A reel you swiped away from should not be waiting, stopped, when you
      // come back to it — the pause was about this moment, not this video.
      setPaused(false);
      return;
    }
    if (paused || holding) player.pause();
    else player.play();
  }, [active, paused, holding, player]);

  useEffect(() => {
    // Assigning to `muted` IS expo-video's API: the player is a handle to a
    // native object, there is no setter to call instead, and recreating it to
    // change a flag would drop the position and re-buffer the clip.
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    const sub = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") setFirstFrame(true);
    });
    return () => sub.remove();
  }, [player]);

  /**
   * The scrubber line.
   *
   * Subscribed only while this page is the active one, and at two frames a
   * second — a reel is sixty seconds at most, so a finer interval would be
   * three state updates a second to move a line by a pixel.
   */
  useEffect(() => {
    if (!active) return;

    player.timeUpdateEventInterval = 0.5;
    const sub = player.addListener("timeUpdate", ({ currentTime }) => {
      // A drag owns the bar while it lasts: letting the player write here too
      // makes the line flick between the finger and wherever the stream has
      // actually got to.
      if (scrubbing.current) return;
      const total = video.durationSec ?? 0;
      progress.value = total > 0 ? Math.min(1, currentTime / total) : 0;
    });

    // Only the subscription is torn down here. Writing to the player in a
    // cleanup is what crashed this screen on the way out: leaving the tab
    // unmounts the page, expo-video frees the native object, and the
    // property set that follows throws NotFoundException ("unable to find
    // the native shared object"). Removing the listener is enough — the
    // event has nowhere left to land, and an inactive page is paused, so it
    // is not firing anyway.
    return () => sub.remove();
  }, [active, player, video.durationSec, progress]);

  /**
   * Watch time, measured as wall clock while this page is the active one.
   *
   * Reported on the way out rather than on a timer: the server counts a
   * viewer once, and what it wants to know is how long they stayed — which is
   * only knowable when they leave.
   */
  const startedAt = useRef<number | null>(null);
  const watched = useRef(0);

  // Open and close a stretch of watching. Paused time is not watching, which
  // matters now that a tap stops the clip rather than muting it.
  useEffect(() => {
    if (active && !paused && !holding) {
      startedAt.current = Date.now();
      return;
    }
    if (startedAt.current != null) {
      watched.current += Date.now() - startedAt.current;
      startedAt.current = null;
    }
  }, [active, paused, holding]);

  // Declared after the one above, so by the time this runs for the same
  // `active` change the open stretch has already been closed into the total.
  useEffect(() => {
    if (active || watched.current === 0) return;
    onWatched?.(video.id, watched.current);
    watched.current = 0;
  }, [active, video.id, onWatched]);

  useEffect(
    () => () => {
      // Unmounted mid-watch — recycled by the list, or the screen closed.
      const open =
        startedAt.current != null ? Date.now() - startedAt.current : 0;
      const total = watched.current + open;
      if (total > 0) onWatched?.(video.id, total);
      watched.current = 0;
      startedAt.current = null;
    },
    [video.id, onWatched],
  );

  /**
   * One tap stops the clip, two like it — the gestures every short-form
   * player has, sharing one surface because that surface is the whole
   * picture. The first tap waits to find out which it was.
   *
   * Tapping used to mute. Sound is the quieter decision of the two and it
   * already has a button on the rail; stopping a clip to read the caption,
   * or to look at the room behind the agent, is the thing people reach for
   * mid-reel and had no way to do.
   */
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTap = useCallback(() => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      if (!video.likedByMe) setBurst((n) => n + 1);
      onLike(video);
      return;
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      setPaused((p) => !p);
    }, DOUBLE_TAP_MS);
  }, [video, onLike]);

  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );

  /**
   * Press and hold: the clip stops and everything drawn over it leaves.
   *
   * The third gesture every short-form player has, and the only one that
   * answers "what is actually in that room" — a reel is a wall of caption,
   * rail and scrim over the footage, and the one moment you want none of it
   * is the moment you are looking at the picture itself. Held, not toggled:
   * it lasts exactly as long as the finger, so there is nothing to undo and
   * no state anybody can get stuck in.
   *
   * The store is what carries this past the pager — the feed's own header
   * and the tab bar are drawn by screens this component cannot reach.
   */
  const chrome = useSharedValue(1);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));
  const setImmersive = useImmersiveStore((s) => s.setImmersive);

  const onLongPress = useCallback(() => {
    // A hold supersedes the tap that started it. The single-tap timer is
    // already running by the time a press turns long, and letting it land
    // would leave the reel tap-paused after the finger lifts.
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
    }
    setHolding(true);
    setImmersive(true);
    chrome.value = withTiming(0, { duration: 140 });
  }, [setImmersive, chrome]);

  // Fires on every release, hold or not; setting what is already set costs
  // nothing and means there is no path that leaves the chrome hidden.
  const onPressOut = useCallback(() => {
    setHolding(false);
    setImmersive(false);
    chrome.value = withTiming(1, { duration: 140 });
  }, [setImmersive, chrome]);

  // A page recycled mid-hold — swiped hard, or the tab left — would otherwise
  // leave the header and tab bar faded out with no finger left to restore
  // them.
  useEffect(() => () => setImmersive(false), [setImmersive]);

  /**
   * Dragging the line at the bottom to move through the clip.
   *
   * The visual position follows the finger on the UI thread; the player is
   * seeked on a throttle and then once more, exactly, on release. Seeking an
   * HLS stream sixty times a second is what makes a scrubber feel like it is
   * fighting you.
   */
  const duration = video.durationSec ?? 0;
  const lastSeekAt = useRef(0);

  const seekTo = useCallback(
    (ratio: number) => {
      if (duration <= 0) return;
      const at = Math.max(0, Math.min(duration, ratio * duration));
      try {
        player.currentTime = at;
      } catch {
        // The page was recycled mid-drag and the native player is gone.
        // Nothing to seek, and nothing worth crashing a feed over.
      }
      setScrubLabel(`${mmss(at)} / ${mmss(duration)}`);
    },
    [duration, player],
  );

  const onScrubStart = useCallback(() => {
    scrubbing.current = true;
    setScrubbingUI(true);
  }, []);

  const onScrubMove = useCallback(
    (ratio: number) => {
      const now = Date.now();
      if (now - lastSeekAt.current < SEEK_THROTTLE_MS) return;
      lastSeekAt.current = now;
      seekTo(ratio);
    },
    [seekTo],
  );

  const onScrubEnd = useCallback(
    (ratio: number) => {
      // Finalize fires for gestures that never activated too — a tap on the
      // strip, or a swipe the pager won. Neither moved anything, so neither
      // should seek.
      if (!scrubbing.current) return;
      seekTo(ratio);
      scrubbing.current = false;
      setScrubbingUI(false);
    },
    [seekTo],
  );

  const scrub = useMemo(
    () =>
      Gesture.Pan()
        // Sideways intent claims the bar; anything vertical is the pager's.
        // This strip is the bottom 28pt of the screen — exactly where a thumb
        // starts a swipe to the next reel — so paging has to win, and a
        // gesture that activated on touch-down would steal every one of them.
        .activeOffsetX([-4, 4])
        .failOffsetY([-12, 12])
        .enabled(duration > 0)
        // On activation, not on touch-down: the line jumps to the finger and
        // follows it from there, which is how a bar this thin is grabbed.
        .onStart((e) => {
          progress.value = Math.max(0, Math.min(1, e.x / pageWidth));
          runOnJS(onScrubStart)();
        })
        .onUpdate((e) => {
          const ratio = Math.max(0, Math.min(1, e.x / pageWidth));
          progress.value = ratio;
          runOnJS(onScrubMove)(ratio);
        })
        // Finalize rather than end, so a cancelled drag — the pager taking
        // over, a finger leaving the screen oddly — lands in the same place
        // as a finished one.
        .onFinalize(() => {
          runOnJS(onScrubEnd)(progress.value);
        }),
    [duration, pageWidth, progress, onScrubStart, onScrubMove, onScrubEnd],
  );

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  const knobStyle = useAnimatedStyle(() => ({
    left: `${progress.value * 100}%`,
  }));

  const author = video.author;
  const name =
    [author?.name, author?.surname].filter(Boolean).join(" ") ||
    t("chat.unknownUser");

  return (
    <View style={{ height, backgroundColor: "#000000" }}>
      {/* What fills the bars when the clip does not fill the page: its own
          poster, blown up and blurred. Black bars read as a broken player;
          this reads as the room the video is of. */}
      {fit === "contain" && video.thumbUrl ? (
        <Image
          source={{ uri: video.thumbUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={28}
          pointerEvents="none"
        />
      ) : null}

      {/* Behind the video and never removed: it is also what fills the frame
          while a paused neighbour has no first frame of its own. Fitted the
          same way as the video, so nothing jumps when the first frame
          arrives. */}
      {video.thumbUrl ? (
        <Image
          source={{ uri: video.thumbUrl }}
          style={StyleSheet.absoluteFill}
          contentFit={fit}
          // The blurred placeholder of a placeholder is overkill; the poster
          // itself is a few kilobytes off a CDN edge.
          transition={160}
        />
      ) : null}

      {near && source ? (
        <VideoView
          player={player}
          style={[StyleSheet.absoluteFill, { opacity: firstFrame ? 1 : 0 }]}
          // See `fit` above: fills the page when the clip is that shape, and
          // shows the whole frame when it is not.
          contentFit={fit}
          nativeControls={false}
          allowsPictureInPicture={false}
        />
      ) : null}

      {/* The gesture surface: the whole picture, under the overlay. One tap
          stops, two like, and a hold clears the screen down to the footage.
          280ms is past the double-tap window above it, so the two never race. */}
      <Pressable
        onPress={onTap}
        onLongPress={onLongPress}
        onPressOut={onPressOut}
        delayLongPress={280}
        accessibilityRole="button"
        accessibilityLabel={t(paused ? "videos.play" : "videos.pause")}
        style={StyleSheet.absoluteFill}
      />

      {/* Stopped. A play triangle rather than a pause bar: it names what the
          next tap does, which is the only thing anybody reads it for. Not
          during a hold — a badge is chrome, and a hold is the request to be
          rid of chrome. */}
      {paused && !holding ? (
        <View
          style={[StyleSheet.absoluteFill, styles.centre]}
          pointerEvents="none"
        >
          <View style={styles.pauseBadge}>
            <Ionicons name="play" size={40} color="rgba(255,255,255,0.95)" />
          </View>
        </View>
      ) : null}

      {/* The double-tap heart. Mounted only for the moment it is on screen,
          and never when the OS asks for less motion. */}
      {burst > 0 && !reduceMotion ? (
        <Animated.View
          key={burst}
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.centre,
            {
              animationName: {
                "0%": { opacity: 0, transform: [{ scale: 0.6 }] },
                "30%": { opacity: 1, transform: [{ scale: 1.15 }] },
                "60%": { opacity: 1, transform: [{ scale: 1 }] },
                "100%": { opacity: 0, transform: [{ scale: 1.4 }] },
              },
              animationDuration: "750ms",
              animationTimingFunction: "ease-out",
              animationFillMode: "forwards",
            },
          ]}
        >
          <Ionicons name="heart" size={110} color="rgba(255,255,255,0.92)" />
        </Animated.View>
      ) : null}

      <Animated.View style={[styles.scrim, chromeStyle]} pointerEvents="none">
        <Scrim />
      </Animated.View>

      {/* Author, caption and — the point of the whole feature — the way into
          the listing the clip is selling. */}
      <Animated.View
        style={[styles.bottom, chromeStyle]}
        pointerEvents={holding ? "none" : "box-none"}
      >
        <Pressable
          onPress={() => router.push(`/profile/${video.authorId}`)}
          accessibilityRole="button"
          accessibilityLabel={name}
          style={({ pressed }) => [
            styles.authorRow,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Avatar
            name={name}
            uri={author?.avatarThumbUrl ?? undefined}
            size={34}
          />
          <Text style={styles.author} numberOfLines={1}>
            {name}
          </Text>
          {author?.isVerifiedRealtor ? (
            <Ionicons name="checkmark-circle" size={15} color="#4FC3F7" />
          ) : null}
        </Pressable>

        {/* Two lines, then "more". Opened, the caption gets a surface of its
            own rather than more white text on a frame nobody chose: a
            caption may be 2 200 characters, and over a bright video — a
            white kitchen, a screenshot, a sunlit balcony — unbacked text
            at that length is unreadable whatever the scrim underneath is
            doing.

            The open panel is NOT a Pressable. It was, and that is why a long
            caption opened and then refused to move: the Pressable took the
            touch on press-in and a drag inside it came back as a press,
            which closed the panel instead of scrolling it — and the drags
            that got past it went to the pager and swiped to the next reel.
            So the panel is a plain view that owns its own drags, and closing
            it is its own target underneath. */}
        {!video.caption ? null : expanded ? (
          <View style={styles.captionPanel}>
            <ScrollView
              style={{ maxHeight: Math.min(260, height * 0.34) }}
              showsVerticalScrollIndicator
              // White: the default dark bar is invisible on this panel.
              indicatorStyle="white"
              // The feed underneath scrolls the same axis; without this
              // Android's pager claims every drag that starts in here.
              nestedScrollEnabled
            >
              <Text style={styles.caption}>{video.caption}</Text>
            </ScrollView>

            <Pressable
              onPress={() => setExpanded(false)}
              accessibilityRole="button"
              accessibilityState={{ expanded: true }}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={styles.captionMore}>{t("common.close")}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setExpanded(true)}
            accessibilityRole="button"
            accessibilityState={{ expanded: false }}
            accessibilityLabel={video.caption}
          >
            <Text style={styles.caption} numberOfLines={2}>
              {video.caption}
            </Text>
            {video.caption.length > 70 ? (
              <Text style={styles.captionMore}>{t("common.more")}</Text>
            ) : null}
          </Pressable>
        )}

        {video.listing ? (
          <Pressable
            onPress={() => router.push(`/listing/${video.listing!.id}`)}
            accessibilityRole="button"
            accessibilityLabel={t("videos.openListing")}
            style={({ pressed }) => [
              styles.listingCta,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            {video.listing.thumbUrl ? (
              <Image
                source={{ uri: video.listing.thumbUrl }}
                style={styles.listingThumb}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.listingThumb, styles.centre]}>
                <Ionicons name="home-outline" size={16} color="#FFFFFF" />
              </View>
            )}

            <View style={{ flex: 1, gap: 1 }}>
              <Text style={styles.listingTitle} numberOfLines={1}>
                {video.listing.title ?? t("listings.untitled")}
              </Text>
              {video.listing.price ? (
                <Text style={styles.listingPrice} numberOfLines={1}>
                  {formatThousands(video.listing.price)}{" "}
                  {video.listing.currency === "USD" ? "$" : t("listings.som")}
                </Text>
              ) : null}
            </View>

            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </Animated.View>

      {/* Where you are in the clip, and how you move through it.
          A hairline until a finger lands on it, then thick enough to drag
          with a knob and the time to aim by. The touch strip is 28pt tall so
          the 2pt line is actually grabbable; it sits under the action rail,
          whose buttons keep their own taps. */}
      {active && duration > 0 ? (
        <GestureDetector gesture={scrub}>
          <Animated.View
            style={[styles.scrubArea, chromeStyle]}
            pointerEvents={holding ? "none" : "auto"}
          >
            {scrubbingUI && scrubLabel ? (
              <View style={styles.scrubBubble} pointerEvents="none">
                <Text style={styles.scrubBubbleText}>{scrubLabel}</Text>
              </View>
            ) : null}

            <View
              style={[
                styles.scrubTrack,
                {
                  height: scrubbingUI ? SCRUB_LINE_ACTIVE : SCRUB_LINE,
                },
              ]}
              pointerEvents="none"
            >
              <Animated.View style={[styles.scrubFill, fillStyle]} />
              {scrubbingUI ? (
                <Animated.View style={[styles.scrubKnob, knobStyle]} />
              ) : null}
            </View>
          </Animated.View>
        </GestureDetector>
      ) : null}

      <Animated.View
        style={[styles.rail, chromeStyle]}
        pointerEvents={holding ? "none" : "box-none"}
      >
        <RailButton
          icon={video.likedByMe ? "heart" : "heart-outline"}
          tint={video.likedByMe ? "#FF4D67" : "#FFFFFF"}
          label={count(video.likeCount)}
          accessibilityLabel={t("videos.like")}
          onPress={() => onLike(video)}
        />
        <RailButton
          icon="chatbubble-outline"
          label={count(video.commentCount)}
          accessibilityLabel={t("videos.comment")}
          onPress={() => onComment(video)}
        />
        {/* No number under this one. A share count measures menus opened,
            not reels sent — the sheet never reports what happened after it. */}
        <RailButton
          icon="paper-plane-outline"
          accessibilityLabel={t("videos.share")}
          onPress={() => onShare(video)}
        />
        <RailButton
          icon={muted ? "volume-mute" : "volume-high"}
          accessibilityLabel={t("videos.sound")}
          onPress={onToggleSound}
        />
        {/* Flagging a reel, exactly as a listing is flagged: same sheet, same
            reasons, same moderation queue — a clip that should not be up is
            the same problem whichever page it is on.

            Only on somebody else's reel. `onReport` arrives undefined on your
            own, where the answer to a video you regret is the delete button
            on your shelf, not a complaint about yourself. */}
        {onReport ? (
          <RailButton
            icon="alert-circle-outline"
            accessibilityLabel={t("report.action")}
            onPress={() => onReport(video)}
          />
        ) : null}
        {/* Not a button: the one number here nobody can move. */}
        <View style={styles.viewBlock}>
          <Ionicons
            name="eye-outline"
            size={20}
            color="rgba(255,255,255,0.8)"
          />
          <Text style={styles.railLabel}>{count(video.viewCount)}</Text>
        </View>
      </Animated.View>
    </View>
  );
});

/**
 * The bottom scrim.
 *
 * A real gradient rather than the flat 34% block this used to be. The block
 * had a visible edge where it started — a horizontal seam across the middle
 * of every reel — and it had to stay weak to hide that seam, which left white
 * text fighting bright footage at the bottom where all of it lives. The
 * gradient can be transparent where the video should be untouched and nearly
 * opaque where the author, the caption and the listing sit.
 *
 * Drawn with react-native-svg, which the brand mark already uses: it is one
 * static shape per page, and the alternative without a new dependency is a
 * stack of four stepped blocks, which is the seam again, four times.
 */
const Scrim = memo(function Scrim() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="reelScrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity="0" />
          <Stop offset="0.45" stopColor="#000000" stopOpacity="0.34" />
          <Stop offset="1" stopColor="#000000" stopOpacity="0.8" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#reelScrim)" />
    </Svg>
  );
});

/** Zero is not worth printing — it reads as a broken counter. */
const count = (n: number) => (n > 0 ? String(n) : undefined);

const RailButton = memo(function RailButton({
  icon,
  label,
  tint = "#FFFFFF",
  accessibilityLabel,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  tint?: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        alignItems: "center",
        gap: 3,
        opacity: pressed ? 0.6 : 1,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Ionicons name={icon} size={28} color={tint} />
      {label ? <Text style={styles.railLabel}>{label}</Text> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center" },
  pauseBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    // Dark enough to hold the glyph over a bright frame, light enough that
    // the picture behind it is still the thing you are looking at.
    backgroundColor: "rgba(0,0,0,0.38)",
    // Optically centred: a triangle's mass sits left of its bounding box.
    paddingLeft: 6,
  },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    // Tall enough to cover everything that sits over the picture: the author
    // row, an open caption panel, and the listing card under it.
    height: 340,
  },
  bottom: {
    position: "absolute",
    left: spacing.md,
    // Clear of the action rail, which is 28pt of glyph plus its own margin.
    right: 76,
    bottom: spacing.lg,
    gap: spacing.sm,
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  author: { ...type.bodyStrong, color: "#FFFFFF", flexShrink: 1 },
  caption: { ...type.body, color: "#FFFFFF" },
  captionPanel: {
    // Dark enough to carry white text over a white kitchen, translucent
    // enough that the video is still the thing behind it.
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  captionMore: {
    ...type.caption,
    ...weight("700"),
    color: "rgba(255,255,255,0.72)",
    marginTop: 2,
  },
  scrubArea: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SCRUB_TOUCH_HEIGHT,
    // The line lives at the very bottom of the strip; everything above it in
    // there is grab room.
    justifyContent: "flex-end",
  },
  scrubTrack: {
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
  },
  scrubFill: { height: "100%", backgroundColor: "rgba(255,255,255,0.95)" },
  scrubKnob: {
    position: "absolute",
    top: -4,
    width: 13,
    height: 13,
    borderRadius: 7,
    // Half its own width back, so the knob is centred on the position rather
    // than starting at it.
    marginLeft: -6.5,
    backgroundColor: "#FFFFFF",
  },
  scrubBubble: {
    position: "absolute",
    alignSelf: "center",
    bottom: SCRUB_TOUCH_HEIGHT + 2,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  scrubBubbleText: {
    ...type.caption,
    ...weight("700"),
    color: "#FFFFFF",
    // Tabular figures, or the time jitters as the digits change width while
    // you drag.
    fontVariant: ["tabular-nums"],
  },
  listingCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: 6,
    paddingRight: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  listingThumb: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  listingTitle: { ...type.caption, ...weight("600"), color: "#FFFFFF" },
  listingPrice: { ...type.caption, color: "rgba(255,255,255,0.78)" },
  rail: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.lg,
    alignItems: "center",
    gap: spacing.lg,
  },
  viewBlock: { alignItems: "center", gap: 3 },
  railLabel: {
    ...type.caption,
    fontSize: 12,
    ...weight("600"),
    color: "#FFFFFF",
  },
});
