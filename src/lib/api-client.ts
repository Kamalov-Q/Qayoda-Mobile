// src/lib/api-client.ts
import { API_URL } from "./env";
import { secureSession } from "./secure-session";
import { useAuthStore } from "../features/auth/store/auth.store";
import { deviceId } from "./device-id";

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

/** Nest's error envelope. `message` is an array when class-validator produced
 *  it — one entry per failing field. */
interface ErrorBody {
  message?: string | string[];
  code?: string;
  retryAfter?: number;
}

/**
 * A failed Response, as an ApiError. Exported because the multipart uploads
 * cannot go through `api()` — their bodies are FormData, which JSON.stringify
 * would destroy — and they must still fail in the shape errorMessage() reads.
 */
export async function errorFromResponse(
  res: Response,
  fallback = "Request failed",
): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as ErrorBody;
  const message = Array.isArray(body.message) ? body.message[0] : body.message;

  // 413 is the one status that does not always reach us as JSON: the proxy in
  // front of the API rejects an oversized body itself, with an HTML page, so
  // there is no message to read. Given a code, the app can still say what
  // actually happened instead of "request failed".
  const code =
    typeof body.code === "string"
      ? body.code
      : res.status === 413
        ? "FILE_TOO_LARGE"
        : undefined;

  return new ApiError(
    res.status,
    message ?? fallback,
    code,
    typeof body.retryAfter === "number" ? body.retryAfter : undefined,
  );
}

/**
 * Sends, and on a 401 refreshes the session and sends again — the same retry
 * `api()` does for JSON requests. `send` is called afresh each time because a
 * FormData body cannot be replayed once consumed.
 */
export async function sendWithAuthRetry(
  send: () => Promise<Response>,
): Promise<Response> {
  const res = await send();
  if (res.status !== 401) return res;

  if (!(await refreshSession())) throw new ApiError(401, "Session expired");
  return send();
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

/**
 * Without a bound, a request to a server that has gone dark hangs until the
 * OS gives up — about a minute on iOS — with every spinner in the app stuck
 * for that long. A timeout is surfaced as a TypeError, the same shape fetch
 * uses for "never reached the server", so errorMessage() shows the network
 * message and retry loops (Telegram polling) treat it as a transient blip.
 */
const REQUEST_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  // A caller that brings its own signal owns cancellation; don't second-guess it.
  if (init.signal) return fetch(url, init);

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: abort.signal });
  } catch (e) {
    if (abort.signal.aborted) throw new TypeError("Network request timed out");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

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
      // Identifies the installation, not the person: it is what lets a
      // signed-out visitor be counted once rather than once per page open.
      ...(deviceId() ? { "X-Device-Id": deviceId()! } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  let res = await fetchWithTimeout(`${API_URL}${path}`, buildInit());

  if (res.status === 401 && auth) {
    const refreshed = await refreshSession();
    if (!refreshed) throw new ApiError(401, "Session expired");
    res = await fetchWithTimeout(`${API_URL}${path}`, buildInit());
  }

  if (!res.ok) throw await errorFromResponse(res);

  // 204 (logout) and any other empty reply: res.json() would throw on "".
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
