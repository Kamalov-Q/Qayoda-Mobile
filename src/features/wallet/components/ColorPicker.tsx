// src/features/wallet/components/ColorPicker.tsx
//
// A pure React Native color picker (no extra deps).
//   • Hue rainbow bar — drag to choose hue
//   • SV square — drag to choose saturation & brightness
//   • Live preview swatch
//
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  PanResponder,
  StyleSheet,
  LayoutRectangle,
  type GestureResponderEvent,
} from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from "react-native-svg";

// ─── HSV ↔ HEX helpers ───────────────────────────────────────────────────────

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h / 60);
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const vals: [number, number, number][] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ];
  const [r, g, b] = vals[i % 6];
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function hexToHsv(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, "");
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return [0, 1, 1];
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return [h, s, v];
}

// ─── Dragging ────────────────────────────────────────────────────────────────

/**
 * A view you can drag on, with its measured box available while rendering.
 *
 * Both controls below need the same two things and both got them wrong in
 * the same two ways:
 *
 *  - The box was kept in a REF and read during render to place the thumb.
 *    Writing a ref does not re-render, so on first paint it was still null
 *    and `layout.current && <Thumb/>` drew nothing — the picker opened with
 *    no thumb on either control, and one appeared only once something else
 *    happened to re-render it, which in practice meant after the first drag.
 *    The box is state here, which is what it always was: something rendering
 *    depends on.
 *
 *  - The PanResponder was created once (correctly — recreating it mid-drag
 *    drops the gesture) but with the handler from the FIRST render, so it
 *    closed over that render's props permanently. `onChange` here is a fresh
 *    arrow on every parent render, and the hue handler reads `sat`/`bri`, so
 *    dragging the hue bar after moving the SV square emitted the saturation
 *    and brightness from before the square was touched. The responder now
 *    calls through refs that an effect keeps pointing at the latest values.
 *
 * Reading `.current` inside a gesture callback is not reading it during
 * render, which is the distinction the lint rule is drawing.
 */
function useDragArea(
  onDrag: (pageX: number, pageY: number, box: LayoutRectangle) => void,
) {
  const [layout, setLayout] = useState<LayoutRectangle | null>(null);

  const handler = useRef(onDrag);
  useEffect(() => {
    handler.current = onDrag;
  }, [onDrag]);

  const box = useRef<LayoutRectangle | null>(null);
  useEffect(() => {
    box.current = layout;
  }, [layout]);

  // Lazy useState rather than useRef: it is created exactly once either way,
  // and this does not have to read `.current` while rendering to get at it.
  //
  // The rule below cannot see that `fire` is only ever reached from a gesture
  // callback, so it warns that passing a ref into a function "may" read it
  // during render. Here it provably does not: the initialiser only builds the
  // responder, and PanResponder invokes these handlers from touch events.
  // Suppressed on this line alone, deliberately — the other fourteen reports
  // this file used to carry were all genuine and are fixed above.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const fire = (e: GestureResponderEvent) => {
      const measured = box.current;
      if (!measured) return;
      handler.current(e.nativeEvent.pageX, e.nativeEvent.pageY, measured);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: fire,
      onPanResponderMove: fire,
    });
  });

  return {
    layout,
    onLayout: useCallback(
      (e: { nativeEvent: { layout: LayoutRectangle } }) =>
        setLayout(e.nativeEvent.layout),
      [],
    ),
    panHandlers: pan.panHandlers,
  };
}

// ─── Hue rail (horizontal rainbow strip) ─────────────────────────────────────

const HUE_STOPS = [0, 60, 120, 180, 240, 300, 360].map((h) => {
  const [r, g, b] = hsvToRgb(h === 360 ? 0 : h, 1, 1);
  return `rgb(${r},${g},${b})`;
});

// `width`/`height` used to be declared here and on SvSquare and read by
// neither — both size themselves from the stylesheet. A prop that is
// accepted and ignored is worse than one that does not exist.
interface HueBarProps {
  hue: number;
  onChange: (h: number) => void;
}

