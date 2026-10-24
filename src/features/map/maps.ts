// src/features/map/maps.ts
// Map config plus the one place [lng, lat] ⇄ {latitude, longitude} is crossed.
//
// The app speaks GeoJSON everywhere — the API stores and returns [lng, lat]
// rings — while the map components below reason in {latitude, longitude} and
// in Regions (a centre plus spans). Convert only at the edge of a map
// component; nothing outside src/features/map should ever hold a LatLng.
import { useState } from "react";
import { Dimensions, PixelRatio, Platform } from "react-native";
import type {
  CameraPosition,
  VisibleRegion,
  YandexMapViewRef,
} from "expo-yandex-mapkit";
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
 * Yandex MapKit is a native module, so maps need a development build (Expo Go
 * does not ship it). Web has no native map at all — expo-yandex-mapkit renders
 * nothing there — so map screens keep their fallbacks.
 */
export const isNativeMapAvailable = Platform.OS !== "web";

/**
 * MAP_LOGO_RULE — MapKit draws the Yandex logo on every map and there is no
 * way to switch it off; the licence requires it to stay visible. So no map
 * here passes anything that would cover it, and floating controls are placed
 * clear of whichever corner `logoPosition` parks it in. Nothing replaces the
 * old ⓘ attribution button: Yandex's own logo carries the credit now.
 */

/**
 * MAP_STYLE_RULE — never put view-level props (pointerEvents, opacity,
 * transform, …) on a <YandexMapView>; put them on a wrapping <View>. Native
 * map views keep state the React props diff does not see, and a wrapper is
 * the one place a value like pointerEvents is guaranteed to be undone.
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
 * Whether a GeoJSON ring is safe to draw. A <Polygon> needs three points to
 * be a polygon at all, and rings come off the API rather than from anything
 * this app controls — so they are checked rather than trusted. Two points
 * reach the renderer as a degenerate shape that draws as nothing and takes
 * taps anyway.
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

// ─── MapKit edge ─────────────────────────────────────────────
// The components keep the Region vocabulary they were written in; this is
// the only place it is translated into what MapKit takes.
//
// MapKit's `Point` is
// {latitude, longitude}, which is LatLng — so toLatLng and ringToLatLngs,
// written years ago for a different renderer, are already what a <Marker>
// and a <Polygon> want.

/**
 * MapKit sizes the world at 256·2^zoom px — the Google convention, one whole
 * step from the 512 scale TILE_SIZE reports on.
 *
 * Keep the two apart. TILE_SIZE is what the BACKEND is told, and its
 * points-vs-polygons thresholds were tuned against those numbers; this is
 * what the CAMERA is told. Crossing them puts the map a zoom level away from
 * where it was asked to go, in opposite directions on the two paths.
 */
const MAPKIT_TILE_SIZE = 256;

/** Past these MapKit clamps anyway; stopping here keeps the arithmetic sane. */
const MIN_CAMERA_ZOOM = 2;
const MAX_CAMERA_ZOOM = 21;

/**
 * A region as a camera position: same centre, and the zoom at which its
 * longitude span fills the screen.
 *
 * The window is measured on every call rather than once at module load — a
 * width captured at import is taken before the first rotation and stays
 * wrong for the rest of the session.
 */
export function regionToCamera(region: Region): CameraPosition {
  const { width } = Dimensions.get("window");
  const zoom = Math.log2(
    (360 * width) / (MAPKIT_TILE_SIZE * region.longitudeDelta),
  );
  return {
    latitude: region.latitude,
    longitude: region.longitude,
    zoom: Math.min(MAX_CAMERA_ZOOM, Math.max(MIN_CAMERA_ZOOM, zoom)),
  };
}

/**
 * Logo padding, in the units each platform actually wants.
 *
 * MapKit takes this as PIXELS on Android (com.yandex.mapkit.logo.Padding) but
 * as POINTS on iOS (YMKLogoPadding), while React Native's own spacing is in
 * points on both. Handing the same number to each leaves the Android logo at
 * roughly a third of the intended offset — which is to say still in the
 * corner, underneath whatever the screen floats there.
 *
 * Everything in the app passes spacing tokens, so the conversion lives here
 * rather than at five call sites that would each have to remember it.
 */
export function logoPadding(
  horizontal: number,
  vertical: number,
): { horizontal: number; vertical: number } {
  const scale = Platform.OS === "android" ? PixelRatio.get() : 1;
  return {
    horizontal: Math.round(horizontal * scale),
    vertical: Math.round(vertical * scale),
  };
}

/**
 * What the map is actually showing, as a Region.
 *
 * Read from getVisibleRegion() rather than from the camera event, and NOT via
 * the library's `onRegionChangeComplete` prop, which looks like exactly this
 * and is unusable: it reads `event.nativeEvent.cameraPosition` inside the
 * promise callback of its own getVisibleRegion() call, by which point React
 * has recycled the synthetic event and nativeEvent is null. It throws
 * "Cannot read property 'cameraPosition' of null" on most settles and
 * reports the region on the rest, which is worse than never working.
 *
 * Four corners rather than two: the camera can be rotated, so the visible
 * region is a quadrilateral and its bounding box is what the viewport query
 * wants.
 */
export function visibleRegionToRegion(v: VisibleRegion): Region {
  const lats = [
    v.topLeft.latitude,
    v.topRight.latitude,
    v.bottomLeft.latitude,
    v.bottomRight.latitude,
  ];
  const lngs = [
    v.topLeft.longitude,
    v.topRight.longitude,
    v.bottomLeft.longitude,
    v.bottomRight.longitude,
  ];
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);
  return {
    latitude: (south + north) / 2,
    longitude: (west + east) / 2,
    latitudeDelta: north - south,
    longitudeDelta: east - west,
  };
}

/**
 * A region as the camera a map OPENS on, computed once and never again.
 *
 * `cameraPosition` is a CONTROLLED prop, and that is the trap: the native
 * side records any new value as pending and, unless the camera already
 * happens to be there, moves to it. So a component that rebuilds this
 * object on render yanks the camera back to the opening frame every time
 * anything changes — a vertex added, a pin dropped, a card opened — and the
 * reader cannot pan anywhere and stay there.
 *
 * Returning the SAME object for the life of the component is what makes the
 * prop mean "where to start" instead of "where to be". Deliberately ignores
 * later changes to `region`: a map that must move after mount asks the ref,
 * through animateToRegion.
 */
export function useInitialCamera(region: Region): CameraPosition {
  // useState's lazy initialiser, not useMemo: useMemo is a performance hint
  // that React is allowed to discard and recompute, which here would be a
  // camera jump rather than a slow frame.
  const [camera] = useState(() => regionToCamera(region));
  return camera;
}

/**
 * The old animateToRegion: frame exactly this region, animated. A zero
 * duration is a jump.
 *
 * Fire-and-forget. setCenter resolves when the camera settles and rejects
 * when another move interrupts it — which is ordinary here (a locate tap
 * landing mid-zoom), not a failure anyone can act on.
 */
export function animateToRegion(
  map: YandexMapViewRef | null | undefined,
  region: Region,
  duration: number,
): void {
  map
    ?.setCenter(regionToCamera(region), { durationSeconds: duration / 1000 })
    .catch(() => {});
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
