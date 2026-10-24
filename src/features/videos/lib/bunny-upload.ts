import { File, FileMode } from "expo-file-system";
/**
 * Everything this uploader needs, and nothing else.
 *
 * Narrower than either feature's ticket type on purpose: sending bytes to
 * Bunny has no opinion about what the file is for. A reel's ticket also
 * carries the price it will be charged and a listing tour's does not, and
 * neither fact belongs in a function that moves 4 MB at a time.
 */
export interface BunnyUploadTicket {
  upload: {
    endpoint: string;
    libraryId: string;
    videoId: string;
    signature: string;
    expires: number;
    metadata: { filetype: string; title: string };
  };
}

/**
 * Uploading a video straight to Bunny Stream, over tus.
 *
 * The file never passes through our API. A 60-second clip off a modern phone
 * is 20–60 MB, and routing that through Node meant holding it in the server's
 * memory while every other request waited — which is exactly the problem the
 * old story uploads had. Here the phone talks to Bunny directly, with a
 * signature our server minted for this one video and the next two hours.
 *
 * tus is implemented by hand rather than with tus-js-client: the client is
 * written for browser `File` objects and would need the whole clip in memory
 * as a Blob. React Native can do better — expo-file-system hands out a file
 * handle, so the clip is read and sent one chunk at a time and never fully
 * resident. The protocol used here is the small half of tus: create with
 * `Upload-Length`, then `PATCH` at an offset, and `HEAD` to find out where we
 * got to after a dropped connection.
 */

/**
 * 4 MB a chunk. Big enough that the per-request overhead disappears, small
 * enough that a dropped connection on a bad mobile network loses a second of
 * uploading rather than a minute of it.
 */
const CHUNK_BYTES = 4 * 1024 * 1024;

/** Per chunk, not per upload: the offset is re-read from Bunny between tries. */
const MAX_RETRIES = 4;

const TUS_VERSION = "1.0.0";

export interface UploadProgress {
  /** 0–1. */
  ratio: number;
  bytesSent: number;
  totalBytes: number;
}

export class VideoUploadError extends Error {
  constructor(
    message: string,
    /** The HTTP status that ended it, when there was one. */
    public status?: number,
  ) {
    super(message);
  }
}

/**
 * Send `uri` to Bunny under `ticket`. Resolves when the whole file is in.
 *
 * Nothing about our own API is touched here: encoding, the duration check and
 * the charge all happen later, when Bunny tells the server the file is ready
 * (see the webhook). So a cancelled or failed upload costs the author
 * nothing — which is the reason the money moves at the end and not here.
 */
export async function uploadVideoToBunny({
  uri,
  ticket,
  onProgress,
  signal,
}: {
  uri: string;
  ticket: BunnyUploadTicket;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const file = new File(uri);
  if (!file.exists) {
    throw new VideoUploadError("The video file is no longer on the device");
  }

  const totalBytes = file.size;
  if (!totalBytes) throw new VideoUploadError("The video file is empty");

  const uploadUrl = await createUpload(ticket, totalBytes, signal);

  // One handle for the whole upload, with the cursor moved by hand: opening
  // the file per chunk would re-resolve a content:// URI fifteen times.
  const handle = file.open(FileMode.ReadOnly);
  let offset = 0;

  try {
    while (offset < totalBytes) {
      throwIfAborted(signal);

      handle.offset = offset;
      const chunk = handle.readBytes(
        Math.min(CHUNK_BYTES, totalBytes - offset),
      );
      if (!chunk.length) {
        throw new VideoUploadError("The video file ended sooner than expected");
      }

      offset = await sendChunk({
        uploadUrl,
        ticket,
        offset,
        chunk,
        signal,
      });
      onProgress?.({
        ratio: offset / totalBytes,
        bytesSent: offset,
        totalBytes,
      });
    }
  } finally {
    handle.close();
  }
}

/**
 * tus step one: tell Bunny how big the file is and get the URL to write into.
 *
 * The metadata is required by Bunny (both `filetype` and `title`) and is
 * base64 per the tus spec. The four auth headers ride on every request.
 */
async function createUpload(
  ticket: BunnyUploadTicket,
  totalBytes: number,
  signal?: AbortSignal,
): Promise<string> {
  const { endpoint, metadata } = ticket.upload;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...authHeaders(ticket),
      "Tus-Resumable": TUS_VERSION,
      "Upload-Length": String(totalBytes),
      "Upload-Metadata": [
        `filetype ${base64(metadata.filetype)}`,
        `title ${base64(metadata.title)}`,
      ].join(","),
    },
    signal,
  });

  if (res.status !== 201) {
    // 401 means the signature and the headers disagree, 400 that the ticket
    // has already expired — both are "ask the server for a new ticket".
    throw new VideoUploadError(
      `Could not start the upload (${res.status})`,
      res.status,
    );
  }

  const location = res.headers.get("Location") ?? res.headers.get("location");
  if (!location) {
    throw new VideoUploadError("The upload service did not say where to send");
  }

  // Bunny answers with an absolute URL today; resolve anyway, because a
  // relative Location is legal tus and would otherwise be requested against
  // the app's own origin.
  return new URL(location, endpoint).toString();
}

