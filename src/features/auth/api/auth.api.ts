// src/features/auth/api/auth.api.ts
import { api } from "../../../lib/api-client";
import { OtpPurpose } from "../store/auth-flow.store";
import { SessionUser } from "../store/auth.store";

export interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export const authApi = {
  requestOtp: (email: string, purpose: OtpPurpose) =>
    api<{ requestId: string; expiresIn: number }>("/auth/otp/request", {
      method: "POST",
      body: { email, purpose },
      auth: false,
    }),

  verifyOtp: (requestId: string, code: string) =>
    api<{ verificationToken: string }>("/auth/otp/verify", {
      method: "POST",
      body: { requestId, code },
      auth: false,
    }),

  register: (
    verificationToken: string,
    name: string,
    surname: string,
    password: string,
  ) =>
    api<SessionResponse>("/auth/register", {
      method: "POST",
      body: { verificationToken, name, surname, password },
      auth: false,
    }),

  loginWithOtp: (verificationToken: string) =>
    api<SessionResponse>("/auth/login/otp", {
      method: "POST",
      body: { verificationToken },
      auth: false,
    }),

  loginWithPassword: (email: string, password: string) =>
    api<SessionResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    }),

  /**
   * Revokes the current session server-side. Takes no argument and no body:
   * the endpoint is access-token guarded, and the access token's `jti` is the
   * refresh-token row for this session, so the server already knows which one
   * to revoke. Sending `{ refreshToken }` with `auth: false` — as this used to
   * — meant no Authorization header, so it always came back 401 and the
   * refresh token stayed valid for its full 30 days.
   */
  logout: () =>
    api<{ success: boolean; message: string }>("/auth/logout", {
      method: "POST",
    }),

  me: () => api<SessionUser>("/auth/me"),
};
