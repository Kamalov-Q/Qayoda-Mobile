// src/features/profile/api/profile.api.ts
import {
  api,
  errorFromResponse,
  sendWithAuthRetry,
} from "../../../lib/api-client";
import { appendFilePart } from "../../../lib/form-data";
import { API_URL } from "../../../lib/env";
import { useAuthStore } from "../../auth/store/auth.store";
import type { SocialLinks } from "../../users/lib/social";

/** Mirrors the server's GENDERS. Not saying is null, not a third option. */
export const GENDERS = ["MALE", "FEMALE"] as const;
export type Gender = (typeof GENDERS)[number];

/** Mirror of the server's ProfileResponse. */
export interface Profile {
  id: string;
  /** Null unless a Google account is linked. */
  email: string | null;
  name: string | null;
  surname: string | null;
  avatarUrl: string | null;
  avatarThumbUrl: string | null;
  /** Null unless a number was verified by SMS. */
  phoneNumber: string | null;
  language: "uz" | "ru";
  isVerifiedRealtor: boolean;
  /** ISO date. Only ever on your OWN profile. */
  birthDate: string | null;
  /** Whole years, derived server-side from `birthDate`. */
  age: number | null;
  gender: Gender | null;
  address: string | null;
  bio: string | null;
  socialLinks: SocialLinks | null;
  createdAt: string;
}

/**
 * Everything the owner can change about themselves. Phone and email are
 * owned by the sign-in method that verified them — see `authApi.identities`
 * / link / unlink.
 *
 * A PATCH: anything left out is untouched. An empty string in a social
 * handle clears it, which is how the form removes one.
 */
export interface UpdateProfileInput {
  name?: string;
  surname?: string;
  /** `YYYY-MM-DD`. */
  birthDate?: string;
  /**
   * `null` clears the field; omitting it leaves whatever is stored. These
   * are optional answers, and somebody who gave one must be able to take it
   * back — an empty string is refused by the server, so clearing has to be
   * an explicit null.
   */
  gender?: Gender | null;
  /** A region CODE from `useRegions`, or null to clear. */
  address?: string | null;
  bio?: string | null;
  socialLinks?: SocialLinks;
}

/**
 * Same platform split as upload-client: SDK 57's fetch only takes real Blob
 * parts, so natives wrap the URI in expo-file-system's File; web reads the
 * URI into a Blob.
 */
async function uploadAvatar(uri: string): Promise<Profile> {
  // Rebuilt per attempt: a FormData body cannot be replayed after the 401.
  const doUpload = async (): Promise<Response> => {
    const form = new FormData();
    await appendFilePart(form, "file", uri, "avatar.jpg");

    const accessToken = useAuthStore.getState().accessToken;

    return fetch(`${API_URL}/profile/avatar`, {
      method: "POST",
      // No Content-Type: it must carry the multipart boundary, which only the
      // runtime knows. Setting it by hand makes the body unparseable.
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    });
  };

  const res = await sendWithAuthRetry(doUpload);
  if (!res.ok) throw await errorFromResponse(res, "Failed to upload");

  return (await res.json()) as Profile;
}

export const profileApi = {
  get: () => api<Profile>("/profile"),

  update: (input: UpdateProfileInput) =>
    api<Profile>("/profile", { method: "PATCH", body: input }),

  uploadAvatar,

  removeAvatar: () => api<Profile>("/profile/avatar", { method: "DELETE" }),

  /**
   * Delete this account. Irreversible, and the session dies with it: every
   * refresh token is revoked server-side, so the caller must tear the local
   * session down immediately after — see useDeleteAccount.
   */
  deleteAccount: (reason?: string) =>
    api<void>("/profile", {
      method: "DELETE",
      body: reason ? { reason } : {},
    }),
};
