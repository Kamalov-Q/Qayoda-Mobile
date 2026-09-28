import { Platform } from "react-native";
import { File } from "expo-file-system";

/**
 * Appends a local file to a multipart body.
 *
 * SDK 57's global fetch is WinterCG-compliant and takes only real Blob parts —
 * the old RN `{ uri, name, type }` object form throws "Unsupported
 * FormDataPart implementation". expo-file-system's File wraps a local URI as a
 * Blob; on web there is no expo File, so the URI is read into a Blob instead.
 *
 * One copy of this: avatars, listing photos and chat attachments all had their
 * own, and the chat one had quietly missed the web branch.
 */
export async function appendFilePart(
  form: FormData,
  field: string,
  uri: string,
  name: string,
) {
  if (Platform.OS === "web") {
    const blob = await fetch(uri).then((r) => r.blob());
    form.append(field, blob, name);
    return;
  }

  form.append(field, new File(uri), name);
}
