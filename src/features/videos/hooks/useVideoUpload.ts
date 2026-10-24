import { useCallback, useRef, useState } from "react";
import { queryClient } from "@/src/lib/query-client";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";
import { handleChargeError } from "@/src/features/tariffs/lib/charge-errors";
import { videosApi, type UploadTicket } from "../api/videos.api";
import { uploadVideoToBunny } from "../lib/bunny-upload";
import { compressVideo } from "../lib/compress-video";

export type UploadPhase =
  /** Nothing started. */
  | "idle"
  /** Shrinking the clip on the phone, before any of it goes up. */
  | "compressing"
  /** Asking our server for a ticket — the point where a refusal is cheap. */
  | "preparing"
  /** Bytes moving, straight to Bunny. */
  | "uploading"
  /** Uploaded; Bunny is encoding and the server will charge on success. */
  | "processing"
  | "error";

/**
 * The posting flow, in one hook.
 *
 * The order matters and is the whole business design:
 *
 * 1. Shrink the clip, if this binary can (the compressor is native, so Expo
 *    Go cannot — see compress-video.ts). A 60-second 4K clip is 100 MB of
 *    somebody's mobile data to upload pixels Bunny will throw away.
 * 2. Ask our server for a ticket. It refuses here — before a byte moves — if
 *    the daily limit is used up, the listing is not theirs, or the balance
 *    cannot cover the fee. A refusal at this point costs the author nothing
 *    but a tap.
 * 3. Upload to Bunny directly, resumably. Our API is not involved and no
 *    money has moved.
 * 4. Stop. The fee is charged when Bunny confirms a valid file of a minute or
 *    less, which is the server's business (see the webhook) — so a clip that
 *    turns out to be 90 seconds long, or an upload that dies on the stairs,
 *    is free.
 *
 * Which is why this hook never reports "published": the honest thing it can
 * say is "uploaded, being processed", and the author's own shelf is where
 * that resolves.
 */
export function useVideoUpload() {
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const abort = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
    setPhase("idle");
    setProgress(0);
  }, []);

  const start = useCallback(
    async (input: {
      uri: string;
      caption?: string;
      listingId?: string;
      mimeType?: string;
    }): Promise<string | null> => {
      let ticket: UploadTicket;

      // Compress first, and against the compressed file's size: asking for a
      // ticket before this would mean the daily limit ticking up while the
      // phone spends twenty seconds transcoding.
      setPhase("compressing");
      setProgress(0);
      const { uri, compressed, from, to } = await compressVideo(
        input.uri,
        setProgress,
      );
      if (compressed) {
        console.log(
          `Compressed ${Math.round(from / 1e6)}MB → ${Math.round(to / 1e6)}MB`,
        );
      }

      setPhase("preparing");
      setProgress(0);
      try {
        ticket = await videosApi.createUploadTicket({
          listingId: input.listingId,
          caption: input.caption,
          mimeType: input.mimeType,
        });
      } catch (error) {
        setPhase("error");
        // An empty wallet is the one failure the author can fix, and the fix
        // is one screen away — the shared handler offers it.
        handleChargeError(error);
        return null;
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
          return null;
        }
        setPhase("error");
        toast.error(errorMessage(error));
        return null;
      }

      abort.current = null;
      setPhase("processing");
      // The shelf is where the author watches it turn into a published video.
      void queryClient.invalidateQueries({ queryKey: ["videos", "mine"] });
      return ticket.videoId;
    },
    [],
  );

  return {
    phase,
    /** 0–1, only meaningful while uploading. */
    progress,
    isBusy:
      phase === "compressing" || phase === "preparing" || phase === "uploading",
    start,
    cancel,
  };
}
