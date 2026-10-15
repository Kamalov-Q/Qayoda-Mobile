// The server uses a global /api prefix; append it here so all REST requests
// automatically go to /api/... without changing any individual call site.
// EXPO_PUBLIC_API_URL should be the bare origin, e.g. https://api.growencity.uz
const _base = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
/** Bare server origin — use for sockets and resolving media URLs. */
export const API_ORIGIN = _base.replace(/\/+$/, "");
/** All REST endpoints are prefixed with /api. Use this for API calls. */
export const API_URL = API_ORIGIN + "/api";

