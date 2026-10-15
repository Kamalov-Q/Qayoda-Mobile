import { memo, useEffect, useRef } from "react";
import { Animated, type DimensionValue, type ViewStyle } from "react-native";
import { radii } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

interface Props {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: ViewStyle;
}

/**
 * A placeholder block that breathes while real content is on its way.
 *
 * Plain `Animated` rather than Reanimated: this runs on screens that are
 * already mounting a map or a video, and a pulsing opacity is the one thing
 * that does not need a worklet. `useNativeDriver` keeps it off the JS thread,
 * which is the thread the data it is standing in for will arrive on.
 */
export const Skeleton = memo(function Skeleton({
  width = "100%",
  height = 16,
  radius = radii.md,
  style,
}: Props) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      // Not announced: a placeholder has nothing to say to a screen reader,
      // and "loading" is better said once by the thing that owns the list.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.surfaceRaised,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
});
