// src/lib/api-client.ts
import { API_URL } from "./env";
import { secureSession } from "./secure-session";
import { useAuthStore } from "../features/auth/store/auth.store";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
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

async function doRefresh(): Promise<boolean> {
  const refreshToken = await secureSession.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) throw new Error();

    const data = await res.json();
    await secureSession.saveRefreshToken(data.refreshToken); // rotation — persist the NEW token, always
    useAuthStore.getState().setSession(data.accessToken, data.user);
    return true;
  } catch {
    await secureSession.clear();
    useAuthStore.getState().clear();
    return false;
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
    );
  }

  return res.json();
}
