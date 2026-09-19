import { memo } from "react";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { radii } from "../../theme/tokens";

/**
 * A soft ring that swells out of a dot and fades — the "live" signal on an
 * online indicator. Absolutely positioned: drop it inside the dot's box, before
 * the dot itself, and it radiates from behind.
 *
 * Declarative (a Reanimated CSS animation) rather than shared values driven
 * from an effect: it runs on the UI thread with nothing for the React Compiler
 * to trip over. Skipped entirely under the OS "reduce motion" setting — a
 * looping pulse is exactly the kind of motion that setting exists to stop.
 */
export const PulseHalo = memo(function PulseHalo({
  size,
  color,
}: {
  /** Diameter of the dot the halo starts from. */
  size: number;
  color: string;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: radii.pill,
        backgroundColor: color,
        animationName: {
          from: { transform: [{ scale: 1 }], opacity: 0.55 },
          to: { transform: [{ scale: 2.4 }], opacity: 0 },
        },
        animationDuration: "1.8s",
        animationTimingFunction: "ease-out",
        animationIterationCount: "infinite",
      }}
    />
  );
});
