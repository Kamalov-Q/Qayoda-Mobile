import { API_URL } from "../../../lib/env";
import {
  errorFromResponse,
  sendWithAuthRetry,
} from "../../../lib/api-client";
import { appendFilePart } from "../../../lib/form-data";
import { useAuthStore } from "../../auth/store/auth.store";

export interface ChatAttachment {
  url: string;
  thumbUrl: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  waveform: number[] | null;
}

/**
 * Uploads one attachment and returns the row the message will carry.
 *
 * The part's content type is the file's own — the OS derives it from the
 * extension — and that is what the server echoes back as `mimeType`. There is
 * no way to override it from here, so a caller that needs a particular type
 * must name the file accordingly.
 */
export async function uploadChatAttachment(
  localUri: string,
  kind: "IMAGE" | "VIDEO" | "VOICE" | "VIDEO_NOTE" | "FILE",
  fileName: string,
): Promise<ChatAttachment> {
  // Rebuilt per attempt: a FormData body cannot be replayed after the 401.
  const doUpload = async (): Promise<Response> => {
    const form = new FormData();
    await appendFilePart(form, "file", localUri, fileName);
    // Never set Content-Type on the request manually — the boundary is
    // generated with the body, and naming the type by hand loses it.
    return fetch(`${API_URL}/media/chat/upload?kind=${kind}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
      },
      body: form,
    });
  };

  const res = await sendWithAuthRetry(doUpload);
  if (!res.ok) throw await errorFromResponse(res, "Upload failed");

  return (await res.json()) as ChatAttachment;
}
