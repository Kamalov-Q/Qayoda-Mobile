import { useCallback } from "react";
import { usePreferences } from "../lib/preferences";
import { uz } from "./locales/uz";
import { ru } from "./locales/ru";
import type {
  Dictionary,
  Language,
  TranslationKey,
  TranslationParams,
} from "./types";

export type { Language, TranslationKey, TranslationParams };
export { LANGUAGES } from "./types";

const dictionaries: Record<Language, Dictionary> = { uz, ru };

function resolve(dict: Dictionary, key: string): string | undefined {
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      dict,
    );
  return typeof value === "string" ? value : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function translate(
  language: Language,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  // uz is the complete dictionary, so it is also the fallback for any key a
  // translated locale is missing at runtime (e.g. a hot-reloaded partial edit).
  const template =
    resolve(dictionaries[language], key) ?? resolve(uz, key) ?? key;
  return interpolate(template, params);
}

/**
 * Translate outside React — mutation callbacks, zod schemas, api-client error
 * mapping. Reads the store directly, so it always reflects the current
 * language, but it will not re-render anything on its own.
 */
export function t(key: TranslationKey, params?: TranslationParams): string {
  return translate(usePreferences.getState().language, key, params);
}

/**
 * Translate inside React. Subscribes to the language, so switching it
 * re-renders every screen holding this hook.
 */
export function useT() {
  const language = usePreferences((s) => s.language);
  return useCallback(
    (key: TranslationKey, params?: TranslationParams) =>
      translate(language, key, params),
    [language],
  );
}

/** The active language, for components that branch on it (e.g. number formats). */
export function useLanguage(): Language {
  return usePreferences((s) => s.language);
}
