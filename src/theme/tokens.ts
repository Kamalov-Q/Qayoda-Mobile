// Design tokens. Dark-first: the dark palette is the reference design and the
// light palette is derived to match its contrast relationships, not the other
// way round. Nothing here reads the current scheme — use useTheme() for that.

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
  overlay: string;
  /** Scrim over photography, so white text stays legible on any image. */
  imageScrim: string;
}

const dark: Palette = {
  // Backgrounds, from furthest back to most elevated.
  bg: "#0A0C10",
  surface: "#13161C", // cards / segmented track
  surfaceRaised: "#1B1F27", // input fills, pressed segments
  surfaceSunken: "#070609", // wells behind elevated content
  // Borders
  border: "#242932",
  borderStrong: "#333A45",
  // Text
  text: "#F4F6FA",
  textMuted: "#98A2B3",
  textFaint: "#616B7C",
  // Accent — lifted from the light-mode blue so it stays vivid on near-black.
  primary: "#4C8DFF",
  primaryPressed: "#3A79E8",
  primarySoft: "#152238", // tinted fill behind accents
  primaryBorder: "#27406B",
  onPrimary: "#FFFFFF",
  // Feedback
  danger: "#FB7185",
  dangerSurface: "#2A1519",
  dangerBorder: "#4A2229",
  success: "#4ADE80",
  successSurface: "#0F2418",
  successBorder: "#1E4430",
  // Fixed
  overlay: "rgba(0,0,0,0.65)",
  imageScrim: "rgba(6,8,12,0.55)",
};

const light: Palette = {
  // Cards are white and the page behind them is faintly tinted — the inverse
  // of the dark scheme, where the page is darkest and cards lift off it. A
  // white-on-white version of this UI loses every card edge.
  bg: "#F5F7FB",
  surface: "#FFFFFF",
  surfaceRaised: "#F1F4F9", // input fills, pressed states
  surfaceSunken: "#EAEEF5",
  border: "#E5EAF2",
  borderStrong: "#CBD5E1",
  text: "#0B1220",
  textMuted: "#5A6779",
  textFaint: "#94A3B8",
  primary: "#2E6BFF",
  primaryPressed: "#1F55D6",
  primarySoft: "#EDF3FF",
  primaryBorder: "#C7DAFF",
  onPrimary: "#FFFFFF",
  danger: "#DC2626",
  dangerSurface: "#FEF2F2",
  dangerBorder: "#FECACA",
  success: "#15A34A",
  successSurface: "#F0FDF4",
  successBorder: "#BBF7D0",
  overlay: "rgba(11,18,32,0.45)",
  imageScrim: "rgba(6,8,12,0.45)",
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
 * apply `theme.shadow.card` without branching.
 */
export const shadows = {
  light: {
    card: { boxShadow: "0px 1px 2px rgba(11,18,32,0.04), 0px 6px 16px rgba(11,18,32,0.06)" },
    raised: { boxShadow: "0px 2px 6px rgba(11,18,32,0.08), 0px 16px 32px rgba(11,18,32,0.12)" },
    control: { boxShadow: "0px 2px 8px rgba(46,107,255,0.28)" },
  },
  dark: {
    card: { boxShadow: "0px 2px 8px rgba(0,0,0,0.35)" },
    raised: { boxShadow: "0px 12px 32px rgba(0,0,0,0.55)" },
    control: { boxShadow: "0px 2px 12px rgba(0,0,0,0.45)" },
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

/** Colour-free type scale. useTheme() pairs these with palette colours. */
export const type = {
  display: { fontSize: 34, fontWeight: "800", letterSpacing: -0.8, lineHeight: 40 },
  title: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5, lineHeight: 32 },
  heading: { fontSize: 18, fontWeight: "700", letterSpacing: -0.2, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: "400", lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: "600", lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  // Section labels. Sentence case at a readable size beats the old tracked-out
  // uppercase micro-type, which Cyrillic renders especially poorly.
  label: { fontSize: 13, fontWeight: "600", letterSpacing: 0 },
} as const;
