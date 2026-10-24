import { File } from "expo-file-system";

/**
 * Shrinking a clip on the phone, before any of it goes up.
 *
 * Why it matters here more than it would anywhere else: a 60-second clip off
 * a modern phone is 60–120 MB at 1080p or 4K, and Bunny is going to throw
 * nearly all of that away — the ladder tops out at 720p. So the full file is
 * somebody's mobile data spent to upload pixels nobody will ever be served.
 *
 * `react-native-compressor` is a NATIVE module, so it is absent from Expo Go.
 * It is required lazily inside a try/catch for that reason, and a failure to
 * load — or to compress — is not a failure to post: the original goes up
 * instead, exactly as it did before this file existed.
 */

/** Past this, compressing costs more battery than it saves bytes. */
const MIN_BYTES_WORTH_COMPRESSING = 6 * 1024 * 1024;

/** The ladder tops out at 720p; anything larger is thrown away by Bunny. */
const MAX_DIMENSION = 1280;
/** ~2.2 Mbps: comfortably above what 720p needs, well under what phones shoot. */
const TARGET_BITRATE = 2_200_000;

export interface CompressResult {
  /** What to upload — the compressed copy, or the original if nothing ran. */
  uri: string;
  /** Bytes before and after, for the log line and nothing else. */
  from: number;
  to: number;
  compressed: boolean;
}

function sizeOf(uri: string): number {
  try {
    return new File(uri).size ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Compress if we can, pass through if we cannot.
 *
 * `onProgress` reports 0–1 and is called often; the caller throttles it into
 * whatever it is drawing.
 */
export async function compressVideo(
  uri: string,
  onProgress?: (ratio: number) => void,
): Promise<CompressResult> {
  const from = sizeOf(uri);

  // Small clips are already small. Running a transcode over a 3 MB file to
  // save a few hundred kilobytes is ten seconds of somebody's battery for
  // nothing.
  if (from > 0 && from < MIN_BYTES_WORTH_COMPRESSING) {
    return { uri, from, to: from, compressed: false };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy: absent in Expo Go
    const { Video } = require("react-native-compressor") as {
      Video: {
        compress(
          url: string,
          options: Record<string, unknown>,
          onProgress?: (p: number) => void,
        ): Promise<string>;
      };
    };

    const out = await Video.compress(
      uri,
      {
        // manual, not auto: auto picks its own bitrate from the source, which
        // on a 4K clip is still far more than a 720p ladder will ever use.
        compressionMethod: "manual",
        maxSize: MAX_DIMENSION,
        bitrate: TARGET_BITRATE,
        minimumFileSizeForCompress: MIN_BYTES_WORTH_COMPRESSING / (1024 * 1024),
      },
      (p) => onProgress?.(p),
    );

    const to = sizeOf(out);
    // A "compressed" file that came out bigger is a transcode that misjudged
    // the source. Upload whichever is smaller.
    if (to > 0 && from > 0 && to >= from) {
      return { uri, from, to: from, compressed: false };
    }
    return { uri: out, from, to, compressed: true };
  } catch {
    // Expo Go (no native module), an unsupported codec, a cancelled task:
    // none of these are reasons not to post the video.
    return { uri, from, to: from, compressed: false };
  }
}
