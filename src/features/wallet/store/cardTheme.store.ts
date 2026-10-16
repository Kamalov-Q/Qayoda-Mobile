import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CardTheme {
  id: string;
  name: string;
  accent: string; // Vibrant accent color (e.g. #10B981)
  bgDark: string; // Deep card background
  glowStart: string; // Radial glow
  glowEnd: string;
  textColor: string;
  isCustom?: boolean;
}

export const PRESET_CARD_THEMES: CardTheme[] = [
  {
    id: "emerald",
    name: "Emerald",
    accent: "#10B981",
    bgDark: "#0B1220",
    glowStart: "rgba(16, 185, 129, 0.22)",
    glowEnd: "rgba(30, 58, 138, 0.2)",
    textColor: "#FFFFFF",
  },
  {
    id: "amethyst",
    name: "Amethyst",
    accent: "#A855F7",
    bgDark: "#150A26",
    glowStart: "rgba(168, 85, 247, 0.25)",
    glowEnd: "rgba(76, 29, 149, 0.2)",
    textColor: "#FFFFFF",
  },
  {
    id: "azure",
    name: "Azure",
    accent: "#06B6D4",
    bgDark: "#071626",
    glowStart: "rgba(6, 182, 212, 0.25)",
    glowEnd: "rgba(14, 116, 144, 0.2)",
    textColor: "#FFFFFF",
  },
  {
    id: "ruby",
    name: "Ruby",
    accent: "#F43F5E",
    bgDark: "#220812",
    glowStart: "rgba(244, 63, 94, 0.25)",
    glowEnd: "rgba(159, 18, 57, 0.2)",
    textColor: "#FFFFFF",
  },
  {
    id: "amber",
    name: "Amber",
    accent: "#F59E0B",
    bgDark: "#1C1103",
    glowStart: "rgba(245, 158, 11, 0.25)",
    glowEnd: "rgba(180, 83, 9, 0.2)",
    textColor: "#FFFFFF",
  },
  {
    id: "titanium",
    name: "Titanium",
    accent: "#94A3B8",
    bgDark: "#0F172A",
    glowStart: "rgba(148, 163, 184, 0.2)",
    glowEnd: "rgba(51, 65, 85, 0.2)",
    textColor: "#FFFFFF",
  },
];

export function createCustomCardTheme(hex: string): CardTheme {
  const cleanHex = hex.startsWith("#") ? hex : `#${hex}`;
  return {
    id: "custom",
    name: "Maxsus",
    accent: cleanHex,
    bgDark: "#0B1220",
    glowStart: `${cleanHex}38`, // ~22% opacity
    glowEnd: "rgba(30, 58, 138, 0.18)",
    textColor: "#FFFFFF",
    isCustom: true,
  };
}

interface CardThemeState {
  currentTheme: CardTheme;
  customHex: string;
  setThemeById: (id: string) => void;
  setCustomColor: (hex: string) => void;
}

export const useCardThemeStore = create<CardThemeState>()(
  persist(
    (set) => ({
      currentTheme: PRESET_CARD_THEMES[0],
      customHex: "#8B5CF6",
      setThemeById: (id: string) => {
        const found = PRESET_CARD_THEMES.find((t) => t.id === id);
        if (found) {
          set({ currentTheme: found });
        }
      },
      setCustomColor: (hex: string) => {
        const theme = createCustomCardTheme(hex);
        set({ currentTheme: theme, customHex: hex });
      },
    }),
    {
      // Renamed with the rest of the branding. Nothing is published yet, so
      // the only cost is that a test device forgets its chosen card colour
      // once and picks the default again.
      name: "growencity_virtual_card_theme",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
