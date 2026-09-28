import { useAuthStore } from "../features/auth/store/auth.store";
import { errorFromResponse, sendWithAuthRetry } from "./api-client";
import { appendFilePart } from "./form-data";
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

export async function uploadImages(
  localUris: string[],
): Promise<BatchUploadResult> {
  // Rebuilt per attempt: a FormData body cannot be replayed after the 401.
  const doUpload = async (): Promise<Response> => {
    const form = new FormData();
    for (const [index, uri] of localUris.entries()) {
      await appendFilePart(form, "files", uri, `photo-${index}.jpg`);
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

  const res = await sendWithAuthRetry(doUpload);
  if (!res.ok) throw await errorFromResponse(res, "Failed to upload");

  const body = (await res.json()) as Partial<BatchUploadResult>;
  return { images: body.images ?? [], failed: body.failed ?? [] };
}
