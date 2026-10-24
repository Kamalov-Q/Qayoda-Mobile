import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/src/lib/query-client";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";
import { uploadVideoToBunny } from "@/src/features/videos/lib/bunny-upload";
import { compressVideo } from "@/src/features/videos/lib/compress-video";
import {
  listingVideosApi,
  type ListingVideo,
  type ListingVideoTicket,
} from "../api/listing-videos.api";

export const listingVideoKey = (listingId: string) =>
  ["listing-video", listingId] as const;

/** Poll this often while Bunny is encoding; stop once it settles. */
const ENCODING_POLL_MS = 5_000;

/**
 * The owner's view of their tour — including one that is still encoding.
 *
 * Polls while the answer is UPLOADING and stops the moment it is not. The
 * alternative, a socket for one row that changes twice in its life, is a
 * connection to carry two events.
 */
export function useListingVideo(listingId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: listingVideoKey(listingId ?? ""),
    queryFn: () => listingVideosApi.get(listingId!),
    enabled: !!listingId && enabled,
    refetchInterval: (query) =>
      query.state.data?.status === "UPLOADING" ? ENCODING_POLL_MS : false,
  });
}

export function useDeleteListingVideo(listingId: string) {
  return useMutation({
    mutationFn: () => listingVideosApi.remove(listingId),
    onSuccess: () => {
      queryClient.setQueryData<ListingVideo | null>(
        listingVideoKey(listingId),
        null,
      );
      // The gallery on the listing page reads the tour off the listing.
      void queryClient.invalidateQueries({ queryKey: ["listing", listingId] });
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export type TourUploadPhase =
  | "idle"
  /** Shrinking the file on the phone, before any of it goes up. */
  | "compressing"
  /** Asking our server for a ticket — the point where a refusal is cheap. */
  | "preparing"
  /** Bytes moving, straight to Bunny. */
  | "uploading"
  /** Uploaded; Bunny is encoding and the poll above takes over. */
  | "processing"
  | "error";

/**
 * Uploading a tour.
 *
 * Deliberately simpler than the reel version, because a tour is simpler:
 * there is no daily limit to run out of, no wallet to be empty, no price to
 * quote and no publish step. Compress, get a ticket, send the bytes, let the
 * webhook finish the job. The one thing that can still go wrong late is the
 * length — three minutes is checked against the ENCODED file, so a long clip
 * comes back as FAILED/TOO_LONG a minute after the upload succeeds, which is
 * what the editor's status line is for.
 */
export function useListingVideoUpload(listingId: string) {
  const [phase, setPhase] = useState<TourUploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const abort = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
    setPhase("idle");
    setProgress(0);
  }, []);

  const start = useCallback(
    async (input: { uri: string; mimeType?: string }): Promise<boolean> => {
      let ticket: ListingVideoTicket;

      // Compress first: a three-minute 4K walkthrough is a few hundred
      // megabytes of somebody's mobile data to upload pixels Bunny will
      // throw away. Native, so it no-ops in Expo Go.
      setPhase("compressing");
      setProgress(0);
      const { uri, compressed, from, to } = await compressVideo(
        input.uri,
        setProgress,
      );
      if (compressed) {
        console.log(
          `Compressed tour ${Math.round(from / 1e6)}MB → ${Math.round(to / 1e6)}MB`,
        );
      }

      setPhase("preparing");
      setProgress(0);
      try {
        ticket = await listingVideosApi.createUploadTicket(
          listingId,
          input.mimeType,
        );
      } catch (error) {
        setPhase("error");
        toast.error(errorMessage(error));
        return false;
      }

      const controller = new AbortController();
      abort.current = controller;
      setPhase("uploading");

      try {
        await uploadVideoToBunny({
          uri,
          ticket,
          signal: controller.signal,
          onProgress: ({ ratio }) => setProgress(ratio),
        });
      } catch (error) {
        abort.current = null;
        if (controller.signal.aborted) {
          setPhase("idle");
          return false;
        }
        setPhase("error");
        toast.error(errorMessage(error));
        return false;
      }

      abort.current = null;
      setPhase("processing");
      // The row is UPLOADING now; the query above polls it to READY.
      void queryClient.invalidateQueries({
        queryKey: listingVideoKey(listingId),
      });
      void queryClient.invalidateQueries({ queryKey: ["listing", listingId] });
      return true;
    },
    [listingId],
  );

  return {
    phase,
    /** 0–1; means compression during "compressing" and bytes during "uploading". */
    progress,
    isBusy:
      phase === "compressing" || phase === "preparing" || phase === "uploading",
    start,
    cancel,
  };
}
