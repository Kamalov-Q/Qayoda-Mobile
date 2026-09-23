// src/features/listings/utils/icons.ts
// One glyph per category and purpose, shared by the post form and the
// filters, so a category looks the same where you file it and where you
// search for it.
import type { Ionicons } from "@expo/vector-icons";
import type { OfferPurpose } from "../api/listings.api";

type Glyph = keyof typeof Ionicons.glyphMap;

/**
 * A category's icon KEY (stored on the category by admins) → the glyph drawn
 * here. Keys must match CATEGORY_ICON_KEYS on the server and the dashboard's
 * CategoryIcon. Icons do the recognising: a grid is scanned by shape before
 * the label is read, which matters for near-synonyms like "Hovli" / "Dacha".
 */
export const CATEGORY_ICON_MAP: Record<string, Glyph> = {
  apartment: "bed-outline",
  house: "home-outline",
  land: "map-outline",
  shop: "storefront-outline",
  building: "business-outline",
  dacha: "leaf-outline",
  hotel: "bed-outline",
  office: "briefcase-outline",
  warehouse: "cube-outline",
  garage: "car-outline",
  farm: "flower-outline",
  grid: "grid-outline",
};

/** Glyph for an icon key; one this app version doesn't know gets a generic one. */
export const categoryGlyph = (iconKey: string | undefined): Glyph =>
  (iconKey && CATEGORY_ICON_MAP[iconKey]) || "grid-outline";

export const PURPOSE_ICONS = {
  SALE: "pricetag-outline",
  RENT_MONTHLY: "calendar-outline",
  RENT_DAILY: "today-outline",
} as const satisfies Record<OfferPurpose, Glyph>;

/** For an "all types" option at the head of a category list. */
export const ALL_ICON: Glyph = "apps-outline";
