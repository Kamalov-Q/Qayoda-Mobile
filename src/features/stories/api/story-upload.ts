import { API_URL } from "@/src/lib/env";
import {
  errorFromResponse,
  sendWithAuthRetry,
} from "@/src/lib/api-client";
import { File } from "expo-file-system";
import { appendFilePart } from "@/src/lib/form-data";
import { useAuthStore } from "@/src/features/auth/store/auth.store";

/**
 * The most a story's media may weigh.
 *
 * Under the API's own cap on purpose, which is itself at the proxy's
 * `client_max_body_size`: multipart framing makes the REQUEST bigger than the
 * file, so a file exactly at the limit crosses it — and that rejection comes
 * from the proxy as an HTML page, before the API can explain itself.
 *
 * Checking here is what stops a phone on mobile data spending five minutes
 * pushing something that was always going to be refused.
 */
export const MAX_STORY_BYTES = 60 * 1024 * 1024;
export const MAX_STORY_MB = Math.round(MAX_STORY_BYTES / 1024 / 1024);

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

/**
 * Whether this file is small enough to bother sending.
 *
 * Asked before the upload starts, because the alternative is a phone
 * spending minutes pushing a video the proxy will refuse the moment it
 * arrives. Returns the size so the caller can say how far over it is.
 */
export async function measureStoryMedia(
  localUri: string,
): Promise<{ bytes: number; tooLarge: boolean }> {
  try {
    const file = new File(localUri);
    const bytes = file.size ?? 0;
    return { bytes, tooLarge: bytes > MAX_STORY_BYTES };
  } catch {
    // Unreadable size is not a reason to block a post: the server has its own
    // limit, and it is the one that decides.
    return { bytes: 0, tooLarge: false };
  }
}
