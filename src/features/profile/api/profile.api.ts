// src/features/profile/api/profile.api.ts
import {
  api,
  errorFromResponse,
  sendWithAuthRetry,
} from "../../../lib/api-client";
import { appendFilePart } from "../../../lib/form-data";
import { API_URL } from "../../../lib/env";
import { useAuthStore } from "../../auth/store/auth.store";

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
  createdAt: string;
}

/**
 * Name and surname only. Phone and email are owned by the sign-in method
 * that verified them — see `authApi.identities` / link / unlink.
 */
export interface UpdateProfileInput {
  name?: string;
  surname?: string;
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
};
