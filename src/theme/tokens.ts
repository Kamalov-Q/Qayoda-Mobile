// Design tokens. Nothing here reads the current scheme — use useTheme() for that.
import { Platform } from "react-native";
import type { TextStyle } from "react-native";

export interface Palette {
  bg: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  primaryBorder: string;
  onPrimary: string;
  danger: string;
  dangerSurface: string;
  dangerBorder: string;
  success: string;
  successSurface: string;
  successBorder: string;
  /**
   * Labels for text and glyphs that sit ON a filled accent, rather than on a
   * surface. A filled badge is light in one scheme and dark in the other, so
   * a hardcoded white works in exactly one of them — which is what the unread
   * pill, the TOP mark and the avatar's edit button each used to do.
   */
  onDanger: string;
  onSuccess: string;
  onVip: string;
  /** Payme brand teal, for payment buttons and badges. */
  payme: string;
  /** Promoted / VIP listings. Same gold as the emblem's leaf. */
  vip: string;
  /** The emblem's gold, for brand moments and premium marks. */
  gold: string;
  /** Tinted fill behind a gold mark. */
  goldSoft: string;
  goldBorder: string;
  /**
   * Sold: the badge on the card and the pin on the map.
   *
   * A true amber, NOT `gold` — gold already means promoted, and a sold pin
   * wearing the paid-placement colour is two different claims in one swatch.
   * Yellow is also the only warm tone left that is neither the success green
   * (this is not a success for the person browsing) nor the danger red (it is
   * not a failure either): it reads as "gone", which is what it is.
   */
  sold: string;
  /** Tinted fill behind a sold mark. */
  soldSoft: string;
  soldBorder: string;
  /** What sits ON a filled sold badge. */
  onSold: string;
  overlay: string;
  /** Scrim over photography, so white text stays legible on any image. */
  imageScrim: string;
}

// Brand palette: the emblem's own two colours. The icon is a gold leaf on a
// deep teal field (#143338 sampled from brand-emblem.png, gold #DCC083 from
// BrandLeaf's gradients) — the app used to open in slate blue with an emerald
// accent, which matched nothing the brand had already committed to.
//
// Teal carries the surfaces and every interactive state; gold is kept scarce,
// for promoted listings, the brand mark and premium marks, so it still reads
// as special when it appears. Every text/background pair below clears WCAG AA
// (4.5:1 for text, 3:1 for the faint tier) — see scripts note in the review.
const dark: Palette = {
  // Backgrounds, from furthest back to most elevated. Deeper than the emblem
  // itself, so a card in the emblem's own teal lifts off the page.
  bg: "#07191D",
  surface: "#0E2A30", // cards / segmented track
  surfaceRaised: "#15383F", // input fills, pressed segments
  surfaceSunken: "#041115", // wells behind elevated content
  // Borders
  border: "#1C4249",
  borderStrong: "#2B5C65",
  // Text
  text: "#EEF5F4",
  textMuted: "#A3BABB",
  textFaint: "#74908F",
  // Accent
  primary: "#2FB8A8",
  primaryPressed: "#26998C",
  primarySoft: "#0C2F31", // tinted fill behind accents
  primaryBorder: "#1C5F58",
  // Dark label on a bright accent, the way a saturated teal wants to be read:
  // white on #2FB8A8 is 2.3:1 and fails, this is 6.95:1.
  onPrimary: "#04201D",
  // Feedback
  danger: "#FF8A8A",
  dangerSurface: "#2E1A1E",
  dangerBorder: "#5C2B31",
  success: "#5FE08F",
  successSurface: "#0C2A20",
  successBorder: "#1C4E38",
  // The feedback accents are light in this scheme, so what sits on them is
  // the page colour: 7.9:1 on danger, 10.8:1 on success, 10.2:1 on gold.
  onDanger: "#07191D",
  onSuccess: "#07191D",
  onVip: "#07191D",
  // Brand extras
  payme: "#33CCCC",
  vip: "#DCC083",
  gold: "#DCC083",
  goldSoft: "#2A2416",
  goldBorder: "#5B4A24",
  // Sold. Light in this scheme like the other accents, so the page colour
  // sits on it (9.4:1). Clearly separate in hue from the desaturated brand
  // gold above, which is the point.
  sold: "#F5C84B",
  soldSoft: "#2E2309",
  soldBorder: "#634D12",
  onSold: "#07191D",
  // Fixed
  overlay: "rgba(0, 0, 0, 0.7)",
  imageScrim: "rgba(3,12,14,0.55)",
};

