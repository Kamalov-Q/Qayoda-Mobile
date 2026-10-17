// src/features/auth/api/auth.api.ts
import { api } from "../../../lib/api-client";
import { SessionUser } from "../store/auth.store";

export type Lang = "uz" | "ru";
export type AuthProvider = "PHONE" | "TELEGRAM";

/**
 * Which SMS wording the server sends. The code is the same either way — this
 * only decides whether the text reads "sign in" or "reset your password",
 * which is the one clue the reader has that the SMS is the one they asked
 * for. Resends must repeat the purpose, or the second SMS contradicts the
 * first.
 */
export type OtpPurpose = "login" | "reset";

/** Mirror of what `TokenService.issuePair` returns. */
export interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
  /** True when this call created the account — a good moment to ask for a name. */
  isNew?: boolean;
}

export interface TelegramStart {
  /** Poll with this. */
  token: string;
  /** `https://t.me/<bot>?start=<token>` — open it, Telegram does the rest. */
  deepLink: string;
  /** Shown so the user can confirm they opened the right session. */
  shortCode: string;
  expiresIn: number;
}

export type TelegramPoll =
  | { status: "PENDING" }
  | { status: "EXPIRED" }
  | { status: "LINKED" }
  | ({ status: "CONFIRMED" } & SessionResponse);

export interface Identity {
  id: string;
  provider: AuthProvider;
  createdAt: string;
  lastUsedAt: string | null;
}

export const authApi = {
  // ---- phone -------------------------------------------------------------
  requestOtp: (phone: string, lang: Lang, purpose: OtpPurpose = "login") =>
    api<{ sent: true; expiresIn: number }>("/auth/phone/request", {
      method: "POST",
      body: { phone, lang, purpose },
      auth: false,
    }),

  /** `name` is only used when this call creates the account. */
  verifyOtp: (phone: string, code: string, lang: Lang, name?: string) =>
    api<SessionResponse>("/auth/phone/verify", {
      method: "POST",
      body: { phone, code, lang, ...(name ? { name } : {}) },
      auth: false,
    }),

  /** `usePassword: false` covers both "no account" and "no password" — both continue by SMS. */
  checkPhone: (phone: string) =>
    api<{ usePassword: boolean }>("/auth/phone/check", {
      method: "POST",
      body: { phone },
      auth: false,
    }),

  /** Returning-user path — no SMS spent. 401 PASSWORD_NOT_SET → use the OTP flow. */
  phoneLogin: (phone: string, password: string) =>
    api<SessionResponse>("/auth/phone/login", {
      method: "POST",
      body: { phone, password },
      auth: false,
    }),

  /** First-time set after onboarding, or a change (current password proven). */
  setPassword: (password: string, currentPassword?: string) =>
    api<{ set: true }>("/auth/password", {
      method: "POST",
      body: { password, ...(currentPassword ? { currentPassword } : {}) },
    }),

  /** SMS code proves the phone; replaces the password and returns a session. */
  resetPassword: (phone: string, code: string, password: string) =>
    api<SessionResponse>("/auth/password/reset", {
      method: "POST",
      body: { phone, code, password },
      auth: false,
    }),

  // ---- telegram ----------------------------------------------------------
  telegramStart: () =>
    api<TelegramStart>("/auth/telegram/start", {
      method: "POST",
      auth: false,
    }),

  /**
   * Single-use: the call that returns CONFIRMED consumes the session, so the
   * caller must stop polling on anything other than PENDING.
   */
  telegramPoll: (token: string) =>
    api<TelegramPoll>("/auth/telegram/poll", {
      method: "POST",
      body: { token },
      auth: false,
    }),

  // ---- session -----------------------------------------------------------
  /** 204. Revokes every refresh token; the access token lives out its 15 min. */
  logout: () => api<void>("/auth/logout", { method: "POST" }),

  // ---- linking (all need a session) --------------------------------------
  identities: () => api<Identity[]>("/auth/identities"),

  /**
   * Adds a phone to the account already holding the session — the way a
   * Telegram or Google user gets a verified number without a second account.
   * Same SMS budget as the sign-in flow; only the verify differs.
   */
  linkPhoneRequest: (phone: string, lang: Lang) =>
    api<{ sent: true; expiresIn: number }>("/auth/link/phone/request", {
      method: "POST",
      body: { phone, lang },
    }),

  linkPhoneVerify: (phone: string, code: string) =>
    api<Identity>("/auth/link/phone/verify", {
      method: "POST",
      body: { phone, code },
    }),


  /** Same shape as telegramStart; poll resolves to LINKED instead of a session. */
  linkTelegram: () =>
    api<TelegramStart>("/auth/link/telegram", { method: "POST" }),

  unlink: (provider: AuthProvider) =>
    api<{ unlinked: true }>(`/auth/link/${provider}`, { method: "DELETE" }),
};
