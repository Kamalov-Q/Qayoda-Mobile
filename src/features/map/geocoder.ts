// src/features/map/geocoder.ts
// Address → coordinates, over OpenStreetMap's Nominatim.
//
// The same service and the same rules as the admin dashboard
// (admin/src/lib/geosearch.ts), so the two halves of the product agree about
// where a place is. No key, no quota meter, and — unlike the licence this
// replaced — results may be stored and derived from.
//
// The usage policy this file is built around:
//   · at most one request a second, and never one per keystroke; every
//     caller here is submit-driven (see MapSearchBar)
//   · the credit below stays visible wherever results are shown
//
// The public instance is for light use. A self-hosted Nominatim or Photon on
// the Uzbekistan extract is one ENDPOINT away, and nothing above this file
// would change.
import type { LatLng } from "./maps";

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const REVERSE_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

/** Required by ODbL wherever a result is shown. */
export const GEOCODER_CREDIT = "OpenStreetMap / Nominatim";

/** Nothing on screen should wait longer than this for a place name. */
const TIMEOUT_MS = 8000;

/**
 * Nominatim takes a plain language tag and falls back on its own; `uz` is
 * answered thinly for Uzbekistan, so Russian rides along behind it.
 */
const LANG: Record<string, string> = {
  ru: "ru,uz",
  en: "en,ru",
  uz: "uz,ru",
};

/**
 * Words that describe what a place IS rather than name it.
 *
 * Nominatim matches on names, so these actively hurt: "Bodomzor" finds the
 * metro station, "Bodomzor metro" finds nothing at all.
 */
const FILLER =
  /^(metro|metrosi|bekat|bekati|stansiya|stansiyasi|станция|метро|ст)$/i;

const clean = (query: string) =>
  query
    .split(/\s+/)
    .filter((word) => word && !FILLER.test(word))
    .join(" ")
    .trim();

interface NominatimResult {
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
}

/**
 * One request, or null.
 *
 * Never throws: a geocoder that is unreachable, rate-limited or simply
 * unsure is the same "no result" to every caller — all of them are
 * decorating a map, and none has anything better to show for an error.
 */
async function ask(
  url: string,
  params: Record<string, string>,
  lang: string,
): Promise<NominatimResult | NominatimResult[] | null> {
  const search = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    "accept-language": LANG[lang] ?? LANG.ru,
    ...params,
  });

  // RN's fetch has no timeout of its own, and a request left hanging holds a
  // spinner on the search bar for as long as the socket stays open.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${url}?${search}`, { signal: abort.signal });
    if (!res.ok) return null;
    return (await res.json()) as NominatimResult | NominatimResult[];
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function toLatLng(hit: NominatimResult | undefined): LatLng | null {
  if (!hit) return null;
  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/** Address → coordinates, for moving a camera somewhere by name. */
export async function geocodeAddress(
  query: string,
  lang: string,
): Promise<LatLng | null> {
  const q = clean(query);
  if (!q) return null;
  // Everything this app lists is in one country, and the filter removes a
  // whole class of same-name matches abroad.
  const body = await ask(ENDPOINT, { q, countrycodes: "uz" }, lang);
  return toLatLng(Array.isArray(body) ? body[0] : undefined);
}

/**
 * Coordinates → a one-line address.
 *
 * `zoom=18` asks for the building rather than the district: a dot on a map
 * wants "Navoiy ko'chasi 12", and answering it with "Toshkent" is a line
 * that tells the reader nothing they could not already see.
 */
export async function reverseGeocode(
  { latitude, longitude }: LatLng,
  lang: string,
): Promise<string | null> {
  const body = await ask(
    REVERSE_ENDPOINT,
    { lat: String(latitude), lon: String(longitude), zoom: "18" },
    lang,
  );
  const hit = Array.isArray(body) ? body[0] : body;
  return hit?.display_name ?? hit?.name ?? null;
}

/**
 * Whether address lookup is available at all.
 *
 * Always true now — Nominatim needs no key, where the service this replaced
 * was switched off entirely without one. Kept so the screens that hide a
 * search box they cannot answer keep compiling, and so there is one place to
 * turn it off if a self-hosted instance is ever behind a flag.
 */
export const isGeocoderConfigured = true;