const light: Palette = {
  // Cards are white and the page behind them is faintly teal-tinted — a
  // white-on-white version of this UI loses every card edge.
  bg: "#F4F7F7",
  surface: "#FFFFFF",
  surfaceRaised: "#EDF3F2", // input fills, pressed states
  surfaceSunken: "#E6EDEC",
  border: "#DCE6E5",
  borderStrong: "#BFCFCE",
  text: "#072226",
  textMuted: "#52696B",
  textFaint: "#6F8384",
  // Deeper than the dark scheme's teal: this one carries white button labels
  // and has to clear AA as text on white too.
  primary: "#0A7569",
  primaryPressed: "#07564E",
  primarySoft: "#E6F5F2",
  primaryBorder: "#A7DCD4",
  onPrimary: "#FFFFFF",
  danger: "#D32F2F",
  dangerSurface: "#FEF2F2",
  dangerBorder: "#FBC9C9",
  success: "#14804A",
  successSurface: "#F0FDF4",
  successBorder: "#B7E6C9",
  // Dark accents here, so the label inverts: ~5:1 on each.
  onDanger: "#FFFFFF",
  onSuccess: "#FFFFFF",
  onVip: "#FFFFFF",
  payme: "#33CCCC",
  // The emblem's gold is a 1.6:1 blur on white, so light mode carries the
  // same hue taken down to a bronze that reads as text.
  vip: "#806224",
  gold: "#806224",
  goldSoft: "#FBF4E4",
  goldBorder: "#E4D3A6",
  // A bright amber is a 1.8:1 blur on white, so light mode carries the same
  // hue taken down until it reads as text (5.2:1). The MAP pin uses the
  // bright value in both schemes — it sits on a photographic tile with white
  // text on it, not on the page, so it needs to be seen rather than read.
  sold: "#8A5A06",
  soldSoft: "#FEF6E3",
  soldBorder: "#F2D79B",
  onSold: "#FFFFFF",
  overlay: "rgba(0, 0, 0, 0.4)",
  imageScrim: "rgba(3,12,14,0.45)",
};

export const palettes = { dark, light } as const;
export type SchemeName = keyof typeof palettes;

/**
 * Elevation, as CSS shadow strings. React Native deprecated the `shadow*` /
 * `elevation` style props in favour of `boxShadow`, which the new architecture
 * renders on iOS, Android and web from one declaration.
 *
 * A drop shadow is nearly invisible on a near-black background, so the dark
 * scheme spends almost nothing on it and leans on borders instead; the light
 * scheme is where shadows do the lifting. Same keys either way, so components
 * apply `theme.shadow.card` without branching. Tinted with the brand teal
 * rather than neutral grey — a grey shadow over a teal-tinted page greys it.
 */
