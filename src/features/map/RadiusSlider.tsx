import { memo, useEffect, useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { radii } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

/**
 * The distances the handle stops on, tightest first, ending in "no limit".
 *
 * Stepped rather than continuous: nobody searches "within 1 372 m", and the
 * steps are what let the track cover 250 m to the whole city in one thumb
 * travel — a linear metre scale spends nine tenths of its width on distances
 * that return the same listings.
 *
 * Every value is inside the server's 100 m … 100 km bounds; null is sent as no
 * radius at all rather than as a very large one.
 */
export const RADIUS_STEPS = [
  250,
  500,
  750,
  1_000,
  1_500,
  2_000,
  3_000,
  5_000,
  7_000,
  10_000,
  15_000,
  20_000,
  30_000,
  50_000,
  null,
] as const;

export type RadiusStep = (typeof RADIUS_STEPS)[number];

/** Nearest step to an arbitrary metre value — a radius restored from a saved
 *  filter, or one the server clamped, still lands the handle somewhere sane. */
export function nearestStep(radiusM: number | null): RadiusStep {
  if (radiusM == null) return null;
  let best: RadiusStep = RADIUS_STEPS[0];
  for (const s of RADIUS_STEPS) {
    if (s == null) continue;
    if (Math.abs(s - radiusM) < Math.abs((best as number) - radiusM)) best = s;
  }
  return best;
}

const LAST = RADIUS_STEPS.length - 1;
const THUMB = 28;
const TRACK = 6;
const SPRING = { damping: 20, stiffness: 240 } as const;

const indexOf = (value: RadiusStep) => {
  const i = RADIUS_STEPS.indexOf(value);
  return i < 0 ? LAST : i;
};

interface Props {
  value: RadiusStep;
  onChange: (value: RadiusStep) => void;
  /** Read out by screen readers in place of the bare fraction. */
  label: string;
}

/**
 * One handle, fifteen stops. Deliberately a sibling of PriceRangeSlider rather
 * than a generalisation of it: that one is two handles on a squared price
 * curve, this one snaps to a fixed list, and the shared part would be the six
 * lines of styling.
 */
export const RadiusSlider = memo(function RadiusSlider({
  value,
  onChange,
  label,
}: Props) {
  const { colors, shadow } = useTheme();
  const [width, setWidth] = useState(0);

  // 0..1 along the track. Only ever a step's own position — the thumb snaps
  // as the finger crosses a stop rather than sliding between them.
  const pos = useSharedValue(indexOf(value) / LAST);
  const active = useSharedValue(false);

  // Follows the prop when something else moves it (opening the panel on a
  // saved radius, a reset). Skipped mid-drag: the drag is already the source.
  useEffect(() => {
    if (active.get()) return;
    pos.set(withSpring(indexOf(value) / LAST, SPRING));
  }, [value, pos, active]);

  const emit = (index: number) => onChange(RADIUS_STEPS[index]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        // The handle overhangs the track by half its width at either end;
        // without the slop that half is dead to touch on Android.
        .hitSlop({ horizontal: THUMB / 2, vertical: 14 })
        .onBegin(() => {
          active.set(true);
        })
        .onUpdate((e) => {
          if (!width) return;
          const t = Math.min(1, Math.max(0, e.x / width));
          const index = Math.round(t * LAST);
          const next = index / LAST;
          if (next === pos.get()) return;
          pos.set(next);
          scheduleOnRN(emit, index);
        })
        .onFinalize(() => {
          active.set(false);
        }),
    // `emit` closes over the caller's onChange; rebuilding the gesture on
    // every step it emits would tear it down mid-drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width],
  );

  const fillStyle = useAnimatedStyle(() => ({ width: pos.get() * width }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pos.get() * width - THUMB / 2 },
      { scale: withSpring(active.get() ? 1.15 : 1, SPRING) },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        // This view IS the track: the thumb's centre runs from its left edge
        // (0) to its right edge (1), and the half-thumb margin each side is
        // the room that overhang needs.
        onLayout={(e: LayoutChangeEvent) =>
          setWidth(e.nativeEvent.layout.width)
        }
        style={{
          height: THUMB,
          justifyContent: "center",
          marginHorizontal: THUMB / 2,
        }}
        accessible
        accessibilityLabel={label}
      >
        <View
          style={{
            height: TRACK,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceRaised,
          }}
        />
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              top: (THUMB - TRACK) / 2,
              height: TRACK,
              borderRadius: radii.pill,
              backgroundColor: colors.primary,
            },
            fillStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              width: THUMB,
              height: THUMB,
              borderRadius: radii.pill,
              backgroundColor: colors.surface,
              borderWidth: 3,
              borderColor: colors.primary,
              ...shadow.control,
            },
            thumbStyle,
          ]}
        />
      </View>
    </GestureDetector>
  );
});
