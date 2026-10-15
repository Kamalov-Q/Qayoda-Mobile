import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

/**
 * The system photo library, with a fallback.
 *
 * Android 13 introduced the Photo Picker and expo-image-picker reaches for it
 * first. Plenty of devices do not have it: AOSP emulator images, anything
 * without the Play system module, and some manufacturer ROMs. There the
 * intent resolves to nothing and the call rejects with
 *
 *   ActivityNotFoundException: No Activity found to handle Intent
 *   { act=android.provider.action.PICK_IMAGES }
 *
 * which surfaced as a red screen the moment anybody tried to attach a photo.
 * `legacy: true` asks for the old document-picker flow instead, which exists
 * everywhere — so the second attempt is the one that works on those devices.
 *
 * Use this everywhere instead of calling launchImageLibraryAsync directly:
 * the fallback is worth nothing if only some screens have it.
 */
export async function pickFromLibrary(
  options: ImagePicker.ImagePickerOptions,
): Promise<ImagePicker.ImagePickerResult> {
  try {
    return await ImagePicker.launchImageLibraryAsync(options);
  } catch (error) {
    if (
      Platform.OS !== "android" ||
      options.legacy ||
      !isMissingPicker(error)
    ) {
      throw error;
    }
    return ImagePicker.launchImageLibraryAsync({ ...options, legacy: true });
  }
}

/** The one failure worth retrying: the Photo Picker is simply not installed. */
function isMissingPicker(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ActivityNotFoundException") ||
    message.includes("No Activity found to handle Intent") ||
    message.includes("PICK_IMAGES")
  );
}
