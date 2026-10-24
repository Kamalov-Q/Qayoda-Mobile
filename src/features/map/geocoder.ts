// src/features/map/geocoder.ts
// Address ⇄ coordinates, over Yandex's Geocoder HTTP API.
//
// Not through MapKit. The SDK can geocode, but only in its "full" flavour,
// which Yandex ties to the paid Advanced licence — and the HTTP Geocoder is a
// separate product with its own free plan and its own key. So the app ships on
// "lite" (see app.config.ts) and asks over HTTPS instead.
//
// EXPO_PUBLIC_YANDEX_GEOCODER_API_KEY is a different key from the MapKit one.
// They are not interchangeable and they do not share a quota.
import type { LatLng } from "./maps";

const ENDPOINT = "https://geocode-maps.yandex.ru/v1/";

const API_KEY = process.env.EXPO_PUBLIC_YANDEX_GEOCODER_API_KEY;

/** Nothing on screen should wait longer than this for a place name. */
const TIMEOUT_MS = 8000;

/**
 * Yandex answers in the app's language when asked, and the geocoder only
 * accepts a handful of tags — so uz falls back to ru rather than being sent
 * through as something the API will reject.
 */
const GEOCODER_LANG: Record<string, string> = {
  ru: "ru_RU",
  en: "en_US",
  uz: "ru_RU",
};

interface GeoObject {
  Point?: { pos?: string };
  metaDataProperty?: {
    GeocoderMetaData?: {
      text?: string;
      Address?: { formatted?: string };
    };
  };
}

interface GeocoderResponse {
  response?: {
    GeoObjectCollection?: {
      featureMember?: { GeoObject?: GeoObject }[];
    };
  };
}

/**
 * `pos` is documented as "longitude latitude" — the GeoJSON order, not the
 * {latitude, longitude} order everything downstream of this file uses. One of
 * Yandex's own samples prints it the other way round, which is worth knowing
 * about the first time a search lands in the wrong hemisphere.
 */
function parsePos(pos: string | undefined): LatLng | null {
  if (!pos) return null;
  const [longitude, latitude] = pos.trim().split(/\s+/).map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/**
 * One request, or null.
 *
 * Never throws: a geocoder that is unreachable, rate-limited, unconfigured or
 * simply unsure is the same "no result" to every caller — all of them are
 * decorating a map, and none has anything better to show for an error.
 */
async function request(
  geocode: string,
  lang: string,
  extra?: Record<string, string>,
): Promise<GeoObject | null> {
  if (!API_KEY) return null;

  const params = new URLSearchParams({
    apikey: API_KEY,
    geocode,
    format: "json",
    results: "1",
    lang: GEOCODER_LANG[lang] ?? GEOCODER_LANG.ru,
    ...extra,
  });

  // RN's fetch has no timeout of its own, and a request left hanging holds a
  // spinner on the search bar for as long as the socket stays open.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${ENDPOINT}?${params}`, { signal: abort.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as GeocoderResponse;
    return (
      body.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject ?? null
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Address → coordinates, for moving a camera somewhere by name. */
export async function geocodeAddress(
  query: string,
  lang: string,
): Promise<LatLng | null> {
  const q = query.trim();
  if (!q) return null;
  return parsePos((await request(q, lang))?.Point?.pos);
}

/**
 * Coordinates → a one-line address.
 *
 * `kind=house` asks for the building rather than the district: a dot on a map
 * wants "Navoiy ko'chasi 12", and answering it with "Toshkent" is a line that
 * tells the reader nothing they could not already see.
 */
export async function reverseGeocode(
  { latitude, longitude }: LatLng,
  lang: string,
): Promise<string | null> {
  // [lng, lat], comma-separated — the one place this file writes a coordinate
  // in the API's order rather than the app's.
  const object = await request(`${longitude},${latitude}`, lang, {
    kind: "house",
  });
  const meta = object?.metaDataProperty?.GeocoderMetaData;
  // `formatted` leaves off the country, which is noise in an app that only
  // operates in one; `text` is the fallback when it is missing.
  return meta?.Address?.formatted ?? meta?.text ?? null;
}

/** Whether address lookup is configured at all — the key is optional at
 *  build time, so screens can hide a search box that could never answer. */
export const isGeocoderConfigured = !!API_KEY;
