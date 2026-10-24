// src/features/map/PolygonEditor.yandex.tsx
// Tap-to-add-vertex drawing — controlled component: value + onChange, GeoJSON
// [lng, lat]. The ring is kept open while drawing; <Polygon> closes it
// visually and closeRing() closes it for real on save.
import { memo, useCallback, useRef } from "react";
import { View, Text } from "react-native";
import {
  Marker,
  Polygon,
  Polyline,
  YandexMapView,
  type MarkerDragEvent,
  type YandexMapViewRef,
} from "expo-yandex-mapkit";
import { Button } from "../../components/ui";
import { toast } from "../../components/ui/Toast";
import { spacing, radii, sizing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import { insertionIndexFor, ringSelfIntersects } from "../listings/utils/geo";
import {
  DEFAULT_CENTER,
  animateToRegion,
  logoPadding,
  parcelRegion,
  ringToLatLngs,
  useInitialCamera,
  searchResultRegion,
  toLatLng,
  toPosition,
  withAlpha,
} from "./maps";
import { MapSearchBar } from "./MapSearchBar";
import { MyLocationButton } from "./MyLocationButton";
import { MAP_TYPE } from "./mapLayer";
import { useGeocode, useMyLocation } from "../listings/hooks/useMyLocation";

interface Props {
  value: [number, number][]; // open ring while drawing; closed on save
  onChange: (points: [number, number][]) => void;
  /** Camera target on mount — the first vertex when re-editing. */
  center?: [number, number];
}

/** Clears the undo/clear row — full-height Buttons at spacing.lg from the
 *  bottom — so the controls and the Yandex logo all sit above it. */
const BOTTOM_ROW_CLEARANCE = spacing.lg + sizing.control + spacing.md;

export const PolygonEditor = memo(function PolygonEditor({
  value,
  onChange,
  center,
}: Props) {
  const { colors } = useTheme();
  const t = useT();
  const mapRef = useRef<YandexMapViewRef>(null);
  const { locate, loading: locating } = useMyLocation();
  const { search, loading: searching } = useGeocode();

  const invalid = ringSelfIntersects(value);

  // The map reports a tap on a vertex as a map press as well, so deleting a
  // point immediately re-added it in the same spot and tapping one looked
  // like it did nothing at all.
  const vertexPressedAt = useRef(0);

  /**
   * The opening camera, fixed for the life of the screen.
   *
   * This used to be a bare regionToCamera() call in the render body with a
   * comment claiming it was "stable in practice". It was not: a new object
   * on every render, and `cameraPosition` is controlled — so every vertex
   * added snapped the camera back to the opening frame and the reader could
   * not trace a boundary that ran off the first screenful.
   */
  const initialCamera = useInitialCamera(parcelRegion(center ?? DEFAULT_CENTER));

  // A tap is placed where it keeps the boundary simple rather than always at
  // the end of the ring. Tracing in order still just appends; a point that
  // would cross the shape goes into the edge it belongs to instead.
  const addVertex = useCallback(
    (point: [number, number]) => {
      if (Date.now() - vertexPressedAt.current < 400) return;

      const index = insertionIndexFor(value, point);

      if (index === null) {
        toast.errorKey("map.pointBlocked");
        return;
      }

      const next = [...value];
      next.splice(index, 0, point);
      onChange(next);
    },
    [value, onChange],
  );

  // Dropping a vertex across the shape is the other way to invalidate it, and
  // there is nothing sensible to do but put it back where it was.
  const moveVertex = (index: number, point: [number, number]) => {
    const next = value.map((p, i) => (i === index ? point : p));

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
        mapRef.current,
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
      mapRef.current,
      parcelRegion([pos.longitude, pos.latitude]),
      600,
    );
  }, [locate]);

  const fillColor = withAlpha(invalid ? colors.danger : colors.primary, 0.3);
  const strokeColor = invalid ? colors.danger : colors.primary;

  return (
    <View style={{ flex: 1 }}>
      <YandexMapView
        ref={mapRef}
        style={{ flex: 1 }}
        mapType={MAP_TYPE}
        cameraPosition={initialCamera}
        // The blue dot is the whole point of the locate control — without it
        // the camera moves and nothing on screen says where "here" is.
        showUserPosition
        // Bottom-left, lifted over the undo/clear row. See MAP_LOGO_RULE in
        // maps.ts: MapKit always draws it and it may not be covered.
        logoPosition={{ horizontal: "left", vertical: "bottom" }}
        logoPadding={logoPadding(spacing.md, BOTTOM_ROW_CLEARANCE)}
        onMapPress={(e) => addVertex(toPosition(e.nativeEvent.point))}
      >
        {/* Two vertices is a segment, not yet a shape; three or more close
            into the polygon here, while `value` itself stays open all the way
            to save. Neither takes its own press — a tap inside the shape
            still falls through to the map and adds a point, as before. */}
        {value.length === 2 ? (
          <Polyline
            points={ringToLatLngs(value)}
            strokeColor={strokeColor}
            strokeWidth={2}
          />
        ) : null}
        {value.length >= 3 ? (
          <Polygon
            points={ringToLatLngs(value)}
            fillColor={fillColor}
            strokeColor={strokeColor}
            strokeWidth={2}
          />
        ) : null}

        {value.map((point, index) => (
          <VertexMarker
            key={`v${index}`}
            point={point}
            onPress={() => removeVertex(index)}
            onDragEnd={(e) => moveVertex(index, toPosition(e.point))}
          />
        ))}
      </YandexMapView>

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

      <MyLocationButton
        onPress={goToMyLocation}
        loading={locating}
        bottomOffset={BOTTOM_ROW_CLEARANCE}
      />

      {/* Above the locate control. Satellite is what makes this screen
          work: the fences and roofs a plot is traced along are visible
          in the photo, not on the street map. */}

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
  point,
  onPress,
  onDragEnd,
}: {
  point: [number, number];
  onPress: () => void;
  onDragEnd: (e: MarkerDragEvent) => void;
}) {
  const { colors } = useTheme();

  return (
    <Marker
      point={toLatLng(point)}
      anchor={{ x: 0.5, y: 0.5 }}
      draggable
      onPress={onPress}
      onDragEnd={(e) => onDragEnd(e.nativeEvent)}
      // The dot never changes once drawn, so the bitmap MapKit snapshots from
      // these children is taken once instead of on every render.
      tracksViewChanges={false}
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
    </Marker>
  );
});

export default PolygonEditor;
