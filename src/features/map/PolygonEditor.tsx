// src/features/map/PolygonEditor.tsx
// Tap-to-add-vertex drawing — controlled component: value + onChange, GeoJSON
// [lng, lat]. The ring is kept open while drawing; Polygon closes it visually
// and closeRing() closes it for real on save.
import { memo, useCallback, useRef } from "react";
import { View, Text } from "react-native";
import MapView, {
  Marker,
  Polygon,
  Polyline,
  PROVIDER_GOOGLE,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
} from "react-native-maps";
import { Button } from "../../components/ui";
import { toast } from "../../components/ui/Toast";
import { spacing, radii, sizing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import {
  insertionIndexFor,
  ringSelfIntersects,
} from "../listings/utils/geo";
import {
  DEFAULT_CENTER,
  parcelRegion,
  searchResultRegion,
  toLatLng,
  toPosition,
  withAlpha,
} from "./maps";
import { useMarkerTracking } from "./useMarkerTracking";
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
  const mapRef = useRef<MapView>(null);
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
  const addVertex = (e: MapPressEvent) => {
    if (Date.now() - vertexPressedAt.current < 400) return;

    const point = toPosition(e.nativeEvent.coordinate);
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
  const moveVertex = (index: number, e: MarkerDragStartEndEvent) => {
    const next = value.map((p, i) =>
      i === index ? toPosition(e.nativeEvent.coordinate) : p,
    );

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
      mapRef.current?.animateToRegion(
        searchResultRegion([pos.longitude, pos.latitude]),
        600,
      );
    },
    [search],
  );

  const goToMyLocation = useCallback(async () => {
    const pos = await locate();
    if (!pos) return;
    mapRef.current?.animateToRegion(
      parcelRegion([pos.longitude, pos.latitude]),
      600,
    );
  }, [locate]);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        mapType="hybrid"
        initialRegion={parcelRegion(center ?? DEFAULT_CENTER)}
        onPress={addVertex}
        toolbarEnabled={false}
        // The blue dot is the whole point of the locate control — without it
        // the camera moves and nothing on screen says where "here" is.
        showsUserLocation
        // Ours is drawn below, clear of the undo/clear row; Google's sits
        // wherever it likes and would collide with it.
        showsMyLocationButton={false}
        // Tapping a vertex means "delete it", never "recentre on it".
        moveOnMarkerPress={false}
      >
        {/* Two vertices is a segment, not yet a shape. Polygon closes the ring
            itself, so `value` stays open all the way to save. tappable is off
            so a tap inside the shape still lands on the map and adds a point. */}
        {value.length === 2 ? (
          <Polyline
            coordinates={value.map(toLatLng)}
            strokeColor={colors.primary}
            strokeWidth={2}
          />
        ) : null}
        {value.length >= 3 ? (
          <Polygon
            coordinates={value.map(toLatLng)}
            fillColor={withAlpha(invalid ? colors.danger : colors.primary, 0.3)}
            strokeColor={invalid ? colors.danger : colors.primary}
            strokeWidth={2}
            tappable={false}
          />
        ) : null}

        {value.map((point, index) => (
          <VertexMarker
            key={`v${index}`}
            point={point}
            onPress={() => removeVertex(index)}
            onDragEnd={(e) => moveVertex(index, e)}
          />
        ))}
      </MapView>

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
  point,
  onPress,
  onDragEnd,
}: {
  point: [number, number];
  onPress: () => void;
  onDragEnd: (e: MarkerDragStartEndEvent) => void;
}) {
  const { colors } = useTheme();
  const tracking = useMarkerTracking();

  return (
    <Marker
      coordinate={toLatLng(point)}
      anchor={{ x: 0.5, y: 0.5 }}
      draggable
      onPress={onPress}
      onDragEnd={onDragEnd}
      tracksViewChanges={tracking.tracksViewChanges}
    >
      {/* The dot is drawn small but the touchable is the whole box — a 14pt
          target is unhittable. */}
      <View
        onLayout={tracking.onLayout}
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
