import { Platform } from "react-native";
import { File } from "expo-file-system";
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
 * SDK 57's global fetch is WinterCG-compliant and only takes real Blob parts —
 * the old RN `{ uri, name, type }` object form throws "Unsupported
 * FormDataPart implementation". expo-file-system's File wraps a local URI as a
 * Blob. On web there is no expo File; the URI is read into a Blob instead.
 */
async function appendFile(form: FormData, uri: string, index: number) {
  const name = `photo-${index}.jpg`;

  if (Platform.OS === "web") {
    const blob = await fetch(uri).then((r) => r.blob());
    form.append("files", blob, name);
    return;
  }

  form.append("files", new File(uri), name);
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
