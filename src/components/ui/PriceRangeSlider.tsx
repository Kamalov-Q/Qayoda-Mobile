import { memo, useEffect, useMemo, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { radii, spacing } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import { TextField } from "./TextField";

export type PriceScale = "SALE" | "RENT_MONTHLY" | "RENT_DAILY";
export type PriceCurrency = "USD" | "UZS";

/**
 * Top of the slider per purpose, in USD. Past it the handle reads "N+" and
 * means "no upper bound" — a sale track that ran to $100M would spend its
 * whole width on prices nobody filters by.
 */
const TRACK_MAX_USD: Record<PriceScale, number> = {
  SALE: 500_000,
  RENT_MONTHLY: 5_000,
  RENT_DAILY: 500,
};
// A round multiplier rather than the live rate: the track's end only has to be
// a sensible ceiling, and it must not shift under the thumb when rates update.
const UZS_PER_USD = 12_000;

const THUMB = 28;
const SPRING = { damping: 20, stiffness: 220 } as const;

/** 123456 → 120000: two significant digits, so a dragged value reads as a price someone would type. */
function niceRound(v: number): number {
  "worklet";
  if (v <= 0) return 0;
  const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
  return Math.round(v / mag) * mag;
}

/**
 * Position ⇄ price on a squared curve: the first half of the track covers the
 * bottom quarter of prices, which is where most listings (and most filtering)
 * sit. A linear track put every flat under $100k in its first fifth.
 */
function toPrice(t: number, max: number): number {
  "worklet";
  return niceRound(t * t * max);
}
function toPosition(price: number, max: number): number {
  "worklet";
  return Math.min(1, Math.max(0, Math.sqrt(price / max)));
}

const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const digits = (value: string) => value.replace(/[^\d]/g, "");

interface Props {
  min: string;
  max: string;
  onChangeMin: (value: string) => void;
  onChangeMax: (value: string) => void;
  currency?: PriceCurrency;
  /** Which kind of price is being filtered — sets the track's range. */
  scale?: PriceScale;
}

/**
 * Two-handle price range, with the exact fields underneath for anyone who
 * knows their number. Both edit the same pair of strings; an empty string is
 * "no bound", exactly as before, so callers filter the same way.
 */
export const PriceRangeSlider = memo(function PriceRangeSlider({
  min,
  max,
  onChangeMin,
  onChangeMax,
  currency = "USD",
  scale = "SALE",
}: Props) {
  const { colors, text, shadow } = useTheme();
  const t = useT();
  const trackMax =
    TRACK_MAX_USD[scale] * (currency === "UZS" ? UZS_PER_USD : 1);
  const symbol = currency === "USD" ? "$" : t("listings.som");

  const [width, setWidth] = useState(0);
  const lo = useSharedValue(0); // 0..1
  const hi = useSharedValue(1);
  const startLo = useSharedValue(0);
  const startHi = useSharedValue(1);
  const active = useSharedValue<0 | 1 | 2>(0); // which thumb is held

  // Typed values (or a reset) move the handles; a drag writes the strings,
  // which lands back here as a no-op because the position already matches.
  useEffect(() => {
    if (active.get() === 1) return;
    lo.set(withSpring(min ? toPosition(Number(min), trackMax) : 0, SPRING));
  }, [min, trackMax, lo, active]);
  useEffect(() => {
    if (active.get() === 2) return;
    hi.set(withSpring(max ? toPosition(Number(max), trackMax) : 1, SPRING));
  }, [max, trackMax, hi, active]);

  const emitLo = (p: number) =>
    onChangeMin(p <= 0 ? "" : String(toPrice(p, trackMax)));
  const emitHi = (p: number) =>
    onChangeMax(p >= 1 ? "" : String(toPrice(p, trackMax)));

  // The gap a thumb keeps from the other, as a fraction of the track, so the
  // two can't cross and a zero-width range can't be dragged into.
  const gap = width ? THUMB / width : 0.08;

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        // A handle at either end overhangs the track by half its width;
        // without this, that half would not respond to touch on Android.
        .hitSlop({ horizontal: THUMB / 2, vertical: 12 })
        // Grab whichever handle is nearer the finger; a tap between them
        // moves the closer one there.
        .onBegin((e) => {
          const p = width ? e.x / width : 0;
          const pick = Math.abs(p - lo.get()) <= Math.abs(p - hi.get()) ? 1 : 2;
          active.set(pick);
          startLo.set(lo.get());
          startHi.set(hi.get());
        })
        .onUpdate((e) => {
          if (!width) return;
          const p = Math.min(1, Math.max(0, e.x / width));
          if (active.get() === 1) {
            const next = Math.min(p, hi.get() - gap);
            if (next === lo.get()) return;
            lo.set(Math.max(0, next));
            scheduleOnRN(emitLo, Math.max(0, next));
          } else if (active.get() === 2) {
            const next = Math.max(p, lo.get() + gap);
            if (next === hi.get()) return;
            hi.set(Math.min(1, next));
            scheduleOnRN(emitHi, Math.min(1, next));
          }
        })
        .onFinalize(() => {
          active.set(0);
        }),
    // emitLo/emitHi are left out on purpose: they close over the parent's
    // setters, which are useState setters (stable) at both call sites, and
    // rebuilding the gesture on every emitted step would churn it mid-drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, gap, trackMax],
  );

  const fillStyle = useAnimatedStyle(() => ({
    left: lo.get() * width,
    right: (1 - hi.get()) * width,
  }));
  const loStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: lo.get() * width - THUMB / 2 },
      { scale: withSpring(active.get() === 1 ? 1.15 : 1, SPRING) },
    ],
  }));
  const hiStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: hi.get() * width - THUMB / 2 },
      { scale: withSpring(active.get() === 2 ? 1.15 : 1, SPRING) },
    ],
  }));

  const summary =
    !min && !max
      ? t("filters.anyPrice")
      : `${min ? group(Number(min)) : "0"} – ${
          max ? group(Number(max)) : `${group(trackMax)}+`
        } ${symbol}`;

  const thumb = {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.primary,
    ...shadow.control,
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Text
        style={{
          ...text.heading,
          color: min || max ? colors.primary : colors.text,
        }}
        accessibilityLiveRegion="polite"
      >
        {summary}
      </Text>

      <GestureDetector gesture={pan}>
        <View
          // This view IS the track: thumb centres run from its left edge (0)
          // to its right edge (1). The half-thumb margin each side is where a
          // handle at either end overhangs, so it never hangs off the sheet.
          onLayout={(e: LayoutChangeEvent) =>
            setWidth(e.nativeEvent.layout.width)
          }
          style={{
            height: THUMB,
            justifyContent: "center",
            marginHorizontal: THUMB / 2,
          }}
          // Screen readers get the summary here and the two exact fields below;
          // no "adjustable" role, since there are no increment actions to back it.
          accessible
          accessibilityLabel={summary}
        >
          <View
            style={{
              height: 6,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceRaised,
            }}
          />
          <Animated.View
            style={[
              {
                position: "absolute",
                top: (THUMB - 6) / 2,
                height: 6,
                borderRadius: radii.pill,
                backgroundColor: colors.primary,
              },
              fillStyle,
            ]}
          />
          <Animated.View style={[thumb, loStyle]} />
          <Animated.View style={[thumb, hiStyle]} />
        </View>
      </GestureDetector>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t("filters.priceFrom")}
            placeholder="0"
            keyboardType="number-pad"
            value={min}
            onChangeText={(v) => onChangeMin(digits(v))}
            suffix={symbol}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t("filters.priceTo")}
            placeholder={`${group(trackMax)}+`}
            keyboardType="number-pad"
            value={max}
            onChangeText={(v) => onChangeMax(digits(v))}
            suffix={symbol}
          />
        </View>
      </View>
    </View>
  );
});
