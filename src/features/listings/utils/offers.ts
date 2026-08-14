import { Listing, Offer } from "../api/listings.api";

/**
 * The offer a listing is represented by in lists and filters: the active one,
 * falling back to whatever exists so an all-inactive listing still shows a
 * price instead of an empty row.
 */
export function primaryOffer(listing: Listing): Offer | undefined {
  return listing.offers.find((o) => o.isActive) ?? listing.offers[0];
}

/** Its price as a number, or null when the listing carries no offer at all. */
export function listingPrice(listing: Listing): number | null {
  const offer = primaryOffer(listing);
  if (!offer) return null;
  const price = Number(offer.price);
  return Number.isFinite(price) ? price : null;
}

/**
 * Shared min/max test. An empty bound is "no bound", and a listing with no
 * price is only excluded once a bound is actually set — otherwise a bare
 * category filter would silently drop priceless drafts.
 */
export function inPriceRange(
  price: number | null,
  min: string,
  max: string,
): boolean {
  if (!min && !max) return true;
  if (price === null) return false;
  if (min && price < Number(min)) return false;
  if (max && price > Number(max)) return false;
  return true;
}
