import { api } from "@/src/lib/api-client";
import type {
  Listing,
  OfferPurpose,
  PropertyCategory,
} from "../../listings/api/listings.api";
import type { SocialLinks } from "../lib/social";

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
  /** Whatever they wrote about themselves. */
  bio: string | null;
  /**
   * Handle or URL per platform. Age, gender and address are NOT public —
   * the server never sends them here.
   */
  socialLinks: SocialLinks | null;
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

/**
 * One row of a people search. Deliberately NOT a UserProfile: that carries a
 * page of listings, facets and stats, which is a lot of work for the server
 * and a lot of bytes for a list someone is scrolling past. These are the
 * fields a row actually prints.
 */
export interface UserSearchResult {
  id: string;
  name: string | null;
  surname: string | null;
  avatarThumbUrl: string | null;
  isVerifiedRealtor: boolean;
  /** Both printed under the name, as the two numbers that say "worth a tap". */
  followerCount: number;
  listingCount: number;
  /**
   * Whether the viewer has blocked them. Blocked people stay in the results
   * \u2014 hiding them would make a block detectable by its own absence, and
   * would leave no way to find somebody in order to unblock them \u2014 so the
   * row is marked instead.
   */
  blockedByMe: boolean;
}

export interface UserSearchPage {
  total: number;
  items: UserSearchResult[];
}

/** Matches the server's page size for `GET /users`. */
export const USER_SEARCH_PAGE = 25;

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

  /**
   * People, by name.
   *
   * `GET /users?q=` — the server matches name and surname only. Not the
   * phone number: a directory you can reverse-lookup a number in is a
   * different and much worse product than a way to find a seller you have
   * heard of.
   */
  search: (q = "", limit = USER_SEARCH_PAGE, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    // Omitted entirely when empty: the server reads an ABSENT q as "browse
    // the directory" and an empty one as a bad request.
    if (q) params.set("q", q);
    return api<UserSearchPage>(`/users?${params}`);
  },
};
