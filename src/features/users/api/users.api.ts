import { api } from "@/src/lib/api-client";
import type { Listing } from "../../listings/api/listings.api";

/** Mirror of the server's UserProfileResponse (`GET /users/:id`). */
export interface UserProfile {
  id: string;
  /** `name` and `surname` joined; null when the user filled in neither. */
  fullName: string | null;
  name: string | null;
  surname: string | null;
  phoneNumber: string | null;
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
}

/** Matches the server's page size for the profile's first page. */
export const OWNER_LISTINGS_PAGE = 20;

export const usersApi = {
  getProfile: (id: string) => api<UserProfile>(`/users/${id}`),

  /** A later page of someone's listings; page one arrives with the profile. */
  getListings: (id: string, limit = OWNER_LISTINGS_PAGE, offset = 0) =>
    api<Listing[]>(`/users/${id}/listings?limit=${limit}&offset=${offset}`),
};
