import { memo, useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { radii, spacing } from "@/src/theme/tokens";

interface Props {
  count: number;
  index: number;
  /** How long the current one runs, in ms. */
  durationMs: number;
  /** Frozen while a finger is down, or while a sheet is over the story. */
  paused: boolean;
  onDone: () => void;
}

/**
 * The row of bars across the top: filled behind you, filling where you are,
 * empty ahead. One animation drives the current bar and calls back when it
 * reaches the end, which is what advances the story.
 */
export const StoryProgress = memo(function StoryProgress({
  count,
  index,
  durationMs,
  paused,
  onDone,
}: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    // A new story starts its bar from nothing, whichever direction it was
    // reached from.
    progress.set(0);
  }, [index, progress]);

  useEffect(() => {
    if (paused) {
      // Freeze where it is rather than resetting: a thumb held down to read
      // a caption should not cost the reader their place.
      progress.set(progress.get());
      return;
    }

    const remaining = durationMs * (1 - progress.get());
    progress.set(
      withTiming(
        1,
        { duration: Math.max(remaining, 0), easing: Easing.linear },
        (finished) => {
          // A withTiming callback IS A WORKLET: it runs on the UI thread,
          // where calling a plain JS function is not allowed and takes the
          // app down with it. `scheduleOnRN` hands it back to JS — which is
          // what every other animation in this codebase does.
          "worklet";
          if (finished) scheduleOnRN(onDone);
        },
      ),
    );
    // `onDone` is intentionally not a dependency: it closes over the current
    // index, and re-running this on every render would restart the bar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, index, durationMs, progress]);

  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {Array.from({ length: count }, (_, i) => (
        <Bar key={i} state={i < index ? "done" : i === index ? "live" : "todo"} progress={progress} />
      ))}
    </View>
  );
});

const Bar = memo(function Bar({
  state,
  progress,
}: {
  state: "done" | "live" | "todo";
  progress: { get: () => number };
}) {
  const style = useAnimatedStyle(() => ({
    width: state === "done" ? "100%" : state === "live" ? `${progress.get() * 100}%` : "0%",
  }));

  return (
    <View
      style={{
        flex: 1,
        height: 3,
        borderRadius: radii.pill,
        backgroundColor: "rgba(255,255,255,0.35)",
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={[{ height: 3, backgroundColor: "#FFFFFF" }, style]}
      />
    </View>
  );
});

/** The inset the bars need from the top of the screen. */
export const PROGRESS_INSET = spacing.sm;
