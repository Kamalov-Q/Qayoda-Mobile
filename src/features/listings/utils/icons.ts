// src/features/listings/utils/icons.ts
// One glyph per category and purpose, shared by the post form and the
// filters, so a category looks the same where you file it and where you
// search for it.
import type { Ionicons } from "@expo/vector-icons";
import type { OfferPurpose, PropertyCategory } from "../api/listings.api";

type Glyph = keyof typeof Ionicons.glyphMap;

// Icons do the recognising: a grid is scanned by shape before the label is
// read, which matters most for the two near-synonyms in Uzbek ("Hovli" / "Dacha").
export const CATEGORY_ICONS = {
  APARTMENT: "bed-outline",
  HOUSE: "home-outline",
  LAND: "map-outline",
  NON_RESIDENTIAL: "storefront-outline",
  BUILDING: "business-outline",
  DACHA: "leaf-outline",
  HOTEL: "bed-outline",
} as const satisfies Record<PropertyCategory, Glyph>;

export const PURPOSE_ICONS = {
  SALE: "pricetag-outline",
  RENT_MONTHLY: "calendar-outline",
  RENT_DAILY: "today-outline",
} as const satisfies Record<OfferPurpose, Glyph>;

/** For an "all types" option at the head of a category list. */
export const ALL_ICON: Glyph = "apps-outline";
