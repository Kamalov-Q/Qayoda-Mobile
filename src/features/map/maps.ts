// src/features/map/maps.ts
// Map config plus the one place [lng, lat] ⇄ {latitude, longitude} is crossed.
//
// The app speaks GeoJSON everywhere — the API stores and returns [lng, lat]
// rings — while react-native-maps speaks {latitude, longitude}. Convert only at
// the edge of a map component; nothing outside src/features/map should ever
// hold a LatLng.
import { Platform } from "react-native";
import type { LatLng, Region } from "react-native-maps";
import { BBox } from "../listings/api/listings.api";
import { DEFAULT_BBOX } from "../listings/utils/geo";

/**
 * react-native-maps ships inside Expo Go, so unlike the old Mapbox setup a dev
 * build is no longer required to draw. Web is the only remaining gap: the
 * package's web entry is react-native-web's UnimplementedView, so map screens
 * still need a fallback there.
 */
export const isNativeMapAvailable = Platform.OS !== "web";

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

/** Palette colours are opaque hex; overlays need them translucent. */
export function withAlpha(hex: string, alpha: number): string {
  const int = parseInt(hex.slice(1), 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
