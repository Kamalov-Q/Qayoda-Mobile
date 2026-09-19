import { File } from "expo-file-system";
import { API_URL } from "../../../lib/env";
import { ApiError, refreshSession } from "../../../lib/api-client";
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

export async function uploadChatAttachment(
  localUri: string,
  kind: "IMAGE" | "VIDEO" | "VOICE" | "VIDEO_NOTE" | "FILE",
  fileName: string,
  mimeType: string,
): Promise<ChatAttachment> {
  const doUpload = () => {
    const form = new FormData();
    // SDK 57 fetch takes only real Blob parts; expo File wraps the local URI.
    // Never set Content-Type on the request manually (boundary is auto).
    form.append("file", new File(localUri), fileName);
    return fetch(`${API_URL}/media/chat/upload?kind=${kind}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
      },
      body: form,
    });
  };

  let res = await doUpload();
  if (res.status === 401) {
    const ok = await refreshSession();
    if (!ok) throw new ApiError(401, "Sessiya tugadi");
    res = await doUpload();
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}) as any);
    throw new ApiError(res.status, (err as any).message ?? "Yuklashda xatolik");
  }
  return res.json();
}
