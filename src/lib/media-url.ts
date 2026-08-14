import { API_URL } from "./env";

// Anything that already carries a scheme is final: http(s) from the CDN, but
// also file:, content:, data: and blob: URIs, which is what the image picker
// hands back. Prefixing one of those with the API origin produced a broken
// source, so the check is "has a scheme", not "starts with http".
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Turns an API-relative media path into a loadable URL; passes URIs through. */
export function resolveMediaUrl(
  url: string | null | undefined,
): string | undefined {
  if (!url) return undefined;
  if (HAS_SCHEME.test(url)) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}
