import { useColorScheme } from "react-native";
import { usePreferences, type ThemeMode } from "../lib/preferences";
import { palettes, shadows, type, type Palette, type SchemeName } from "./tokens";

export interface Theme {
  scheme: SchemeName;
  colors: Palette;
  /** Type scale pre-coloured for this palette. */
  text: ReturnType<typeof buildText>;
  /** Elevation presets tuned per scheme — see tokens.shadows. */
  shadow: (typeof shadows)[SchemeName];
}

function buildText(c: Palette) {
  return {
    display: { ...type.display, color: c.text },
    title: { ...type.title, color: c.text },
    heading: { ...type.heading, color: c.text },
    body: { ...type.body, color: c.text },
    bodyStrong: { ...type.bodyStrong, color: c.text },
    caption: { ...type.caption, color: c.textMuted },
    label: { ...type.label, color: c.textMuted },
  } as const;
}

// Built once per palette, not per render — these objects land in style props,
// so stable identities keep memoised children from re-rendering.
const themes: Record<SchemeName, Theme> = {
  dark: {
    scheme: "dark",
    colors: palettes.dark,
    text: buildText(palettes.dark),
    shadow: shadows.dark,
  },
  light: {
    scheme: "light",
    colors: palettes.light,
    text: buildText(palettes.light),
    shadow: shadows.light,
  },
};

/**
 * Resolves the palette from the user's stored preference, falling back to the
 * OS scheme on "system". Dark-first: an unknown OS scheme (null on web before
 * hydration) resolves dark.
 */
export function useTheme(): Theme {
  const mode = usePreferences((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const resolved = mode === "system" ? systemScheme : mode;
  return themes[resolved === "light" ? "light" : "dark"];
}

/** The stored preference and its setter, for the Settings UI. */
export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const mode = usePreferences((s) => s.themeMode);
  const setMode = usePreferences((s) => s.setThemeMode);
  return [mode, setMode];
}

export { themes };
