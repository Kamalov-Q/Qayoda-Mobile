import { memo } from "react";
import Svg, { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

/**
 * The leaf mark as vector, with no tile behind it.
 *
 * BrandMark is the app-icon tile — the emblem on its own teal field, which is
 * right where the brand introduces itself (splash, welcome, about). This is
 * the mark alone, for places that already have a background of their own: a
 * header, a list row, an empty state. It is a vector rather than a crop of
 * the PNG because those places draw it small, where the raster's gradients
 * turn to mud, and because `tint` lets it sit on any surface.
 *
 * Geometry note: the blade is two cubic halves meeting along the midrib, and
 * the whole thing is drawn flat along the x-axis and rotated 45° — authoring
 * it upright is what keeps the curves adjustable without re-deriving every
 * control point.
 */
export const BrandLeaf = memo(function BrandLeaf({
  size = 24,
  tint,
}: {
  size?: number;
  /** Paint the whole mark one colour instead of the brand golds. */
  tint?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Growen City">
      <Defs>
        <LinearGradient id="leafA" x1="2" y1="-14" x2="34" y2="2" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#F6E8C4" />
          <Stop offset="0.5" stopColor="#DCC083" />
          <Stop offset="1" stopColor="#A2834A" />
        </LinearGradient>
        <LinearGradient id="leafB" x1="36" y1="0" x2="4" y2="13" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#CBAC6A" />
          <Stop offset="1" stopColor="#78602F" />
        </LinearGradient>
        <LinearGradient id="leafRib" x1="-13" y1="0" x2="40" y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#A08346" />
          <Stop offset="0.35" stopColor="#EAD6A6" />
          <Stop offset="1" stopColor="#FDF6E3" />
        </LinearGradient>
      </Defs>
      <G transform="translate(23.4 40.6) rotate(-45) scale(1.08)">
        <Path d="M0 0 C5 -10 20 -15 38 0 Z" fill={tint ?? "url(#leafA)"} />
        <Path d="M0 0 C6 10 22 14 38 0 Z" fill={tint ?? "url(#leafB)"} />
        <Path
          d="M-13 0 H38.5"
          fill="none"
          stroke={tint ?? "url(#leafRib)"}
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
});
