import { memo, type ReactNode } from "react";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";

// Small enough that the last section is in place well under half a second in,
// big enough that the eye reads the page as assembling top to bottom.
const STAGGER_MS = 70;

/**
 * Fades a block up into place on mount, delayed by its position so a screen's
 * sections arrive in reading order. Entering only — exit animations are the
 * Reanimated ghost-view trap (see Toast). Plain render under "reduce motion".
 */
export const Rise = memo(function Rise({
  index = 0,
  children,
}: {
  /** Position in the stagger: 0 arrives first. */
  index?: number;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.delay(index * STAGGER_MS)
              .springify()
              .damping(18)
      }
    >
      {children}
    </Animated.View>
  );
});
