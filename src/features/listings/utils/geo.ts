import { BBox } from "../api/listings.api";

export const DEFAULT_BBOX: BBox = {
  west: 69.15,
  south: 41.22,
  east: 69.42,
  north: 41.42,
};

export const DEFAULT_ZOOM = 13;

/**
 * Amount only. The rent suffix is language-dependent, so it is passed in by
 * the caller (see usePriceFormatter) rather than hard-coded here — this file
 * stays free of UI concerns and usable from non-React code.
 */
export function formatPrice(
  price: string | number,
  currency: string,
  suffix = "",
) {
  const n = Number(price);
  return `$${n.toLocaleString("en-US")}${suffix}`;
}

export function closeRing(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points;
  const [first] = points;
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return points;
  return [...points, first];
}

/** Minimum vertices for a ring the API will accept as a polygon. */
export const MIN_POLYGON_POINTS = 3;

const EARTH_RADIUS_M = 6_378_137;
const DEG = Math.PI / 180;

/**
 * Shoelace area of a ring, on an equirectangular projection anchored to the
 * ring's own mean latitude. At parcel scale the distortion is far below the
 * precision anyone reads off an m² label, and it avoids pulling in turf.
 */
export function polygonAreaM2(points: [number, number][]): number {
  const ring = closeRing(points);
  if (ring.length < 4) return 0;

  const meanLat = ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length;
  const mx = DEG * EARTH_RADIUS_M * Math.cos(meanLat * DEG);
  const my = DEG * EARTH_RADIUS_M;

  let twiceArea = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    twiceArea += lng1 * mx * (lat2 * my) - lng2 * mx * (lat1 * my);
  }
  return Math.abs(twiceArea) / 2;
}

export function formatAreaM2(m2: number): string {
  if (m2 >= 10_000) return `${(m2 / 10_000).toFixed(2)} ga`;
  return `${Math.round(m2).toLocaleString("en-US")} m²`;
}
