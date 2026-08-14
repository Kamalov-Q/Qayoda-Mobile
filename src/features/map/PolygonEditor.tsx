// src/features/map/PolygonEditor.tsx
// Tap-to-add-vertex drawing — controlled component: value + onChange, GeoJSON
// [lng, lat]. The ring is kept open while drawing; Polygon closes it visually
// and closeRing() closes it for real on save.
import { memo } from "react";
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
import { spacing, radii, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import { DEFAULT_CENTER, parcelRegion, toLatLng, toPosition, withAlpha } from "./maps";
import { useMarkerTracking } from "./useMarkerTracking";

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

  const addVertex = (e: MapPressEvent) =>
    onChange([...value, toPosition(e.nativeEvent.coordinate)]);

  const moveVertex = (index: number, e: MarkerDragStartEndEvent) =>
    onChange(
      value.map((p, i) =>
        i === index ? toPosition(e.nativeEvent.coordinate) : p,
      ),
    );

  const removeVertex = (index: number) =>
    onChange(value.filter((_, i) => i !== index));

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        mapType="hybrid"
        initialRegion={parcelRegion(center ?? DEFAULT_CENTER)}
        onPress={addVertex}
        toolbarEnabled={false}
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
            fillColor={withAlpha(colors.primary, 0.3)}
            strokeColor={colors.primary}
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

      <View
        style={{
          position: "absolute",
          top: spacing.md,
          left: spacing.md,
          right: spacing.md,
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
