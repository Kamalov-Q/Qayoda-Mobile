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

// ---------------------------------------------------------------------------
// Ring validity.
//
// PostGIS rejects a self-intersecting ring outright ("Invalid polygon
// geometry: Self-intersection[lng lat]"), and that rejection used to arrive
// only after the listing form was submitted — the drawing was already gone
// from the screen, with nothing to say which of the 26 taps caused it. These
// helpers move the same rule to the moment the point is placed.
//
// The tests run in raw degrees. Crossing is a topological property, so the
// lat/lng anisotropy that matters for area does not affect the answer here.

type Point = [number, number];

/** >0 if c is left of ab, <0 if right, 0 if collinear. */
function cross(a: Point, b: Point, c: Point): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function within(a: Point, b: Point, p: Point): boolean {
  return (
    Math.min(a[0], b[0]) <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= p[1] &&
    p[1] <= Math.max(a[1], b[1])
  );
}

/** Do segments ab and cd share any point? Touching counts. */
export function segmentsIntersect(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }

  // Collinear touches — a vertex landing exactly on another edge is just as
  // invalid to PostGIS as a clean crossing.
  return (
    (d1 === 0 && within(c, d, a)) ||
    (d2 === 0 && within(c, d, b)) ||
    (d3 === 0 && within(a, b, c)) ||
    (d4 === 0 && within(a, b, d))
  );
}

/**
 * True when the closed ring crosses or touches itself. Edges that share a
 * vertex are skipped: they always meet, by construction.
 */
export function ringSelfIntersects(points: Point[]): boolean {
  const n = points.length;
  if (n < 4) return false; // a triangle cannot cross itself

  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];

    for (let j = i + 1; j < n; j++) {
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      if (adjacent) continue;

      if (segmentsIntersect(a, b, points[j], points[(j + 1) % n])) return true;
    }
  }
  return false;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Where to put a new vertex so the ring stays simple.
 *
 * Appending is tried first: while tracing a boundary in order it is both the
 * cheapest insertion and the one the user means, so ordinary drawing is
 * untouched. Only when appending would cross an existing edge does this look
 * for another home for the point — the edge it is nearest to, measured by how
 * much perimeter the split adds — which is what someone filling in a missed
 * corner is actually asking for.
 *
 * Returns the index to splice at, or null when no position keeps the ring
 * simple (the tap has to be refused rather than saved into a broken shape).
 */
export function insertionIndexFor(points: Point[], p: Point): number | null {
  if (points.length < 3) return points.length;

  const appended = [...points, p];
  if (!ringSelfIntersects(appended)) return points.length;

  let best: { index: number; cost: number } | null = null;

  // Splitting edge (i, i+1) means splicing at i+1. The closing edge is the
  // append case, already ruled out above.
  for (let i = 0; i < points.length - 1; i++) {
    const candidate = [...points];
    candidate.splice(i + 1, 0, p);
    if (ringSelfIntersects(candidate)) continue;

    const cost =
      distance(points[i], p) +
      distance(p, points[i + 1]) -
      distance(points[i], points[i + 1]);

    if (!best || cost < best.cost) best = { index: i + 1, cost };
  }

  return best?.index ?? null;
}

/** Consecutive duplicates are noise from a double tap, and PostGIS counts
 *  them as vertices; drop them before the ring is sent. */
export function dedupeRing(points: Point[]): Point[] {
  return points.filter(
    (p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1],
  );
}