function HueBar({ hue, onChange }: HueBarProps) {
  const onDrag = useCallback(
    (pageX: number, _pageY: number, box: LayoutRectangle) => {
      const x = Math.max(0, Math.min(pageX - box.x, box.width));
      onChange((x / box.width) * 360);
    },
    [onChange]
  );

  const { layout, onLayout, panHandlers } = useDragArea(onDrag);

  const thumbX = layout ? (hue / 360) * layout.width : 0;
  const thumbColor = rgbToHex(...hsvToRgb(hue, 1, 1));

  return (
    <View onLayout={onLayout} {...panHandlers} style={styles.hueBar}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="hue" x1="0" x2="1" y1="0" y2="0">
            {HUE_STOPS.map((color, i) => (
              <Stop
                key={i}
                offset={`${(i / (HUE_STOPS.length - 1)) * 100}%`}
                stopColor={color}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#hue)" rx={10} />
      </Svg>

      {layout && (
        <View
          style={[
            styles.hueThumb,
            {
              left: thumbX - 10,
              borderColor: thumbColor,
            },
          ]}
        />
      )}
    </View>
  );
}

// ─── SV square ───────────────────────────────────────────────────────────────

interface SvSquareProps {
  hue: number;
  s: number;
  v: number;
  onChange: (s: number, v: number) => void;
}

function SvSquare({ hue, s, v, onChange }: SvSquareProps) {
  const hueColor = rgbToHex(...hsvToRgb(hue, 1, 1));

  const onDrag = useCallback(
    (pageX: number, pageY: number, box: LayoutRectangle) => {
      const nx = Math.max(0, Math.min((pageX - box.x) / box.width, 1));
      const ny = Math.max(0, Math.min((pageY - box.y) / box.height, 1));
      onChange(nx, 1 - ny);
    },
    [onChange]
  );

  const { layout, onLayout, panHandlers } = useDragArea(onDrag);

  const thumbLeft = layout ? s * layout.width - 10 : 0;
  const thumbTop = layout ? (1 - v) * layout.height - 10 : 0;

  return (
    <View onLayout={onLayout} {...panHandlers} style={styles.svSquare}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          {/* White → hue (left-to-right saturation) */}
          <LinearGradient id="sat" x1="0" x2="1" y1="0" y2="0">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor={hueColor} />
          </LinearGradient>
          {/* Transparent → black (top-to-bottom value) */}
          <LinearGradient id="val" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0%" stopColor="transparent" />
            <Stop offset="100%" stopColor="#000000" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#sat)" rx={12} />
        <Rect width="100%" height="100%" fill="url(#val)" rx={12} />
      </Svg>

      {layout && (
        <View
          style={[
            styles.svThumb,
            {
              left: thumbLeft,
              top: thumbTop,
            },
          ]}
        />
      )}
    </View>
  );
}

// ─── Public ColorPicker ───────────────────────────────────────────────────────

interface ColorPickerProps {
  value: string; // current hex e.g. "#8B5CF6"
  onChange: (hex: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [h, s, v] = hexToHsv(value);
  const [hue, setHue] = useState(h);
  const [sat, setSat] = useState(s);
  const [bri, setBri] = useState(v);

  const emit = useCallback(
    (nh: number, ns: number, nb: number) => {
      const hex = rgbToHex(...hsvToRgb(nh, ns, nb));
      onChange(hex);
    },
    [onChange]
  );

  const handleHue = useCallback(
    (nh: number) => {
      setHue(nh);
      emit(nh, sat, bri);
    },
    [sat, bri, emit]
  );

  const handleSV = useCallback(
    (ns: number, nb: number) => {
      setSat(ns);
      setBri(nb);
      emit(hue, ns, nb);
    },
    [hue, emit]
  );

  const previewColor = rgbToHex(...hsvToRgb(hue, sat, bri));

  return (
    <View style={styles.container}>
      {/* SV gradient square */}
      <SvSquare hue={hue} s={sat} v={bri} onChange={handleSV} />

      {/* Bottom row: hue bar + preview swatch */}
      <View style={styles.bottomRow}>
        <HueBar hue={hue} onChange={handleHue} />
        <View style={[styles.previewSwatch, { backgroundColor: previewColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 14,
  },
  svSquare: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    overflow: "visible",
  },
  svThumb: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  hueBar: {
    flex: 1,
    height: 28,
    borderRadius: 10,
    overflow: "visible",
  },
  hueThumb: {
    position: "absolute",
    top: -2,
    width: 20,
    height: 32,
    borderRadius: 10,
    borderWidth: 3,
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
