// Device-local UI preferences: language and theme mode. Both live in one store
// because they share a lifecycle — read once at cold start, written only when
// the user flips a switch in Settings.
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { LANGUAGES, type Language } from "../i18n/types";

export type ThemeMode = "system" | "light" | "dark";

const LANGUAGE_KEY = "prefs.language";
const THEME_KEY = "prefs.themeMode";

function isLanguage(v: unknown): v is Language {
  return LANGUAGES.includes(v as Language);
}

function isThemeMode(v: unknown): v is ThemeMode {
  return v === "system" || v === "light" || v === "dark";
}

/**
 * First-run language: honour the device list in preference order, but only for
 * languages we actually ship. A ru device gets Russian; everything else —
 * including en, which this app has no dictionary for — gets Uzbek, the
 * market's default.
 */
function deviceLanguage(): Language {
  for (const locale of getLocales()) {
    if (locale.languageCode === "ru") return "ru";
    if (locale.languageCode === "uz") return "uz";
  }
  return "uz";
}

interface PreferencesState {
  language: Language;
  themeMode: ThemeMode;
  setLanguage: (language: Language) => void;
  setThemeMode: (mode: ThemeMode) => void;
}

export const usePreferences = create<PreferencesState>((set) => ({
  language: deviceLanguage(),
  themeMode: "system",

  setLanguage: (language) => {
    set({ language });
    AsyncStorage.setItem(LANGUAGE_KEY, language).catch(() => {});
  },

  setThemeMode: (themeMode) => {
    set({ themeMode });
    AsyncStorage.setItem(THEME_KEY, themeMode).catch(() => {});
  },
}));

/**
 * Reads stored preferences into the store. Awaited during boot so the first
 * frame already has the right language and palette — setting them after the
 * tree mounts shows a flash of the wrong theme.
 */
export async function hydratePreferences(): Promise<void> {
  try {
    const [[, storedLanguage], [, storedTheme]] =
      await AsyncStorage.multiGet([LANGUAGE_KEY, THEME_KEY]);

    usePreferences.setState({
      // A stored value wins; anything unrecognised (older build, manual edit)
      // falls back to the same default a fresh install would pick.
      language: isLanguage(storedLanguage) ? storedLanguage : deviceLanguage(),
      themeMode: isThemeMode(storedTheme) ? storedTheme : "system",
    });
  } catch {
    // Storage unavailable — the device-derived defaults already in the store
    // are a fine place to start, and the next write will retry persistence.
  }
}
