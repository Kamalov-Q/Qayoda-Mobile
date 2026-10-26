import { memo } from "react";
import { Image } from "expo-image";
import { useTheme } from "../../theme/useTheme";

// The Growen City emblem — the leaf, the house and the towers on their teal
// field — cropped square out of the full logo so the mark fills the tile
// which is for the places with room to read it; BrandGlyph is the same mark
// with the field keyed out, for surfaces that bring their own.
// require(), not import: Metro resolves assets this way, and the project has
// no *.png module declaration for an import to typecheck against.
const EMBLEM = require("../../../assets/images/brand-emblem.png");


// The mark alone, field removed — gold on nothing.
const GLYPH = require("../../../assets/images/brand-mark.png");

/** The Growen City emblem, drawn as an app-icon tile. */
export const BrandMark = memo(function BrandMark({
  size = 56,
}: {
  size?: number;
}) {
  const { colors, shadow } = useTheme();

  return (
    <Image
      source={EMBLEM}
      accessibilityLabel="Growen City"
      style={{
        width: size,
        height: size,
        // Squircle: closer to the corner curvature of a real app icon.
        borderRadius: size * 0.24,
        // A hairline in the mark's own gold. The tile's field and the page
        // behind it are both dark teal, so without an edge the logo reads as
        // a smudge on the background rather than as a mark sitting on it.
        borderWidth: 1,
        borderColor: colors.goldBorder,
        ...shadow.card,
      }}
      contentFit="cover"
    />
  );
});

/**
 * The mark with nothing behind it.
 *
 * BrandMark is the app-icon tile — the emblem on its own teal field, which is
 * right where the brand introduces itself (splash, welcome, about). This is
 * for the places that already have a background: the floating header chip,
 * where a solid tile was the one opaque thing in a bar the feed scrolls
 * under.
 *
 * Raster rather than the hand-drawn vector it replaces, because the real
 * logo is not a leaf alone — it is the leaf, the house and the towers, and
 * approximating that in paths would be a different mark wearing the brand's
 * colours.
 */
export const BrandGlyph = memo(function BrandGlyph({
  size = 28,
}: {
  size?: number;
}) {
  return (
    <Image
      source={GLYPH}
      accessibilityLabel="Growen City"
      style={{ width: size, height: size }}
      // contain, not cover: the mark is taller than it is wide, sitting
      // centred on a square canvas, and cropping it to fill takes the towers
      // off the top.
      contentFit="contain"
    />
  );
});
