// Turns whatever the network layer threw into a string in the user's language.
//
// The backend's `message` is not localised, so surfacing it raw would leak
// English (or Russian) into an Uzbek UI. Status codes are the reliable signal,
// so they drive the message; the server text is only used for 400s, where it
// carries per-field validation detail no status code can express.
import { t, type TranslationKey } from "../i18n";
import { ApiError } from "./api-client";

const BY_STATUS: Record<number, TranslationKey> = {
  400: "errors.validation",
  401: "errors.sessionExpired",
  403: "errors.unauthorized",
  404: "errors.notFound",
  429: "errors.tooManyRequests",
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status >= 500) return t("errors.server");

    const key = BY_STATUS[error.status];
    // A 400 body usually names the offending field ("password too short") —
    // more useful than a generic line, so prefer it when present.
    if (error.status === 400 && error.message) return error.message;
    if (key) return t(key);
    return error.message || t("errors.unknown");
  }

  // fetch() rejects with a TypeError when the request never left the device.
  if (error instanceof TypeError) return t("errors.network");
  if (error instanceof Error && error.message) return error.message;

  return t("errors.unknown");
}
