// src/features/map/maps.ts
// Map config plus the one place [lng, lat] ⇄ {latitude, longitude} is crossed.
//
// The app speaks GeoJSON everywhere — the API stores and returns [lng, lat]
// rings — while the map components below reason in {latitude, longitude} and
// in Regions (a centre plus spans). Convert only at the edge of a map
// component; nothing outside src/features/map should ever hold a LatLng.
import { Platform } from "react-native";
import type { CameraRef, LngLatBounds, ViewState } from "@maplibre/maplibre-react-native";
import { BBox } from "../listings/api/listings.api";
import { DEFAULT_BBOX } from "../listings/utils/geo";

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** A centre and the spans around it — what every camera move here is written in. */
export interface Region extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * MapLibre is a native module, so maps need a development build (Expo Go does
 * not ship it). Web has no native map at all, so map screens keep their
 * fallbacks there.
 */
export const isNativeMapAvailable = Platform.OS !== "web";

/**
 * The street map every map in the app draws: OpenFreeMap's vector tiles of
 * OpenStreetMap data — free, no key, the same stack 1Fit runs on. Its credits
 * (OpenFreeMap, OpenMapTiles, OpenStreetMap) sit behind the map's ⓘ button,
 * which the licences require to stay visible: never pass attribution={false}.
 */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/**
 * MAP_STYLE_RULE — never put view-level props (pointerEvents, opacity,
 * transform, …) on a <Map>; put them on a wrapping <View>. Native map views
 * keep state the React props diff does not see, and a wrapper is the one
 * place a value like pointerEvents is guaranteed to be undone.
 */


/** Tashkent centre — camera default until the user's location is wired up. */
export const DEFAULT_CENTER: [number, number] = [69.28, 41.32];

/** Roughly one city block across — the span a parcel is drawn at. */
const PARCEL_SPAN_DEG = 0.002;
const SEARCH_SPAN_DEG = 0.008;

/**
 * Mapbox GL sizes the world at 512·2^zoom px, Google at 256·2^zoom, so Google's
 * camera zoom for a given span is exactly one step higher. The backend's
 * points-vs-polygons LOD thresholds were tuned against the numbers Mapbox
 * reported, so keep reporting on the 512 scale and the thresholds keep meaning
 * what they did.
 */
const TILE_SIZE = 512;

export const toLatLng = ([longitude, latitude]: [number, number]): LatLng => ({
  latitude,
  longitude,
});

export const toPosition = ({ latitude, longitude }: LatLng): [number, number] => [
  longitude,
  latitude,
];

export const ringToLatLngs = (ring: [number, number][]): LatLng[] =>
  ring.map(toLatLng);

/**
 * Whether a GeoJSON ring is safe to hand MapKit. AIRMapPolygon copies the ring
 * straight into a stack array sized from its length and builds an MKPolygon
 * with no validation, so a missing or under-length ring reaches the renderer
 * and faults there — on the next draw, which is to say the next zoom, not at
 * the point the bad data arrived. Rings come off the API, so they are checked
 * rather than trusted.
 */
export const isDrawableRing = (
  ring: [number, number][] | undefined,
): ring is [number, number][] => Array.isArray(ring) && ring.length >= 3;

export function bboxToRegion(bbox: BBox): Region {
  return {
    latitude: (bbox.south + bbox.north) / 2,
    longitude: (bbox.west + bbox.east) / 2,
    latitudeDelta: bbox.north - bbox.south,
    longitudeDelta: bbox.east - bbox.west,
  };
}

export const DEFAULT_REGION = bboxToRegion(DEFAULT_BBOX);

function regionAround(center: [number, number], span: number): Region {
  const [longitude, latitude] = center;
  return {
    latitude,
    longitude,
    latitudeDelta: span,
    longitudeDelta: span,
  };
}

/** Camera for drawing/inspecting a single parcel. */
export function parcelRegion(center: [number, number]): Region {
  return regionAround(center, PARCEL_SPAN_DEG);
}

/**
 * Camera for a geocoded search hit — wider than a parcel. The geocoder answers
 * "Navoiy ko'chasi 12" and "Chilonzor" with the same shape of result, and
 * dropping onto the second at drawing zoom lands the user in an anonymous
 * courtyard with no idea which way to pan.
 */
export function searchResultRegion(center: [number, number]): Region {
  return regionAround(center, SEARCH_SPAN_DEG);
}

export function regionToBBox(region: Region): BBox {
  return {
    west: region.longitude - region.longitudeDelta / 2,
    east: region.longitude + region.longitudeDelta / 2,
    south: region.latitude - region.latitudeDelta / 2,
    north: region.latitude + region.latitudeDelta / 2,
  };
}

