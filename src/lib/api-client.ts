// src/lib/api-client.ts
import { API_URL } from "./env";
import { secureSession } from "./secure-session";
import { useAuthStore } from "../features/auth/store/auth.store";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** The server's machine-readable `code` (OTP_INVALID, …), when it sent one. */
    public code?: string,
    /** Seconds to wait, on 429s that say so. */
    public retryAfter?: number,
  ) {
    super(message);
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean; // default true
}

// ---- Single-flight refresh ----------------------------------------------
// If N requests hit 401 simultaneously, exactly ONE refresh call fires and
// the rest await it. Load-bearing: the backend rotates refresh tokens and
// revokes the family on reuse — parallel refreshes would log the user out.
let refreshPromise: Promise<boolean> | null = null;

// Cold start awaits this refresh before the first screen paints, so an
// unreachable API used to hold the app on a blank boot screen for as long as
// the platform's default socket timeout (a minute on iOS, longer if the
// connection half-opens). Bounded here instead: a device that can't reach the
// server drops to the login screen quickly rather than appearing to hang.
const REFRESH_TIMEOUT_MS = 8000;

async function doRefresh(): Promise<boolean> {
  const refreshToken = await secureSession.getRefreshToken();
  if (!refreshToken) return false;

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REFRESH_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      signal: abort.signal,
    });
    // A server that answers and rejects the token means the session really is
    // over — the token is dead server-side, so drop it.
    if (!res.ok) {
      await secureSession.clear();
      useAuthStore.getState().clear();
      return false;
    }

    const data = await res.json();
    await secureSession.saveRefreshToken(data.refreshToken); // rotation — persist the NEW token, always
    useAuthStore.getState().setSession(data.accessToken, data.user);
    return true;
  } catch {
    // Never got an answer (offline, timed out, bad host): the refresh token is
    // most likely still valid, so it stays on the device and the next cold
    // start retries. Clearing it here would turn a dropped signal into a real
    // re-login.
    useAuthStore.getState().setUnauthenticated();
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function refreshSession(): Promise<boolean> {
  refreshPromise ??= doRefresh().finally(() => (refreshPromise = null));
  return refreshPromise;
}
// --------------------------------------------------------------------------

export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, auth = true, headers, ...rest } = options;

  const buildInit = (): RequestInit => ({
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(auth && useAuthStore.getState().accessToken
        ? { Authorization: `Bearer ${useAuthStore.getState().accessToken}` }
        : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  

  let res = await fetch(`${API_URL}${path}`, buildInit());

  if (res.status === 401 && auth) {
    const refreshed = await refreshSession();
    if (!refreshed) throw new ApiError(401, "Session expired");
    res = await fetch(`${API_URL}${path}`, buildInit());
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      Array.isArray(err.message)
        ? err.message[0]
        : (err.message ?? "Request failed"),
      typeof err.code === "string" ? err.code : undefined,
      typeof err.retryAfter === "number" ? err.retryAfter : undefined,
    );
  }

  // 204 (logout) and any other empty reply: res.json() would throw on "".
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
