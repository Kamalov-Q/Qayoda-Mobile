// The walkthrough film on an advert.
//
// Not the Videos tab. A reel is a post — published, paid for, ranked, liked,
// commented on, reportable. A tour is a slide in the listing's own gallery:
// one per advert, free, and gone when the advert is. The two share the Bunny
// upload pipeline and nothing else, which is exactly how the server splits
// them.
import { api } from "@/src/lib/api-client";

export type ListingVideoStatus = "UPLOADING" | "READY" | "FAILED";

export type ListingVideoFailReason =
  "TOO_LONG" | "ENCODING_FAILED" | "ABANDONED";

export interface ListingVideo {
  id: string;
  listingId: string;
  status: ListingVideoStatus;
  failReason: ListingVideoFailReason | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  /** Null until the file is playable — which is also how you tell. */
  hlsUrl: string | null;
  thumbUrl: string | null;
  createdAt: string;
}

/** What the server hands back to start an upload with. */
export interface ListingVideoTicket {
  videoId: string;
  upload: {
    endpoint: string;
    libraryId: string;
    /** Bunny's own id for the video — not ours. */
    videoId: string;
    signature: string;
    /** Unix seconds. The signature dies then, and so does the upload. */
    expires: number;
    metadata: { filetype: string; title: string };
  };
}

/** Three minutes, where a reel gets one — see the server's constants. */
export const LISTING_VIDEO_MAX_DURATION_SEC = 180;

export const listingVideosApi = {
  /**
   * The tour as its owner sees it, including one still encoding or failed.
   * The public listing carries only what plays.
   */
  get: (listingId: string) =>
    api<ListingVideo | null>(`/listings/${listingId}/video`),

  /**
   * Start an upload. Replaces whatever tour the listing had — the server
   * deletes the old Bunny object on the way through, so "you already have a
   * video" is never an error anybody has to read.
   */
  createUploadTicket: (listingId: string, mimeType?: string) =>
    api<ListingVideoTicket>(`/listings/${listingId}/video/upload`, {
      method: "POST",
      body: { mimeType },
    }),

  remove: (listingId: string) =>
    api<{ success: boolean }>(`/listings/${listingId}/video`, {
      method: "DELETE",
    }),
};
