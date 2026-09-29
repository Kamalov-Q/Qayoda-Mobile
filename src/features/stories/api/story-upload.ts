import { API_URL } from "@/src/lib/env";
import {
  errorFromResponse,
  sendWithAuthRetry,
} from "@/src/lib/api-client";
import { appendFilePart } from "@/src/lib/form-data";
import { useAuthStore } from "@/src/features/auth/store/auth.store";

/** What the server gives back for a story's photo or video. */
export interface UploadedStoryMedia {
  url: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
}

/**
 * Uploads a story's photo or video.
 *
 * Its own endpoint rather than the chat one, though the processing behind
 * them is the same today: a story's media may want different treatment later
 * (a tighter size cap, a poster frame at a chosen second) and moving it then
 * would mean moving every caller.
 */
export async function uploadStoryMedia(
  localUri: string,
  kind: "IMAGE" | "VIDEO",
  fileName: string,
): Promise<UploadedStoryMedia> {
  // Rebuilt per attempt: a FormData body cannot be replayed after the 401.
  const send = async (): Promise<Response> => {
    const form = new FormData();
    await appendFilePart(form, "file", localUri, fileName);

    return fetch(`${API_URL}/media/stories/upload?kind=${kind}`, {
      method: "POST",
      // No Content-Type: the multipart boundary is generated with the body.
      headers: {
        Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
      },
      body: form,
    });
  };

  const res = await sendWithAuthRetry(send);
  if (!res.ok) throw await errorFromResponse(res, "Upload failed");

  return (await res.json()) as UploadedStoryMedia;
}