export const shadows = {
  light: {
    card: { boxShadow: "0px 1px 2px rgba(7,34,38,0.04), 0px 6px 16px rgba(7,34,38,0.06)" },
    raised: { boxShadow: "0px 2px 6px rgba(7,34,38,0.08), 0px 16px 32px rgba(7,34,38,0.14)" },
    control: { boxShadow: "0px 2px 10px rgba(10,117,105,0.28)" },
  },
  dark: {
    card: { boxShadow: "0px 2px 8px rgba(0,0,0,0.35)" },
    raised: { boxShadow: "0px 12px 32px rgba(0,0,0,0.55)" },
    control: { boxShadow: "0px 2px 14px rgba(0,0,0,0.45)" },
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Softer and larger than before — the main lever on how current the UI reads. */
export const radii = { sm: 10, md: 14, lg: 18, xl: 24, xxl: 28, pill: 999 } as const;

/** Control heights — inputs and buttons must match to line up in a stack. */
export const sizing = { control: 54, controlSm: 40, controlMd: 46 } as const;

/**
 * The Inter faces loaded at boot, keyed by the weight they stand in for.
 *
 * Android picks a face by family name and ignores `fontWeight` once a custom
 * family is set, so a weight can never be asked for on its own — the face has
 * to be named. `weight()` below is the only correct way to set one.
 */
export const fonts = {
  "400": "Inter_400Regular",
  "500": "Inter_500Medium",
  "600": "Inter_600SemiBold",
  "700": "Inter_700Bold",
  "800": "Inter_800ExtraBold",
  "900": "Inter_900Black",
} as const;

export type FontWeightKey = keyof typeof fonts;

/**
 * A weight, as both the Inter face and the numeric weight.
 *
 * Spread it instead of writing `fontWeight` by hand: the family is what
 * Android renders, and the number keeps iOS and web correct when the face
 * itself has not loaded yet (the first frame, or a web cold start).
 */
export const weight = (w: FontWeightKey) =>
  ({ fontFamily: fonts[w], fontWeight: w }) as const;

/**
 * Positive letter-spacing that survives Android.
 *
 * Android lays the tracking out after the LAST glyph as well, but measures
 * the line without it, so the final letter falls outside the text's own
 * bounds and is clipped: a tracked-out "GROWEN CITY" renders "GROWEN CIT".
 * Padding the end by exactly the tracking gives that letter somewhere to
 * land.
 *
 * iOS measures the trailing space itself and needs no padding — and must not
 * get it, or the extra width pushes a centred lockup off centre. Hence the
 * platform check rather than padding on both.
 *
 * Only for POSITIVE tracking. The negative values in `type` below pull the
 * line in and can never clip.
 */
export const tracked = (letterSpacing: number) =>
  ({
    letterSpacing,
    paddingEnd: Platform.OS === "android" ? letterSpacing : 0,
  }) as const;

/**
 * Colour-free type scale. useTheme() pairs these with palette colours.
 *
 * Every entry names its Inter face. The old scale asked for weight 800 and
 * 700 from the system font, which on Android's Roboto has neither — so the
 * display and title tiers quietly rendered at plain bold, flattening exactly
 * the type that was meant to carry the screen.
 */
export const type = {
  display: { ...weight("800"), fontSize: 34, letterSpacing: -0.8, lineHeight: 40 },
  title: { ...weight("700"), fontSize: 26, letterSpacing: -0.5, lineHeight: 32 },
  heading: { ...weight("700"), fontSize: 18, letterSpacing: -0.2, lineHeight: 24 },
  body: { ...weight("400"), fontSize: 15, lineHeight: 21 },
  bodyStrong: { ...weight("600"), fontSize: 15, lineHeight: 21 },
  caption: { ...weight("400"), fontSize: 13, lineHeight: 18 },
  // Section labels. Sentence case at a readable size beats the old tracked-out
  // uppercase micro-type, which Cyrillic renders especially poorly.
  label: { ...weight("600"), fontSize: 13, letterSpacing: 0 },
  /**
   * Prices and any other figure that sits in a column or ticks upward.
   * Tabular figures keep every digit the same width, so a price stops
   * jittering sideways as it changes and a column of them lines up.
   */
  price: {
    ...weight("700"),
    fontSize: 20,
    letterSpacing: -0.4,
    lineHeight: 26,
    // Typed rather than inferred: the `as const` on this object would
    // otherwise freeze the array too, and TextStyle wants a mutable one.
    fontVariant: ["tabular-nums"] as TextStyle["fontVariant"],
  },
} as const;
