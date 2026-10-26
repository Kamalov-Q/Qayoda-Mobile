// src/features/map/PinPicker.maplibre.tsx
// The pin sibling of PolygonPicker: tap the map, a marker lands, drag it to
// fine-tune, save. For listings where an approximate spot is honest enough
// (an apartment in a block) and drawing a boundary would be theatre.
//
// A full screen (app/add/pin.tsx), not a <Modal>: inside a React Native Modal
// the map took no pan or pinch at all on the new architecture — the same map
// on an ordinary screen (the browse tab) moves fine.
import { useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import {
  Camera,
  Map as MapLibreMap,
  NativeUserLocation,
  ViewAnnotation,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
// Installs the log filter — see the file for what it silences and why.
import "./mapLogging";
import { animateToRegion, regionToBounds } from "./maps";
import { useMapStyle } from "./mapLayer";
import { MapPin } from "./MapPin";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../components/ui";
import { MapIconButton } from "./MapIconButton";
import { MapLayerButton } from "./MapLayerButton";
import { useMyLocation } from "../listings/hooks/useMyLocation";
import { spacing, radii } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";

/** Wide Tashkent frame for a fresh pick; a reopened picker centres its pin. */
const DEFAULT_REGION = {
  latitude: 41.3111,
  longitude: 69.2797,
  latitudeDelta: 0.25,
  longitudeDelta: 0.25,
};

interface Props {
  /** [lng, lat] — the shape the server speaks. */
  initial: [number, number] | null;
  onCancel: () => void;
  onSave: (point: [number, number]) => void;
}

export function PinPicker({ initial, onCancel, onSave }: Props) {
  const [point, setPoint] = useState<[number, number] | null>(initial);
  const cameraRef = useRef<CameraRef>(null);
  const { locate, loading: locating } = useMyLocation();
  const { colors, text } = useTheme();
  const mapStyle = useMapStyle();
  // Header and footer pad themselves: the map runs edge to edge between them.
  const insets = useSafeAreaInsets();
  const t = useT();

  const region = initial
    ? {
        latitude: initial[1],
        longitude: initial[0],
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : DEFAULT_REGION;

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        {/* Close on the LEFT, like the polygon editor: Expo Go's floating
              dev bubble parks itself top-right and swallows anything there. */}
        <Pressable
          onPress={onCancel}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ ...text.heading, flex: 1 }} numberOfLines={1}>
          {t("add.pinTitle")}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <MapLibreMap
          style={{ flex: 1 }}
          // OpenStreetMap's street map draws Tashkent's building outlines,
          // which is what a pin is aimed at here.
          mapStyle={mapStyle}
          logo={false}
          compass={false}
          onPress={(e) => {
            setPoint(e.nativeEvent.lngLat);
          }}
        >
          <Camera
            ref={cameraRef}
            initialViewState={{ bounds: regionToBounds(region) }}
          />
          <NativeUserLocation />
          {point ? (
            <ViewAnnotation
              id="pin"
              lngLat={point}
              anchor="bottom"
              draggable
              onDragEnd={(e) => {
                setPoint(e.nativeEvent.lngLat);
              }}
            >
              <MapPin />
            </ViewAnnotation>
          ) : null}
        </MapLibreMap>

        {/* One tap for the common case: the pin lands on where you stand. */}
        <MapIconButton
          icon="locate"
          label={t("location.myLocation")}
          loading={locating}
          onPress={async () => {
            const pos = await locate();
            if (!pos) return;
            setPoint([pos.longitude, pos.latitude]);
            animateToRegion(
              cameraRef.current,
              {
                latitude: pos.latitude,
                longitude: pos.longitude,
                latitudeDelta: 0.004,
                longitudeDelta: 0.004,
              },
              400,
            );
          }}
          style={{
            position: "absolute",
            right: spacing.md,
            bottom: spacing.md,
          }}
        />

        {/* Satellite shows the roof the pin is meant for, where the vector
            map shows only the plot it sits on. */}
        <MapLayerButton
          style={{ position: "absolute", top: spacing.md, right: spacing.md }}
        />

        {/* Instruction floats until a pin exists, then gets out of the way. */}
        {!point ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: spacing.md,
              left: spacing.lg,
              right: spacing.lg,
              alignItems: "center",
            }}
          >
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radii.pill,
                backgroundColor: colors.imageScrim,
              }}
            >
              <Text style={{ ...text.caption, color: "#FFFFFF" }}>
                {t("add.pinHint")}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View
        style={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          gap: spacing.sm,
        }}
      >
        <Button
          title={t("common.done")}
          disabled={!point}
          onPress={() => point && onSave(point)}
        />
      </View>
    </View>
  );
}
