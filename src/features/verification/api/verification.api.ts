import { api, errorFromResponse, sendWithAuthRetry } from "@/src/lib/api-client";
import { appendFilePart } from "@/src/lib/form-data";
import { API_URL } from "@/src/lib/env";
import { useAuthStore } from "@/src/features/auth/store/auth.store";

export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

/** The applicant's own view. The documents they sent are never returned. */
export interface VerificationState {
  isVerified: boolean;
  request: {
    id: string;
    status: VerificationStatus;
    /** What a moderator told them, when the answer was no. */
    rejectionReason: string | null;
    createdAt: string;
    reviewedAt: string | null;
  } | null;
}

export interface SubmitVerificationInput {
  passportFrontUrl: string;
  passportBackUrl: string;
  selfieUrl: string;
}

/**
 * Uploads one document page.
 *
 * Same platform split as the other uploads: SDK 57's fetch only takes real
 * Blob parts, so appendFilePart wraps the URI per platform.
 */
async function uploadDocument(uri: string): Promise<string> {
  // Rebuilt per attempt: a FormData body cannot be replayed after the 401.
  const doUpload = async (): Promise<Response> => {
    const form = new FormData();
    await appendFilePart(form, "file", uri, "document.jpg");

    const accessToken = useAuthStore.getState().accessToken;

    return fetch(`${API_URL}/media/verification/upload`, {
      method: "POST",
      // No Content-Type: it must carry the multipart boundary, which only the
      // runtime knows. Setting it by hand makes the body unparseable.
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    });
  };

  const res = await sendWithAuthRetry(doUpload);
  if (!res.ok) throw await errorFromResponse(res, "Failed to upload");

  const body = (await res.json()) as { url: string };
  return body.url;
}

export const verificationApi = {
  mine: () => api<VerificationState>("/verification/me"),

  submit: (input: SubmitVerificationInput) =>
    api<{ id: string; status: VerificationStatus; createdAt: string }>(
      "/verification",
      { method: "POST", body: input },
    ),

  uploadDocument,
};
