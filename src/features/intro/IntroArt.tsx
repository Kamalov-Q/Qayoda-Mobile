// src/features/intro/IntroArt.tsx
// The line art on the intro slides, drawn rather than shown.
//
// Each icon is a handful of SVG paths with round caps. They arrive by having
// their own stroke painted on from one end — the trick is `strokeDasharray`
// set to the path's length and `strokeDashoffset` animated from that length
// down to zero, so the dash "gap" retreats and the line appears to be drawn.
//
// PERFORMANCE — the whole point of doing it this way:
//
//   · `strokeDashoffset` is animated through `useAnimatedProps`, so the value
//     is produced on the UI thread and handed straight to the native SVG
//     view. No React re-render per frame, and nothing crosses the bridge
//     while the line is being drawn.
//   · The paths are constants. Nothing here allocates per frame, and the
//     slides are plain views the pager already had — this adds no list rows,
//     no images to decode and no layout passes.
//   · One shared `progress` per slide drives every path in it, so a four-path
//     icon costs one animation, not four.
//   · It respects the reduce-motion setting: when that is on, the art is
//     simply there, fully drawn, with no animation at all.
import { memo, useEffect } from "react";
import Svg, { Path } from "react-native-svg";
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Rough path length, used as the dash period.
 *
 * `getTotalLength()` is a DOM API that react-native-svg does not expose, so
 * the length is declared alongside the path. It only has to be an
 * OVER-estimate: too long and the line starts a touch later, too short and
 * the tail of the stroke would never be covered — which is why every number
 * here is rounded generously upwards.
 */
interface Stroke {
  d: string;
  len: number;
}

export type IntroArtKey = "map" | "post" | "chat" | "verified";

/**
 * Drawn in a 100×100 box so every icon shares one optical weight, whatever
 * size the slide renders it at.
 */
const ART: Record<IntroArtKey, Stroke[]> = {
  // A pin over a map fold — "find it on the map".
  map: [
    { d: "M12 30 L38 20 L62 30 L88 20 L88 72 L62 82 L38 72 L12 82 Z", len: 300 },
    { d: "M38 20 L38 72", len: 60 },
    { d: "M62 30 L62 82", len: 60 },
    {
      d: "M50 32 a13 13 0 0 1 13 13 c0 10 -13 22 -13 22 s-13 -12 -13 -22 a13 13 0 0 1 13 -13 Z",
      len: 110,
    },
  ],
  // A sheet with a pencil across it — "put yours up".
  post: [
    { d: "M22 18 L62 18 L78 34 L78 86 L22 86 Z", len: 230 },
    { d: "M62 18 L62 34 L78 34", len: 40 },
    { d: "M34 52 L58 52", len: 24 },
    { d: "M34 66 L50 66", len: 16 },
  ],
  // Two bubbles — "talk to the seller".
  chat: [
    {
      d: "M18 32 a10 10 0 0 1 10 -10 L58 22 a10 10 0 0 1 10 10 L68 54 a10 10 0 0 1 -10 10 L36 64 L22 76 L22 64 a10 10 0 0 1 -4 -10 Z",
      len: 260,
    },
    {
      d: "M78 44 a8 8 0 0 1 6 8 L84 70 a8 8 0 0 1 -8 8 L62 78",
      len: 80,
    },
  ],
  // A shield with a tick — "every advert is checked".
  verified: [
    { d: "M50 14 L84 26 L84 52 C84 72 68 84 50 90 C32 84 16 72 16 52 L16 26 Z", len: 270 },
    { d: "M36 51 L46 62 L66 40", len: 50 },
  ],
};

interface Props {
  art: IntroArtKey;
  size: number;
  color: string;
  /**
   * Bumped by the pager every time this slide becomes the one on screen, so
   * the line redraws on the way back as well as the way forward. A slide the
   * reader never reaches never animates.
   */
  drawKey: number;
  active: boolean;
}

/** How long one stroke takes, and how far apart the strokes start. */
const DRAW_MS = 620;
const STAGGER_MS = 110;

export const IntroArt = memo(function IntroArt({
  art,
  size,
  color,
  drawKey,
  active,
}: Props) {
  const strokes = ART[art];
  // One value for the whole icon: 0 is unpainted, 1 is fully drawn.
  const progress = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!active) return;
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: DRAW_MS + STAGGER_MS * strokes.length,
      // Quick off the mark, settling at the end — a pen leaving paper.
      easing: Easing.out(Easing.cubic),
    });
  }, [drawKey, active, reduced, progress, strokes.length]);

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {strokes.map((stroke, i) => (
        <DrawnStroke
          key={stroke.d}
          stroke={stroke}
          index={i}
          count={strokes.length}
          color={color}
          progress={progress}
        />
      ))}
    </Svg>
  );
});

/**
 * One path, painted on.
 *
 * Its own slice of the shared progress: stroke `i` of `n` starts after `i`
 * steps and finishes a step later, which is what makes the shield's outline
 * land before its tick rather than both appearing at once.
 */
const DrawnStroke = memo(function DrawnStroke({
  stroke,
  index,
  count,
  color,
  progress,
}: {
  stroke: Stroke;
  index: number;
  count: number;
  color: string;
  progress: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => {
    "worklet";
    const span = 1 / count;
    const start = index * span;
    const local = Math.min(1, Math.max(0, (progress.value - start) / span));
    return { strokeDashoffset: stroke.len * (1 - local) };
  });

  return (
    <AnimatedPath
      d={stroke.d}
      stroke={color}
      strokeWidth={7}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      strokeDasharray={stroke.len}
      animatedProps={animatedProps}
    />
  );
});
