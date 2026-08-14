import { Platform } from "react-native";
import { useAuthStore } from "../features/auth/store/auth.store";
import { ApiError, refreshSession } from "./api-client";
import { API_URL } from "./env";

export interface UploadedImage {
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

export interface BatchUploadResult {
  images: UploadedImage[];
  /** Indices into the input array that the server could not process. */
  failed: number[];
}

/**
 * React Native's FormData recognises a file part by its `uri` field; the object
 * used to carry `url`, so every part went out empty and the server saw no
 * files. On web there is no such object form at all — the local URI has to be
 * read into a Blob first.
 */
async function appendFile(form: FormData, uri: string, index: number) {
  const name = `photo-${index}.jpg`;

  if (Platform.OS === "web") {
    const blob = await fetch(uri).then((r) => r.blob());
    form.append("files", blob, name);
    return;
  }

  form.append("files", {
    uri,
    name,
    type: "image/jpeg",
  } as unknown as Blob);
}

export async function uploadImages(
  localUris: string[],
): Promise<BatchUploadResult> {
  // Rebuilt per attempt: a FormData body cannot be replayed after the 401.
  const doUpload = async (): Promise<Response> => {
    const form = new FormData();
    for (const [index, uri] of localUris.entries()) {
      await appendFile(form, uri, index);
    }

    const accessToken = useAuthStore.getState().accessToken;

    return fetch(`${API_URL}/media/upload`, {
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

  const body = (await res.json()) as Partial<BatchUploadResult>;
  return { images: body.images ?? [], failed: body.failed ?? [] };
}
