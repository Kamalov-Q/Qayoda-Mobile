import { api } from "@/src/lib/api-client";
import type { Listing } from "../../listings/api/listings.api";

/** Mirror of the server's UserProfileResponse (`GET /users/:id`). */
export interface UserProfile {
  id: string;
  /** `name` and `surname` joined; null when the user filled in neither. */
  fullName: string | null;
  name: string | null;
  surname: string | null;
  email: string;
  phoneNumber: string | null;
  /** Prefer this one; `avatarThumbUrl` is the fallback. */
  avatarUrl: string | null;
  avatarThumbUrl: string | null;
  createdAt: string;
  /** Their ACTIVE listings only — drafts and archives stay with the owner. */
  listings: Listing[];
  listingCount: number;
}

export const usersApi = {
  getProfile: (id: string) => api<UserProfile>(`/users/${id}`),
};
