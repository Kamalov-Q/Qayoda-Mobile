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

// Auth errors carry a `code`; each one has its own line because the status
// alone ("401") would tell a user nothing about whether to retype the code
// or ask for a new one.
const BY_CODE: Record<string, TranslationKey> = {
  PHONE_INVALID: "validation.phoneInvalid",
  // Categories are admin-managed: one can be hidden or removed while a user
  // has the post form open.
  CATEGORY_UNKNOWN: "errors.categoryUnknown",
  FLOORS_NOT_ALLOWED: "errors.floorsNotAllowed",
  OTP_INVALID: "errors.otpInvalid",
  OTP_LOCKED: "errors.otpLocked",
  OTP_COOLDOWN: "errors.otpCooldown",
  OTP_RATE_LIMITED: "errors.otpRateLimited",
  SMS_SEND_FAILED: "errors.smsFailed",
  GOOGLE_TOKEN_INVALID: "errors.googleFailed",
  SESSION_NOT_FOUND: "errors.telegramExpired",
  SESSION_CONSUMED: "errors.telegramExpired",
  ACCOUNT_BANNED: "errors.accountBanned",
  ACCOUNT_DELETED: "errors.accountDeleted",
  IDENTITY_TAKEN: "errors.identityTaken",
  PROVIDER_ALREADY_LINKED: "errors.providerAlreadyLinked",
  LAST_IDENTITY: "errors.lastIdentity",
  INVALID_CREDENTIALS: "errors.invalidCredentials",
  PASSWORD_NOT_SET: "errors.passwordNotSet",
  ACCOUNT_NOT_FOUND: "errors.accountNotFound",
  CURRENT_PASSWORD_WRONG: "errors.currentPasswordWrong",
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code && BY_CODE[error.code]) {
      return t(BY_CODE[error.code], { seconds: error.retryAfter ?? 60 });
    }
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
