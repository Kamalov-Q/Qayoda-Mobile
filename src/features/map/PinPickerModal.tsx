// src/features/map/PinPickerModal.tsx
// The pin sibling of PolygonPickerModal: tap the map, a marker lands, drag it
// to fine-tune, save. For listings where an approximate spot is honest enough
// (an apartment in a block) and drawing a boundary would be theatre.
import { useRef, useState } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { MAP_PROVIDER } from "./provider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../components/ui";
import { MapIconButton } from "./MapIconButton";
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
  visible: boolean;
  /** [lng, lat] — the shape the server speaks. */
  initial: [number, number] | null;
  onCancel: () => void;
  onSave: (point: [number, number]) => void;
}

export function PinPickerModal({ visible, initial, onCancel, onSave }: Props) {
  const [point, setPoint] = useState<[number, number] | null>(initial);
  const mapRef = useRef<MapView>(null);
  const { locate, loading: locating } = useMyLocation();
  const { colors, text } = useTheme();
  // The hook, not <SafeAreaView>: the component remeasures inside the Modal's
  // own window and finds no insets — same lesson as PolygonPickerModal.
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
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
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
          <Text style={{ ...text.heading, flex: 1 }} numberOfLines={1}>
            {t("add.pinTitle")}
          </Text>
          <Pressable
            onPress={onCancel}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          {visible ? (
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              provider={MAP_PROVIDER}
              // Satellite, same as the polygon editor: Apple's standard style
              // barely draws Uzbek cities — no buildings, nothing to aim a
              // pin at. Rooftops are the map here.
              mapType="hybrid"
              initialRegion={region}
              showsUserLocation
              showsMyLocationButton={false}
              showsPointsOfInterest={false}
              toolbarEnabled={false}
              onPress={(e) => {
                const c = e.nativeEvent.coordinate;
                setPoint([c.longitude, c.latitude]);
              }}
            >
              {point ? (
                <Marker
                  coordinate={{ latitude: point[1], longitude: point[0] }}
                  draggable
                  onDragEnd={(e) => {
                    const c = e.nativeEvent.coordinate;
                    setPoint([c.longitude, c.latitude]);
                  }}
                />
              ) : null}
            </MapView>
          ) : null}

          {/* One tap for the common case: the pin lands on where you stand. */}
          <MapIconButton
            icon="locate"
            label={t("location.myLocation")}
            loading={locating}
            onPress={async () => {
              const pos = await locate();
              if (!pos) return;
              setPoint([pos.longitude, pos.latitude]);
              mapRef.current?.animateToRegion(
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
    </Modal>
  );
}
