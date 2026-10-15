// src/features/map/PolygonEditor.maplibre.tsx
// Tap-to-add-vertex drawing — controlled component: value + onChange, GeoJSON
// [lng, lat]. The ring is kept open while drawing; Polygon closes it visually
// and closeRing() closes it for real on save.
import { memo, useCallback, useMemo, useRef } from "react";
import { View, Text, type NativeSyntheticEvent } from "react-native";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  NativeUserLocation,
  ViewAnnotation,
  type CameraRef,
  type PressEvent,
  type ViewAnnotationEvent,
} from "@maplibre/maplibre-react-native";
import { Button } from "../../components/ui";
import { toast } from "../../components/ui/Toast";
import { spacing, radii, sizing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import { insertionIndexFor, ringSelfIntersects } from "../listings/utils/geo";
import {
  DEFAULT_CENTER,
  MAP_STYLE_URL,
  animateToRegion,
  parcelRegion,
  regionToBounds,
  ringFeature,
  searchResultRegion,
  withAlpha,
} from "./maps";
import { MapSearchBar } from "./MapSearchBar";
import { MyLocationButton } from "./MyLocationButton";
import { useGeocode, useMyLocation } from "../listings/hooks/useMyLocation";

interface Props {
  value: [number, number][]; // open ring while drawing; closed on save
  onChange: (points: [number, number][]) => void;
  /** Camera target on mount — the first vertex when re-editing. */
  center?: [number, number];
}

export const PolygonEditor = memo(function PolygonEditor({
  value,
  onChange,
  center,
}: Props) {
  const { colors } = useTheme();
  const t = useT();
  const cameraRef = useRef<CameraRef>(null);
  const { locate, loading: locating } = useMyLocation();
  const { search, loading: searching } = useGeocode();

  const invalid = ringSelfIntersects(value);

  // Google Maps delivers the map press as well as the marker press when a
  // vertex is tapped, so deleting one immediately re-added it in the same
  // spot and tapping a point looked like it did nothing at all.
  const vertexPressedAt = useRef(0);

  // A tap is placed where it keeps the boundary simple rather than always at
  // the end of the ring. Tracing in order still just appends; a point that
  // would cross the shape goes into the edge it belongs to instead.
  const addVertex = (e: NativeSyntheticEvent<PressEvent>) => {
    if (Date.now() - vertexPressedAt.current < 400) return;

    const point = e.nativeEvent.lngLat;
    const index = insertionIndexFor(value, point);

    if (index === null) {
      toast.errorKey("map.pointBlocked");
      return;
    }

    const next = [...value];
    next.splice(index, 0, point);
    onChange(next);
  };

  // Dropping a vertex across the shape is the other way to invalidate it, and
  // there is nothing sensible to do but put it back where it was.
  const moveVertex = (
    index: number,
    e: NativeSyntheticEvent<ViewAnnotationEvent>,
  ) => {
    const next = value.map((p, i) => (i === index ? e.nativeEvent.lngLat : p));

    if (ringSelfIntersects(next)) {
      toast.errorKey("map.pointBlocked");
      // The marker is memoised on its point and has already moved itself
      // natively, so putting the ring back is not enough — the dragged vertex
      // needs a fresh tuple to re-render and snap home.
      onChange(
        value.map((p, i) => (i === index ? ([...p] as [number, number]) : p)),
      );
      return;
    }
    onChange(next);
  };

  const removeVertex = (index: number) => {
    vertexPressedAt.current = Date.now();
    onChange(value.filter((_, i) => i !== index));
  };

  /**
   * Most people draw the boundary of the place they are standing in, and the
   * editor opened on Tashkent's centre — so every one of them started by
   * panning across the city. This drops the camera on them at parcel zoom,
   * close enough that the first tap lands on the right roof.
   *
   * Camera only: it never adds a vertex. Where you stand is rarely a corner,
   * and an unasked-for point in the ring is worse than no point at all.
   */
  /**
   * The other way to reach the right place: people listing a flat they do not
   * live in had only pinch-and-drag from Tashkent's centre, which is a long
   * way to travel by thumb.
   *
   * Camera only, like the locate button — a geocoded point is accurate to a
   * building at best, and dropping a vertex on it would be a guess presented
   * as the user's own work.
   */
  const goToSearchResult = useCallback(
    async (query: string) => {
      const pos = await search(query);
      if (!pos) return;
      animateToRegion(
        cameraRef.current,
        searchResultRegion([pos.longitude, pos.latitude]),
        600,
      );
    },
    [search],
  );

  const goToMyLocation = useCallback(async () => {
    const pos = await locate();
    if (!pos) return;
    animateToRegion(
      cameraRef.current,
      parcelRegion([pos.longitude, pos.latitude]),
      600,
    );
  }, [locate]);

  // Drawn from `value` alone. Two vertices is a segment, not yet a shape;
  // three or more close into the polygon here, while `value` itself stays
  // open all the way to save.
  const shape = useMemo<GeoJSON.Feature | null>(() => {
    if (value.length === 2) {
      return {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: value },
      };
    }
    if (value.length >= 3) return ringFeature(value);
    return null;
  }, [value]);

  const fillColor = withAlpha(invalid ? colors.danger : colors.primary, 0.3);
  const strokeColor = invalid ? colors.danger : colors.primary;

  return (
    <View style={{ flex: 1 }}>
      <MapLibreMap
        style={{ flex: 1 }}
        mapStyle={MAP_STYLE_URL}
        logo={false}
        compass={false}
        onPress={addVertex}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            bounds: regionToBounds(parcelRegion(center ?? DEFAULT_CENTER)),
          }}
        />
        {/* The blue dot is the whole point of the locate control — without it
            the camera moves and nothing on screen says where "here" is. */}
        <NativeUserLocation />

        {/* No onPress on the source: a tap inside the shape still lands on the
            map and adds a point, as before. */}
        {shape ? (
          <GeoJSONSource id="editor-shape" data={shape}>
            {/* Keyed, and they must stay keyed.

                GeoJSONSource clones its children through
                cloneReactChildrenWithProps, which drops the falsy ones — so
                when the fill appears at the third vertex the array shifts
                from [line] to [fill, line]. Without keys React matches by
                position, sees Layer at index 0 both times, reuses that
                instance and swaps `id` from editor-line to editor-fill —
                and Layer freezes its id with useFrozenId, which throws
                "`id` cannot be changed" and takes the screen down. */}
            {value.length >= 3 ? (
              <Layer
                key="editor-fill"
                id="editor-fill"
                type="fill"
                paint={{ "fill-color": fillColor }}
              />
            ) : null}
            <Layer
              key="editor-line"
              id="editor-line"
              type="line"
              paint={{ "line-color": strokeColor, "line-width": 2 }}
            />
          </GeoJSONSource>
        ) : null}

        {value.map((point, index) => (
          <VertexMarker
            key={`v${index}`}
            id={`v${index}`}
            point={point}
            onPress={() => removeVertex(index)}
            onDragEnd={(e) => moveVertex(index, e)}
          />
        ))}
      </MapLibreMap>

      {/* box-none so the gap between the two bands stays part of the map —
          a transparent container over the top third would otherwise eat every
          tap aimed at the roofs up there. */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: spacing.md,
          left: spacing.md,
          right: spacing.md,
          gap: spacing.sm,
        }}
      >
        <MapSearchBar onSubmit={goToSearchResult} loading={searching} />

        <View
          style={{
            padding: spacing.sm,
            borderRadius: radii.md,
            backgroundColor: colors.overlay,
          }}
        >
          <Text
            style={{ ...type.caption, color: "#FFFFFF", textAlign: "center" }}
          >
            {t("map.hint")}
          </Text>
        </View>
      </View>

      {/* Clears the undo/clear row: those are full-height Buttons sitting at
          spacing.lg from the bottom. */}
      <MyLocationButton
        onPress={goToMyLocation}
        loading={locating}
        bottomOffset={spacing.lg + sizing.control + spacing.md}
      />

      <View
        style={{
          position: "absolute",
          bottom: spacing.lg,
          left: spacing.lg,
          right: spacing.lg,
          flexDirection: "row",
          gap: spacing.md,
        }}
      >
        <Button
          title={t("map.undo")}
          variant="secondary"
          disabled={value.length === 0}
          onPress={() => onChange(value.slice(0, -1))}
          style={{ flex: 1 }}
        />
        <Button
          title={t("map.clear")}
          variant="secondary"
          disabled={value.length === 0}
          onPress={() => onChange([])}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
});

const VertexMarker = memo(function VertexMarker({
  id,
  point,
  onPress,
  onDragEnd,
}: {
  id: string;
  point: [number, number];
  onPress: () => void;
  onDragEnd: (e: NativeSyntheticEvent<ViewAnnotationEvent>) => void;
}) {
  const { colors } = useTheme();

  return (
    <ViewAnnotation
      id={id}
      lngLat={point}
      anchor="center"
      draggable
      onPress={onPress}
      onDragEnd={onDragEnd}
    >
      {/* The dot is drawn small but the touchable is the whole box — a 14pt
          target is unhittable. */}
      <View
        collapsable={false}
        style={{
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: radii.pill,
            backgroundColor: "#FFFFFF",
            borderWidth: 3,
            borderColor: colors.primary,
          }}
        />
      </View>
    </ViewAnnotation>
  );
});

export default PolygonEditor;
