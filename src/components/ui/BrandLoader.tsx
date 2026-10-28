import { memo } from "react";
import { Text, View, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { radii, spacing, tracked, weight } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import { BrandMark } from "./BrandMark";

// require(), not import: Metro resolves assets this way, and the project has
// no *.png module declaration for an import to typecheck against.
const EMBLEM = require("../../../assets/images/brand-emblem.png");

// One full breath of the mark: fly in, hold assembled, scatter. Long enough
// that the assembled tile is readable as the logo rather than a flicker.
const CYCLE_MS = 2400;
// Each quadrant trails the one before it, so the mark builds corner by corner
// instead of snapping into place all at once. Small against the cycle: all
// four are still assembled together for most of the hold.
const STAGGER_MS = 90;

/**
 * The emblem, quartered. Each shard is a window onto one quadrant of the same
 * image, and `dx`/`dy` is the diagonal it flies in from — so the four pull
 * apart from the centre and converge back onto the logo's own silhouette.
 */
const SHARDS = [
  { col: 0, row: 0, dx: -1, dy: -1, spin: -1 },
  { col: 1, row: 0, dx: 1, dy: -1, spin: 1 },
  { col: 0, row: 1, dx: -1, dy: 1, spin: 1 },
  { col: 1, row: 1, dx: 1, dy: 1, spin: -1 },
] as const;

type Shard = (typeof SHARDS)[number];

/**
 * A shard's loop, as CSS keyframes.
 *
 * The overshoot at 38% (scale 1.04, settling by 46%) is what makes the pieces
 * read as landing rather than sliding to a stop; the scatter at the end is
 * shorter than the gather, so the eye spends the cycle on the assembled mark.
 */
function shardKeyframes(s: Shard, spread: number) {
  return {
    "0%": {
      opacity: 0,
      transform: [
        { translateX: s.dx * spread },
        { translateY: s.dy * spread },
        { rotate: `${s.spin * 12}deg` },
        { scale: 0.78 },
      ],
    },
    "38%": {
      opacity: 1,
      transform: [
        { translateX: 0 },
        { translateY: 0 },
        { rotate: "0deg" },
        { scale: 1.04 },
      ],
    },
    "46%": {
      opacity: 1,
      transform: [
        { translateX: 0 },
        { translateY: 0 },
        { rotate: "0deg" },
        { scale: 1 },
      ],
    },
    "74%": {
      opacity: 1,
      transform: [
        { translateX: 0 },
        { translateY: 0 },
        { rotate: "0deg" },
        { scale: 1 },
      ],
    },
    "100%": {
      opacity: 0,
      transform: [
        { translateX: s.dx * spread * 0.7 },
        { translateY: s.dy * spread * 0.7 },
        { rotate: `${-s.spin * 9}deg` },
        { scale: 0.9 },
      ],
    },
  } as const;
}

/**
 * The brand mark as a loading indicator: the emblem splits into four shards
 * that fly apart and gather back onto its own shape, over and over, with a
 * gold ring snapping out of the tile at the moment it locks together.
 *
 * Declarative Reanimated CSS animations rather than shared values driven from
 * an effect (same reasoning as PulseHalo): the whole loop runs on the UI
 * thread, which matters most here — this is on screen precisely while the JS
 * thread is busy with the fetch it is standing in for. Under the OS "reduce
 * motion" setting it falls back to the static tile.
 */
export const BrandLoader = memo(function BrandLoader({
  size = 72,
}: {
  size?: number;
}) {
  const { colors } = useTheme();
  const t = useT();
  const reduceMotion = useReducedMotion();

  const half = size / 2;
  // Matches BrandMark's squircle, so the assembled shards are the same tile
  // the rest of the app shows.
  const corner = size * 0.24;
  const spread = size * 0.3;

  if (reduceMotion) {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t("common.loading")}
      >
        <BrandMark size={size} />
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("common.loading")}
      style={{ width: size, height: size }}
    >
      {SHARDS.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: s.col * half,
            top: s.row * half,
            width: half,
            height: half,
            // Only the tile's outer corners are rounded — the two edges that
            // meet in the middle stay square, so the four shards close up
            // without a notch where they join.
            borderTopLeftRadius: s.col === 0 && s.row === 0 ? corner : 0,
            borderTopRightRadius: s.col === 1 && s.row === 0 ? corner : 0,
            borderBottomLeftRadius: s.col === 0 && s.row === 1 ? corner : 0,
            borderBottomRightRadius: s.col === 1 && s.row === 1 ? corner : 0,
            overflow: "hidden",
            animationName: shardKeyframes(s, spread),
            animationDuration: `${CYCLE_MS}ms`,
            animationDelay: `${i * STAGGER_MS}ms`,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
          }}
        >
          {/* The whole emblem, pushed so this shard's quadrant lands in the
              window. Drawn at the full tile size in every shard, which is what
              keeps the quarters in register once they meet. */}
          <Image
            source={EMBLEM}
            style={{
              position: "absolute",
              left: -s.col * half,
              top: -s.row * half,
              width: size,
              height: size,
            }}
            contentFit="cover"
          />
        </Animated.View>
      ))}

      {/* The lock-in: a hairline in the mark's own gold that swells out of the
          tile as the last shard lands, then fades. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: corner,
          borderWidth: Math.max(1, size * 0.012),
          borderColor: colors.gold,
          animationName: {
            "0%": { opacity: 0, transform: [{ scale: 0.92 }] },
            // 46% is where the shards stop overshooting and sit still; the
            // ring leaves from there, so the snap and the flash are one beat.
            "46%": { opacity: 0.55, transform: [{ scale: 1 }] },
            "74%": { opacity: 0, transform: [{ scale: 1.3 }] },
            "100%": { opacity: 0, transform: [{ scale: 1.3 }] },
          },
          animationDuration: `${CYCLE_MS}ms`,
          animationDelay: `${(SHARDS.length - 1) * STAGGER_MS}ms`,
          animationTimingFunction: "ease-out",
          animationIterationCount: "infinite",
        }}
      />
    </View>
  );
});

/**
 * A screen's (or a list's) loading state: the mark, centred in whatever space
 * it is given, with a caption under it.
 *
 * Replaces the bare spinner the lists used to show while their first page was
 * in flight — same job, but it says which app is doing the waiting.
 */
export const LoadingView = memo(function LoadingView({
  size = 64,
  label,
  style,
}: {
  size?: number;
  /** Defaults to "loading"; pass `null` for the mark on its own. */
  label?: string | null;
  style?: ViewStyle;
}) {
  const { text } = useTheme();
  const t = useT();
  const caption = label === null ? null : (label ?? t("common.loading"));

  return (
    <View
      style={[
        {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.lg,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      <BrandLoader size={size} />
      {caption ? (
        <Text style={[text.caption, { textAlign: "center" }]}>{caption}</Text>
      ) : null}
    </View>
  );
});

// The native splash's own colours, from app.json. The boot screen takes over
// from that splash mid-animation, so it keeps the brand's dark field in both
// schemes — handing a dark splash over to a light page is the flash this
// screen exists to avoid.
const BOOT_BG = { dark: "#07191D", light: "#0A2024" } as const;
// The emblem's gold, fixed rather than from the palette: the field under it
// is the dark one whichever scheme is on, so the light palette's bronze
// (which is tuned for white) would read as mud here.
const BOOT_GOLD = "#DCC083";

const TRACK_W = 128;
const BAR_W = 46;

/** A gold segment sweeping a hairline track: indeterminate, like the wait. */
function BootProgress() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;

  return (
    <View
      style={{
        width: TRACK_W,
        height: 3,
        borderRadius: radii.pill,
        backgroundColor: "rgba(220,192,131,0.16)",
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={{
          width: BAR_W,
          height: 3,
          borderRadius: radii.pill,
          backgroundColor: BOOT_GOLD,
          animationName: {
            from: { transform: [{ translateX: -BAR_W }] },
            to: { transform: [{ translateX: TRACK_W }] },
          },
          animationDuration: "1500ms",
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
        }}
      />
    </View>
  );
}

/**
 * The cold-start screen, shown while the session, preferences and catalogues
 * are still landing.
 *
 * The native splash hands over as soon as the typeface is in, so this — not a
 * frozen PNG — is what the wait actually looks like: the emblem assembling
 * itself over the wordmark. The lockup is set in Inter rather than cropped
 * out of brand-logo.png because that file carries its own teal field, which
 * would patch a visible rectangle onto this one.
 */
export const BootScreen = memo(function BootScreen() {
  const { scheme } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: BOOT_BG[scheme],
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xl,
      }}
    >
      <BrandLoader size={140} />

      {/* Stretched, with the lockup centred inside it, rather than two
          content-sized boxes: a tracked-out line that Android measures short
          then has the whole screen to draw into instead of a box cut to the
          glyphs it got wrong. `tracked` covers the trailing advance; this
          covers being wrong about the width for any other reason. */}
      <View style={{ alignSelf: "stretch", alignItems: "stretch", gap: spacing.sm }}>
        <Text
          style={{
            ...weight("800"),
            fontSize: 21,
            ...tracked(6),
            color: BOOT_GOLD,
            textAlign: "center",
          }}
        >
          GROWEN CITY
        </Text>
        <Text
          style={{
            ...weight("500"),
            fontSize: 10,
            ...tracked(4.5),
            color: "rgba(220,192,131,0.62)",
            textAlign: "center",
          }}
        >
          REAL ESTATE
        </Text>
      </View>

      <BootProgress />
    </View>
  );
});
