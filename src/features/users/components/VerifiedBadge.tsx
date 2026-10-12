import { memo, useMemo } from "react";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";

interface Props {
  /** Matches the text it sits beside; 17 on a row, 26 under a big name. */
  size?: number;
  /** Overrides the seal's fill. Defaults to the brand colour. */
  color?: string;
}

/**
 * The verified seal.
 *
 * A scalloped disc rather than a plain tick in a circle: a circle beside a
 * name reads as a status dot, a bullet or a close button depending on what
 * else is on the row, while this shape says one thing only. It is the same
 * silhouette every platform settled on for the same reason.
 *
 * Drawn rather than taken from an icon font because no icon set ships it,
 * and because at 16pt next to a name the points have to be crisp.
 */
export const VerifiedBadge = memo(function VerifiedBadge({
  size = 20,
  color,
}: Props) {
  const { colors } = useTheme();
  const t = useT();

  // Twelve lobes, cut deeper than a first pass had them: at the size this
  // sits beside a name, a shallow scallop just reads as a slightly wobbly
  // circle, which is the one thing this shape must not be mistaken for.
  const seal = useMemo(() => buildSeal(12, 11.7, 8.7), []);

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityRole="image"
      accessibilityLabel={t("verify.badge")}
    >
      <Path d={seal} fill={color ?? colors.primary} />
      <Path
        d="M7.7 12.3 10.6 15.1l5.8-6.1"
        stroke="#FFFFFF"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
});

/**
 * A scalloped disc: `lobes` rounded petals around the circle.
 *
 * Each petal is one quadratic curve from the valley before it to the valley
 * after, bulging through a control point outside the disc — a quadratic only
 * reaches about halfway to its control, so the control sits further out than
 * the crest is meant to.
 */
function buildSeal(lobes: number, crest: number, valley: number): string {
  const cx = 12;
  const cy = 12;
  const step = (Math.PI * 2) / lobes;
  // Where to put the control so the curve peaks at `crest`.
  const control = valley + (crest - valley) * 2.1;

  const at = (radius: number, angle: number) => [
    (cx + radius * Math.cos(angle)).toFixed(2),
    (cy + radius * Math.sin(angle)).toFixed(2),
  ];

  const [sx, sy] = at(valley, -Math.PI / 2);
  const parts = [`M${sx} ${sy}`];

  for (let i = 0; i < lobes; i++) {
    const start = -Math.PI / 2 + i * step;
    const [qx, qy] = at(control, start + step / 2);
    const [x, y] = at(valley, start + step);
    parts.push(`Q${qx} ${qy} ${x} ${y}`);
  }

  return `${parts.join(" ")} Z`;
}
