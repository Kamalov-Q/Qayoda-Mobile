// Device-local UI preferences: language and theme mode. Both live in one store
// because they share a lifecycle — read once at cold start, written only when
// the user flips a switch in Settings.
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { LANGUAGES, type Language } from "../i18n/types";

export type ThemeMode = "system" | "light" | "dark";
export type Currency = "USD" | "UZS";

const LANGUAGE_KEY = "prefs.language";
const THEME_KEY = "prefs.themeMode";
const CURRENCY_KEY = "prefs.currency";
const INTRO_KEY = "prefs.introSeen";

function isLanguage(v: unknown): v is Language {
  return LANGUAGES.includes(v as Language);
}

function isThemeMode(v: unknown): v is ThemeMode {
  return v === "system" || v === "light" || v === "dark";
}

function isCurrency(v: unknown): v is Currency {
  return v === "USD" || v === "UZS";
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
  /** What every price on screen is shown in — conversion is client-side. */
  currency: Currency;
  /** First-launch intro carousel: shown until finished, then never again. */
  introSeen: boolean;
  setLanguage: (language: Language) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setCurrency: (currency: Currency) => void;
  setIntroSeen: () => void;
}

export const usePreferences = create<PreferencesState>((set) => ({
  language: deviceLanguage(),
  themeMode: "system",
  // USD is how this market quotes real estate, whatever the wallet holds.
  currency: "USD",
  introSeen: false,

  setLanguage: (language) => {
    set({ language });
    AsyncStorage.setItem(LANGUAGE_KEY, language).catch(() => {});
  },

  setThemeMode: (themeMode) => {
    set({ themeMode });
    AsyncStorage.setItem(THEME_KEY, themeMode).catch(() => {});
  },

  setCurrency: (currency) => {
    set({ currency });
    AsyncStorage.setItem(CURRENCY_KEY, currency).catch(() => {});
  },

  setIntroSeen: () => {
    set({ introSeen: true });
    AsyncStorage.setItem(INTRO_KEY, "1").catch(() => {});
  },
}));

/**
 * Reads stored preferences into the store. Awaited during boot so the first
 * frame already has the right language and palette — setting them after the
 * tree mounts shows a flash of the wrong theme.
 */
export async function hydratePreferences(): Promise<void> {
  try {
    const [
      [, storedLanguage],
      [, storedTheme],
      [, storedCurrency],
      [, storedIntro],
    ] = await AsyncStorage.multiGet([
      LANGUAGE_KEY,
      THEME_KEY,
      CURRENCY_KEY,
      INTRO_KEY,
    ]);

    usePreferences.setState({
      // A stored value wins; anything unrecognised (older build, manual edit)
      // falls back to the same default a fresh install would pick.
      language: isLanguage(storedLanguage) ? storedLanguage : deviceLanguage(),
      themeMode: isThemeMode(storedTheme) ? storedTheme : "system",
      currency: isCurrency(storedCurrency) ? storedCurrency : "USD",
      introSeen: storedIntro === "1",
    });
  } catch {
    // Storage unavailable — the device-derived defaults already in the store
    // are a fine place to start, and the next write will retry persistence.
  }
}
