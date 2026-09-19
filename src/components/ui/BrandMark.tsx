import { memo } from "react";
import { Image } from "expo-image";
import { useTheme } from "../../theme/useTheme";

// Cropped from the Growen City brand artwork — the G-leaf emblem with its
// skyline, square, so the rounded corners here are the only framing it gets.
// require(), not import: Metro resolves assets this way, and the project has
// no *.png module declaration for an import to typecheck against.
const EMBLEM = require("../../../assets/images/brand-emblem.png");

/** The Growen City emblem, drawn as an app-icon tile. */
export const BrandMark = memo(function BrandMark({
  size = 56,
}: {
  size?: number;
}) {
  const { shadow } = useTheme();

  return (
    <Image
      source={EMBLEM}
      accessibilityLabel="Growen City"
      style={{
        width: size,
        height: size,
        // Squircle: closer to the corner curvature of a real app icon.
        borderRadius: size * 0.24,
        ...shadow.card,
      }}
      contentFit="cover"
    />
  );
});
