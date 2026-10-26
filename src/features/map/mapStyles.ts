// src/features/map/mapStyles.ts
// The two maps the app draws — the same pair, from the same sources, as the
// admin dashboard (admin/src/lib/mapStyles.ts), so a moderator checking a
// listing sees exactly what the person who posted it saw.
//
// Both are free and keyless. Their credits are required to stay visible and
// sit behind the map's ⓘ control.
import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";

/** OpenFreeMap's vector street map of OpenStreetMap data. */
export const STREET_STYLE = "https://tiles.openfreemap.org/styles/liberty";

/**
 * Latin where OSM has it, the local name otherwise.
 *
 * Tashkent is labelled in Cyrillic, Latin and Russian depending on who
 * mapped the street, and a map that mixes all three reads as broken. The
 * street style already makes this choice; the satellite one has to make it
 * again because it draws its own labels.
 */
const LABEL_TEXT = ["coalesce", ["get", "name:latin"], ["get", "name"]];

/**
 * Esri's satellite photography with OpenFreeMap's street and place names
 * over it.
 *
 * Imagery alone is close to useless for checking an address — you can see
 * the roof but not which street it is on — so the names go back on top in
 * white with a dark halo, which stays readable over both a bright courtyard
 * and a dark one.
 */
export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
    // Deliberately NOT named "openmaptiles" like the street style's source.
    // MapLibre reuses a source's loaded tiles across a style switch when the
    // name matches, and these tiles are parsed for labels only — sharing the
    // name left the street map with names but no roads or buildings.
    "satellite-labels": {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
    },
  },
  layers: [
    { id: "satellite", type: "raster", source: "esri" },
    {
      id: "road-name",
      type: "symbol",
      source: "satellite-labels",
      "source-layer": "transportation_name",
      // Below this every street in the city would be labelled at once.
      minzoom: 13,
      layout: {
        "symbol-placement": "line",
        "text-field": LABEL_TEXT as never,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 13, 11, 18, 14],
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "rgba(0,0,0,0.75)",
        "text-halo-width": 1.5,
      },
    },
    {
      id: "place-name",
      type: "symbol",
      source: "satellite-labels",
      "source-layer": "place",
      layout: {
        "text-field": LABEL_TEXT as never,
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 12, 16, 15],
        "text-max-width": 8,
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "rgba(0,0,0,0.8)",
        "text-halo-width": 1.5,
      },
    },
  ],
};
