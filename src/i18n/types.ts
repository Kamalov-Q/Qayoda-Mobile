import type { uz } from "./locales/uz";

/**
 * The uz dictionary is the source of truth for the key set. Widening its
 * literal values to `string` gives the shape every other locale must satisfy,
 * so a missing key fails typecheck instead of rendering blank.
 */
type Localized<T> = {
  [K in keyof T]: T[K] extends string ? string : Localized<T[K]>;
};

export type Dictionary = Localized<typeof uz>;

/** Dotted paths to every leaf string, e.g. "auth.otpTitle". */
type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : `${K}.${Leaves<T[K]>}`;
}[keyof T & string];

export type TranslationKey = Leaves<Dictionary>;

/** Values substituted into {{placeholders}}. */
export type TranslationParams = Record<string, string | number>;

export const LANGUAGES = ["uz", "ru"] as const;
export type Language = (typeof LANGUAGES)[number];
