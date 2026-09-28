import { api } from "@/src/lib/api-client";
import type {
  Listing,
  OfferPurpose,
  PropertyCategory,
} from "../../listings/api/listings.api";

/** How a profile's listings can be ordered. `newest` is the default. */
export type OwnerListingSort = "newest" | "oldest" | "priceAsc" | "priceDesc";

/** The profile screen's narrowing of one seller's listings. */
export interface OwnerListingFilters {
  purpose?: OfferPurpose;
  category?: PropertyCategory;
  sort?: OwnerListingSort;
}

/** True when nothing is narrowed — the view the profile response already
 *  carries the first page of. */
export const isDefaultOwnerFilters = (f: OwnerListingFilters) =>
  !f.purpose && !f.category && (!f.sort || f.sort === "newest");

/**
 * How many live listings this seller has per purpose and per category.
 *
 * A value missing from the map is one they have none of, and the sheet simply
 * does not offer it — better than a filter that can only ever come back empty.
 */
export interface OwnerFacets {
  purposes: Partial<Record<OfferPurpose, number>>;
  categories: Record<string, number>;
}

/** The row of numbers across the top of a profile, over live listings only. */
export interface OwnerStats {
  listings: number;
  /** Distinct viewers across everything they have posted. */
  views: number;
  /**
   * Their stars, over every review left on anything they have posted and
   * every report upheld against them. Five to begin with, like a listing —
   * see the server's RatingService.
   */
  ratingAvg: number;
  /** How many people REVIEWED them, which is not how many things scored. */
  ratingCount: number;
}

/** Mirror of the server's UserProfileResponse (`GET /users/:id`). */
export interface UserProfile {
  id: string;
  /** `name` and `surname` joined; null when the user filled in neither. */
  fullName: string | null;
  name: string | null;
  surname: string | null;
  phoneNumber: string | null;
  /**
   * Whether the viewer has blocked this person. The profile also arrives
   * stripped of presence and phone when a block exists in either direction,
   * so the screen does not have to know which way round it was.
   */
  blockedByMe?: boolean;
  /** Prefer this one; `avatarThumbUrl` is the fallback. */
  avatarUrl: string | null;
  avatarThumbUrl: string | null;
  /** Manually verified by an admin. */
  isVerifiedRealtor: boolean;
  createdAt: string;
  /**
   * The FIRST PAGE of their ACTIVE listings — drafts and archives stay with
   * the owner. The rest come from `getListings` as the reader scrolls.
   */
  listings: Listing[];
  /** Every active listing they have, not just the page above. */
  listingCount: number;
  stats: OwnerStats;
  facets: OwnerFacets;
}

/** One page of someone's listings, with the total for the filter in force. */
export interface OwnerListingsPage {
  total: number;
  items: Listing[];
}

/** Matches the server's page size for the profile's first page. */
export const OWNER_LISTINGS_PAGE = 20;

export const usersApi = {
  getProfile: (id: string) => api<UserProfile>(`/users/${id}`),

  /**
   * A page of someone's listings. Page one of the UNFILTERED view arrives
   * with the profile, so this serves the rest as the reader scrolls — and
   * everything, from the first page, once they filter.
   */
  getListings: (
    id: string,
    filters: OwnerListingFilters = {},
    limit = OWNER_LISTINGS_PAGE,
    offset = 0,
  ) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (filters.purpose) params.set("purpose", filters.purpose);
    if (filters.category) params.set("category", filters.category);
    if (filters.sort && filters.sort !== "newest")
      params.set("sort", filters.sort);
    return api<OwnerListingsPage>(`/users/${id}/listings?${params}`);
  },
};