/** Region carries a span, not a zoom — invert the web-mercator sizing. */
export function regionToZoom(region: Region, viewportWidthPx: number): number {
  return Math.log2(
    (360 * viewportWidthPx) / (TILE_SIZE * region.longitudeDelta),
  );
}

/**
 * What a map hands the viewport query after the camera settles. Reported at
 * tile width, which is the scale the backend's points-vs-polygons thresholds
 * were tuned against, and clamped to the zoom range it accepts.
 */
export function regionToViewport(region: Region): { bbox: BBox; zoom: number } {
  const zoom = Math.round(regionToZoom(region, TILE_SIZE));
  return { bbox: regionToBBox(region), zoom: Math.min(22, Math.max(1, zoom)) };
}

/** Opening camera for the browse map — a few blocks of central Tashkent. */
export const TASHKENT_REGION: Region = {
  latitude: DEFAULT_CENTER[1],
  longitude: DEFAULT_CENTER[0],
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

// ─── MapLibre edge ─────────────────────────────────────────────────────────
// The components keep the Region vocabulary they were written in; these are
// the only places it is translated to MapLibre's [west, south, east, north].

export function regionToBounds(region: Region): LngLatBounds {
  return [
    region.longitude - region.longitudeDelta / 2,
    region.latitude - region.latitudeDelta / 2,
    region.longitude + region.longitudeDelta / 2,
    region.latitude + region.latitudeDelta / 2,
  ];
}

export function boundsToRegion([west, south, east, north]: LngLatBounds): Region {
  return {
    latitude: (south + north) / 2,
    longitude: (west + east) / 2,
    latitudeDelta: north - south,
    longitudeDelta: east - west,
  };
}

/** What the map reports when its camera settles, as the Region it used to be. */
export const viewStateToRegion = (view: Pick<ViewState, "bounds">): Region =>
  boundsToRegion(view.bounds);

/**
 * The old animateToRegion: frame exactly this region, animated. A zero
 * duration is a jump.
 */
export function animateToRegion(
  camera: CameraRef | null | undefined,
  region: Region,
  duration: number,
): void {
  camera?.fitBounds(regionToBounds(region), { duration });
}

/** A ring as a GeoJSON Feature — what a map source draws. */
export function ringFeature(
  ring: [number, number][],
  properties: Record<string, unknown> = {},
  id?: string,
): GeoJSON.Feature<GeoJSON.Polygon> {
  // GeoJSON wants the ring closed; the app keeps it open while drawing.
  const first = ring[0];
  const last = ring[ring.length - 1];
  const closed =
    first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
  return {
    type: "Feature",
    id,
    properties,
    geometry: { type: "Polygon", coordinates: [closed] },
  };
}

/**
 * A circle of `radiusM` metres as a ring — MapLibre has no circle overlay in
 * metres, so it is drawn as a 64-sided polygon. Same latitude correction as
 * radiusRegion below: a degree of longitude is shorter this far north.
 */
export function circleRing(
  [lng, lat]: [number, number],
  radiusM: number,
  steps = 64,
): [number, number][] {
  const dLat = radiusM / M_PER_DEG_LAT;
  const dLng = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const ring: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return ring;
}

/** Palette colours are opaque hex; overlays need them translucent. */
export function withAlpha(hex: string, alpha: number): string {
  const int = parseInt(hex.slice(1), 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Metres per degree of latitude. Longitude shrinks with the cosine of the
 *  latitude; at Tashkent's 41° a degree of longitude is only ~84 km. */
const M_PER_DEG_LAT = 111_320;

/**
 * Camera that fits a search circle with a little air around it, so the whole
 * radius is on screen rather than cropped by the viewport the map also filters
 * by. Square in metres, not in degrees — a region with equal deltas is a tall
 * rectangle this far from the equator.
 */
export function radiusRegion(center: LatLng, radiusM: number): Region {
  const latDelta = (radiusM * 2 * 1.3) / M_PER_DEG_LAT;
  const cos = Math.max(Math.cos((center.latitude * Math.PI) / 180), 0.01);
  return {
    ...center,
    latitudeDelta: latDelta,
    longitudeDelta: latDelta / cos,
  };
}

/** "750 m" / "1,5 km" — a comma decimal, as both uz and ru write it. */
export function formatRadius(
  radiusM: number,
  unitM: string,
  unitKm: string,
): string {
  if (radiusM < 1000) return `${radiusM} ${unitM}`;
  const km = radiusM / 1000;
  const n = Number.isInteger(km) ? String(km) : km.toFixed(1).replace(".", ",");
  return `${n} ${unitKm}`;
}
