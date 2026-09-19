// Design tokens. Nothing here reads the current scheme — use useTheme() for that.

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
  /** Payme brand teal, for payment buttons and badges. */
  payme: string;
  /** Promoted / VIP listings. */
  vip: string;
  overlay: string;
  /** Scrim over photography, so white text stays legible on any image. */
  imageScrim: string;
}

// Brand palette: slate neutrals with an emerald accent. The base values
// (bg, surface, text, textMuted, border, primary, danger, payme, vip, overlay)
// are the brand spec; everything else is derived from the same Tailwind
// slate / emerald / red scales so tints stay in family.
const dark: Palette = {
  // Backgrounds, from furthest back to most elevated.
  bg: "#0F172A",
  surface: "#1E293B", // cards / segmented track
  surfaceRaised: "#273449", // input fills, pressed segments
  surfaceSunken: "#0B1120", // wells behind elevated content
  // Borders
  border: "#334155",
  borderStrong: "#475569",
  // Text
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  textFaint: "#64748B",
  // Accent
  primary: "#10B981",
  primaryPressed: "#059669",
  primarySoft: "#10302D", // tinted fill behind accents
  primaryBorder: "#065F46",
  onPrimary: "#FFFFFF",
  // Feedback
  danger: "#F87171",
  dangerSurface: "#2D1A22",
  dangerBorder: "#5B2A33",
  success: "#4ADE80",
  successSurface: "#0F2A1E",
  successBorder: "#1E4D36",
  // Brand extras
  payme: "#33CCCC",
  vip: "#FBBF24",
  // Fixed
  overlay: "rgba(0, 0, 0, 0.7)",
  imageScrim: "rgba(6,8,12,0.55)",
};

const light: Palette = {
  // Cards are white and the page behind them is faintly tinted — a
  // white-on-white version of this UI loses every card edge.
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceRaised: "#F1F5F9", // input fills, pressed states
  surfaceSunken: "#EDF2F7",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  text: "#0F172A",
  textMuted: "#64748B",
  textFaint: "#94A3B8",
  primary: "#059669",
  primaryPressed: "#047857",
  primarySoft: "#ECFDF5",
  primaryBorder: "#A7F3D0",
  onPrimary: "#FFFFFF",
  danger: "#EF4444",
  dangerSurface: "#FEF2F2",
  dangerBorder: "#FECACA",
  success: "#16A34A",
  successSurface: "#F0FDF4",
  successBorder: "#BBF7D0",
  payme: "#33CCCC",
  vip: "#D97706",
  overlay: "rgba(0, 0, 0, 0.4)",
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
    control: { boxShadow: "0px 2px 8px rgba(5,150,105,0.28)" },
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
