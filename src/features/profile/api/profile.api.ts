// src/features/profile/api/profile.api.ts
import { Platform } from "react-native";
import { api, ApiError, refreshSession } from "../../../lib/api-client";
import { API_URL } from "../../../lib/env";
import { useAuthStore } from "../../auth/store/auth.store";

/** Mirror of the server's ProfileResponse. */
export interface Profile {
  id: string;
  email: string;
  name: string | null;
  surname: string | null;
  avatarUrl: string | null;
  avatarThumbUrl: string | null;
  phoneNumber: string | null;
  createdAt: string;
}

export interface UpdateProfileInput {
  name?: string;
  surname?: string;
  /** `null` clears the number server-side; omit to leave it untouched. */
  phoneNumber?: string | null;
}

/**
 * Same platform split as upload-client: React Native's FormData needs the
 * `{ uri, name, type }` object form, web needs a real Blob.
 */
async function appendAvatar(form: FormData, uri: string) {
  const name = "avatar.jpg";

  if (Platform.OS === "web") {
    const blob = await fetch(uri).then((r) => r.blob());
    form.append("file", blob, name);
    return;
  }

  form.append("file", {
    uri,
    name,
    type: "image/jpeg",
  } as unknown as Blob);
}

async function uploadAvatar(uri: string): Promise<Profile> {
  // Rebuilt per attempt: a FormData body cannot be replayed after the 401.
  const doUpload = async (): Promise<Response> => {
    const form = new FormData();
    await appendAvatar(form, uri);

    const accessToken = useAuthStore.getState().accessToken;

    return fetch(`${API_URL}/profile/avatar`, {
      method: "POST",
      // No Content-Type: it must carry the multipart boundary, which only the
      // runtime knows. Setting it by hand makes the body unparseable.
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    });
  };

  let res = await doUpload();
  if (res.status === 401) {
    const ok = await refreshSession();
    if (!ok) throw new ApiError(401, "Session expired");
    res = await doUpload();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err?.message ?? "Failed to upload");
  }

  return res.json() as Promise<Profile>;
}

export const profileApi = {
  get: () => api<Profile>("/profile"),

  update: (input: UpdateProfileInput) =>
    api<Profile>("/profile", { method: "PATCH", body: input }),

  uploadAvatar,

  removeAvatar: () => api<Profile>("/profile/avatar", { method: "DELETE" }),
};
