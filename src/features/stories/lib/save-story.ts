import * as MediaLibrary from "expo-media-library";
import { Directory, File, Paths } from "expo-file-system";
import { notify } from "@/src/lib/alerts";
import { toast } from "@/src/components/ui/Toast";
import { resolveMediaUrl } from "@/src/lib/media-url";

/** Unique per save: a name reused from a previous download collides, and the
 *  collision surfaces to the reader as "could not save". */
function fileNameFor(url: string): string {
  const clean = url.split("?")[0];
  const ext = /\.(jpe?g|png|webp|gif|mp4|mov|m4v)$/i.exec(clean)?.[0] ?? ".jpg";
  return `story_${Date.now()}${ext}`;
}

/**
 * Saves a story's photo or video to the phone's gallery.
 *
 * The same shape as the chat's image save — permission, pull the remote file
 * into the cache because MediaLibrary only takes local ones, save, then clean
 * up. Cache rather than documents: the copy is disposable the moment the
 * asset is in the gallery.
 */
export async function saveStoryMedia(mediaUrl: string): Promise<void> {
  const url = resolveMediaUrl(mediaUrl);
  if (!url) return;

  // writeOnly: saving needs no read access, and iOS shows the lighter
  // "add to library" prompt for it.
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) {
    notify("chat.galleryPermissionTitle", "chat.galleryPermissionMessage");
    return;
  }

  const downloads = new Directory(Paths.cache, "story-downloads");
  if (!downloads.exists) downloads.create({ intermediates: true });

  const target = new File(downloads, fileNameFor(url));
  const file = await File.downloadFileAsync(url, target, {
    idempotent: true, // the same story saved twice must not throw
  });

  try {
    // Asset.create, not saveToLibraryAsync: the latter is the legacy API and
    // SDK 57 throws a deprecation error from it rather than only warning.
    await MediaLibrary.Asset.create(file.uri);
    toast.successKey("stories.saved");
  } finally {
    // Cleanup must never turn a saved file into an error.
    try {
      file.delete();
    } catch {
      // The OS reclaims the cache directory anyway.
    }
  }
}