/**
 * tus step two: write one chunk at `offset` and return the new offset.
 *
 * Retried on the three failures that are not the client's fault — a network
 * blip, a 5xx, and the two tus statuses that mean "you are not where you
 * think you are" — each time re-reading the real offset from Bunny rather
 * than guessing, because resuming at the wrong place corrupts the file.
 */
async function sendChunk({
  uploadUrl,
  ticket,
  offset,
  chunk,
  signal,
}: {
  uploadUrl: string;
  ticket: BunnyUploadTicket;
  offset: number;
  chunk: Uint8Array;
  signal?: AbortSignal;
}): Promise<number> {
  let attempt = 0;
  let at = offset;

  for (;;) {
    throwIfAborted(signal);

    try {
      const res = await fetch(uploadUrl, {
        method: "PATCH",
        headers: {
          ...authHeaders(ticket),
          "Tus-Resumable": TUS_VERSION,
          "Upload-Offset": String(at),
          "Content-Type": "application/offset+octet-stream",
        },
        // A typed array, not a Blob: this is the chunk we just read, and
        // wrapping it would copy it.
        body: chunk as unknown as BodyInit,
        signal,
      });

      if (res.status === 204 || res.status === 200) {
        const next = Number(res.headers.get("Upload-Offset"));
        return Number.isFinite(next) && next > at ? next : at + chunk.length;
      }

      // 409/423: our offset is stale or the file is locked by another attempt.
      // 5xx: Bunny's problem, and it may be over by the next try.
      const retriable =
        res.status === 409 || res.status === 423 || res.status >= 500;
      if (!retriable || attempt >= MAX_RETRIES) {
        throw new VideoUploadError(
          `The upload failed (${res.status})`,
          res.status,
        );
      }
    } catch (error) {
      if (isAbort(error)) throw error;
      if (error instanceof VideoUploadError) throw error;
      // Anything else is a dropped connection, which is the case tus exists
      // for: find out where Bunny got to and carry on from there.
      if (attempt >= MAX_RETRIES) {
        throw new VideoUploadError(
          (error as Error)?.message || "The upload failed",
        );
      }
    }

    attempt += 1;
    await delay(backoffMs(attempt), signal);

    const real = await headOffset(uploadUrl, ticket, signal);
    // The chunk may have landed in full before the connection died. Nothing
    // left of it to send means this chunk is done.
    if (real >= offset + chunk.length) return real;
    if (real !== at) at = real;
    if (real !== offset) {
      // Part of the chunk landed. Rather than re-slice the file here, hand
      // the real offset back: the caller's loop reads from it next time.
      return real;
    }
  }
}

/** Where Bunny thinks we are. The one question tus answers for free. */
async function headOffset(
  uploadUrl: string,
  ticket: BunnyUploadTicket,
  signal?: AbortSignal,
): Promise<number> {
  const res = await fetch(uploadUrl, {
    method: "HEAD",
    headers: { ...authHeaders(ticket), "Tus-Resumable": TUS_VERSION },
    signal,
  });

  if (res.status === 404 || res.status === 410) {
    // The upload is gone: expired, or already finished and swept up.
    throw new VideoUploadError("The upload expired — please try again", 404);
  }

  const offset = Number(res.headers.get("Upload-Offset"));
  if (!Number.isFinite(offset) || offset < 0) {
    throw new VideoUploadError("The upload service lost its place");
  }
  return offset;
}

function authHeaders(ticket: BunnyUploadTicket): Record<string, string> {
  const { libraryId, videoId, signature, expires } = ticket.upload;
  return {
    AuthorizationSignature: signature,
    AuthorizationExpire: String(expires),
    LibraryId: libraryId,
    VideoId: videoId,
  };
}

/** 1s, 2s, 4s, 8s. */
const backoffMs = (attempt: number) =>
  Math.min(8000, 2 ** (attempt - 1) * 1000);

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

const abortError = () => {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
};

const isAbort = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

/**
 * base64 for the tus metadata header.
 *
 * Hand-rolled because `btoa` is not guaranteed on every engine the app runs
 * on and these are two short ASCII strings — pulling in a polyfill for 30
 * bytes of header would be the heavier choice.
 */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64(input: string): string {
  // The title can be anything the author typed, so go through UTF-8 bytes
  // rather than char codes — base64 of a lone surrogate is not valid header.
  const bytes = utf8(input);
  let out = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];

    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? "=" : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : B64[c & 63];
  }

  return out;
}

function utf8(input: string): number[] {
  const bytes: number[] = [];

  for (const char of input) {
    const code = char.codePointAt(0)!;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    } else if (code < 0x10000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
    }
  }

  return bytes;
}
