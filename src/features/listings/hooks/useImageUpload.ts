import { useState, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { uploadImages, UploadedImage } from "../../../lib/upload-client";
import { toast } from "../../../components/ui/Toast";
import { errorMessage } from "../../../lib/api-error";
import type { ImageInput } from "../api/listings.api";

export interface ManagedImage {
  /** Identity of the tile. Never the URI: the picker can hand back the same
   *  file twice, and two tiles sharing a key made remove/retry hit the wrong
   *  one — and silently dropped one of the two uploads. */
  key: string;
  displayUri: string;
  status: "existing" | "uploading" | "done" | "error";
  /** Local source, kept so a failed tile can be retried without re-picking. */
  sourceUri?: string;
  remote?: UploadedImage;
}

export const MAX_IMAGES = 15;

// Long edge the originals are downscaled to before upload. A modern phone
// photo is 8–12 MB; this lands around 300 KB with no visible loss at the sizes
// the app renders.
const MAX_EDGE = 1600;
const QUALITY = 0.8;

let keySeq = 0;
const nextKey = () => `img-${keySeq++}`;

/** Downscale + re-encode on device. Throws if the file can't be read. */
async function downscale(uri: string): Promise<string> {
  const rendered = await ImageManipulator.manipulate(uri)
    .resize({ width: MAX_EDGE })
    .renderAsync();
  const saved = await rendered.saveAsync({
    compress: QUALITY,
    format: SaveFormat.JPEG,
  });
  return saved.uri;
}

export function useImageUpload(initial: UploadedImage[] = []) {
  const [images, setImages] = useState<ManagedImage[]>(() =>
    initial.map((img) => ({
      key: nextKey(),
      displayUri: img.thumbUrl,
      status: "existing",
      remote: img,
    })),
  );

  const uploadBatch = useCallback(async (sourceUris: string[]) => {
    if (sourceUris.length === 0) return;

    // Tiles appear immediately, keyed independently of the URI, and showing
    // the original file while the resized copy is still being written.
    const batch = sourceUris.map((uri) => ({ key: nextKey(), uri }));
    setImages((prev) => [
      ...prev,
      ...batch.map(({ key, uri }) => ({
        key,
        displayUri: uri,
        status: "uploading" as const,
        sourceUri: uri,
      })),
    ]);

    const markErrored = (keys: string[]) => {
      const set = new Set(keys);
      setImages((prev) =>
        prev.map((img) =>
          set.has(img.key) ? { ...img, status: "error" as const } : img,
        ),
      );
    };

    // Resizing is per-file, so one unreadable photo fails only its own tile.
    const resized: { key: string; uri: string }[] = [];
    const failedResize: string[] = [];
    for (const { key, uri } of batch) {
      try {
        resized.push({ key, uri: await downscale(uri) });
      } catch {
        failedResize.push(key);
      }
    }
    if (failedResize.length) markErrored(failedResize);
    if (resized.length === 0) return;

    try {
      const { images: uploaded, failed } = await uploadImages(
        resized.map((r) => r.uri),
      );
      const failedSet = new Set(failed ?? []);

      // `uploaded` holds only the successes, in input order, so walking the
      // batch and advancing a cursor past the failures pairs them up.
      let cursor = 0;
      const byKey = new Map<string, UploadedImage | null>();
      resized.forEach((item, index) => {
        byKey.set(item.key, failedSet.has(index) ? null : (uploaded[cursor++] ?? null));
      });

      setImages((prev) =>
        prev.map((img) => {
          if (!byKey.has(img.key)) return img;
          const remote = byKey.get(img.key);
          return remote
            ? { ...img, status: "done" as const, remote }
            : { ...img, status: "error" as const };
        }),
      );
    } catch (error) {
      markErrored(resized.map((r) => r.key));
      toast.error(errorMessage(error));
    }
  }, []);

  const pickAndUpload = useCallback(async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.infoKey("images.limitReached", { max: MAX_IMAGES });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1,
    });
    if (result.canceled) return;

    // selectionLimit is advisory on web and on some Android pickers, so the
    // cap is enforced here too.
    const picked = result.assets.map((a) => a.uri);
    if (picked.length > remaining) {
      toast.infoKey("images.limitReached", { max: MAX_IMAGES });
    }
    await uploadBatch(picked.slice(0, remaining));
  }, [images.length, uploadBatch]);

  const remove = useCallback((key: string) => {
    setImages((prev) => prev.filter((img) => img.key !== key));
  }, []);

  /** Tapping any errored tile re-uploads ALL errored images as one batch. */
  const retry = useCallback(async () => {
    const errored = images.filter((i) => i.status === "error" && i.sourceUri);
    if (errored.length === 0) return;

    const drop = new Set(errored.map((i) => i.key));
    setImages((prev) => prev.filter((img) => !drop.has(img.key)));
    await uploadBatch(errored.map((i) => i.sourceUri!));
  }, [images, uploadBatch]);

  const makePrimary = useCallback((key: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.key === key);
      if (!target) return prev;
      return [target, ...prev.filter((img) => img.key !== key)];
    });
  }, []);

  const toPayload = useCallback(
    (): ImageInput[] =>
      images
        .filter(
          (i) => (i.status === "done" || i.status === "existing") && i.remote,
        )
        .map((i, idx) => {
          const { url, thumbUrl, width, height } = i.remote!;
          return {
            url,
            thumbUrl,
            // Images restored from the server carry no dimensions; sending
            // zeroes back would overwrite the real values with garbage.
            ...(width && height ? { width, height } : {}),
            position: idx,
            isPrimary: idx === 0,
          };
        }),
    [images],
  );

  const isUploading = images.some((i) => i.status === "uploading");
  const hasErrors = images.some((i) => i.status === "error");

  return {
    images,
    pickAndUpload,
    remove,
    retry,
    makePrimary,
    toPayload,
    isUploading,
    hasErrors,
  };
}
