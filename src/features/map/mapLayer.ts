// src/features/map/mapLayer.ts — what every map draws.
//
// One constant, where this used to be a street/satellite toggle. Satellite
// is OFF, and the reason is worth keeping because both ways back are shut:
//
//   1. MapKit's own `satellite` / `hybrid` types 403 on the free licence —
//        TileLoaderImpl::load: Couldn't load tile [sat, …] Forbidden.
//        Body: Access denied.
//      Yandex quotes imagery per customer on an Advanced licence, and their
//      FAQ says satellite is excluded from paid tiers anyway because the
//      pictures are licensed from third parties.
//
//   2. The fallback — Esri World Imagery through MapKit's <UrlTile>, which
//      is what this app used under MapLibre — cannot render either.
//      expo-yandex-mapkit hardcodes `TileFormat.PNG` in applyTileOverlay
//      with no way to override it, and Esri serves image/jpeg. MapKit is
//      handed JPEG bytes and told to decode PNG, so the layer draws nothing
//      and the map shows its empty-tile grid.
//
// Re-enabling means fixing one of those: buy imagery from Yandex and set
// "hybrid" here, or get a `format` option into the library (upstream, or
// patch-package) and restore the Esri tile layer. Until then a toggle that
// switches to a blank grid is worse than no toggle, so the button is gone
// too — see git history for SatelliteTiles.tsx and MapLayerButton.tsx.
import type { YandexMapViewProps } from "expo-yandex-mapkit";

/** What every <YandexMapView mapType> passes. */
export const MAP_TYPE: NonNullable<YandexMapViewProps["mapType"]> = "vector";
