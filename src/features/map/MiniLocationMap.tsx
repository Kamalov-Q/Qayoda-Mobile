// src/features/map/MiniLocationMap.tsx
// "My location" card for the profile screen: a compact ask-first state, then a
// tappable map preview that opens a full-screen interactive map.
import { useCallback, useRef, useState } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { MAP_PROVIDER } from "./provider";
import * as Location from "expo-location";
import { useSafeAreaInsets, type EdgeInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import { Button } from "../../components/ui/Button";
import { useMyLocation, type Coords } from "../listings/hooks/useMyLocation";
import { MapIconButton } from "./MapIconButton";
import { useMarkerTracking } from "./useMarkerTracking";

const PREVIEW_HEIGHT = 150;
const PREVIEW_SPAN = 0.006;
const FULL_SPAN = 0.01;

const MIN_DELTA = 0.0008;
const MAX_DELTA = 120;
const clampDelta = (d: number) => Math.min(MAX_DELTA, Math.max(MIN_DELTA, d));

export function MiniLocationMap() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [addressLine, setAddressLine] = useState<string | null>(null);
  const [fullOpen, setFullOpen] = useState(false);
  const { locate, loading } = useMyLocation();
  const { colors, text } = useTheme();
  const t = useT();
  // Captured here, OUTSIDE the modal: inside a native Modal the safe-area
  // context can report zero insets, which put the full map's title bar under
  // the status bar clock and its close button out of reach.
  const insets = useSafeAreaInsets();

  // Nothing runs on mount: opening the profile tab is not consent to a
  // permission prompt, and an unprompted sheet is the fastest way to get
  // denied permanently. The card asks, then locates.
  const onLocate = useCallback(async () => {
    const position = await locate();
    if (!position) return;
    setCoords(position);

    // Street/district text makes the frame informative rather than
    // decorative. Best-effort: a geocoder miss just leaves the line off.
    try {
      const [place] = await Location.reverseGeocodeAsync(position);
      const line = [place?.street ?? place?.name, place?.district, place?.city]
        .filter(Boolean)
        .join(", ");
      setAddressLine(line || null);
    } catch {
      setAddressLine(null);
    }
  }, [locate]);

  // --- Ask-first state: a compact row, not a dead grey slab -----------------
  if (!coords) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySoft,
            borderWidth: 1,
            borderColor: colors.primaryBorder,
          }}
        >
          <Ionicons name="location-outline" size={20} color={colors.primary} />
        </View>
        <Text style={{ ...text.caption, flex: 1 }}>
          {t("location.previewHint")}
        </Text>
        <Button
          title={t("location.show")}
          size="sm"
          loading={loading}
          onPress={onLocate}
        />
      </View>
    );
  }

  // --- Located: tappable preview + full-screen modal ------------------------
  return (
    <View>
      <Pressable
        onPress={() => setFullOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("map.expand")}
        accessibilityHint={t("location.tapToOpen")}
        style={{ height: PREVIEW_HEIGHT }}
      >
        <MapView
          // The preview is a picture: pointer events off (in style — the prop
          // form is deprecated in RN 0.81) so the settings list keeps its
          // scroll and every touch falls through to the Pressable that opens
          // the real, fully interactive map.
          style={{ flex: 1, pointerEvents: "none" }}
          provider={MAP_PROVIDER}
          // iOS: render once and hand back a bitmap — a live map is wasted
          // on a non-interactive 150pt preview.
          cacheEnabled
          region={{
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: PREVIEW_SPAN,
            longitudeDelta: PREVIEW_SPAN,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          showsPointsOfInterest={false}
        >
          <LocationDot coords={coords} />
        </MapView>

        {/* Expand affordance — says "this opens" without stealing the tap. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: spacing.sm,
            right: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            paddingHorizontal: spacing.sm,
            paddingVertical: 5,
            borderRadius: radii.pill,
            backgroundColor: colors.imageScrim,
          }}
        >
          <Ionicons name="expand-outline" size={13} color="#FFFFFF" />
          <Text style={{ ...type.caption, fontSize: 11, color: "#FFFFFF" }}>
            {t("location.tapToOpen")}
          </Text>
        </View>
      </Pressable>

      {/* Address bar under the preview, inside the card. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          padding: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Ionicons name="navigate" size={16} color={colors.primary} />
        <Text style={{ ...text.caption, flex: 1 }} numberOfLines={1}>
          {addressLine ??
            `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`}
        </Text>
        <Pressable
          onPress={onLocate}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("location.myLocation")}
        >
          <Ionicons
            name="refresh"
            size={16}
            color={loading ? colors.textFaint : colors.primary}
          />
        </Pressable>
      </View>

      <FullMap
        visible={fullOpen}
        coords={coords}
        insets={insets}
        onRelocate={onLocate}
        locating={loading}
        onClose={() => setFullOpen(false)}
      />
    </View>
  );
}

/** Full-screen, fully interactive map — pan, zoom buttons, re-locate. */
function FullMap({
  visible,
  coords,
  insets,
  locating,
  onRelocate,
  onClose,
}: {
  visible: boolean;
  coords: Coords;
  insets: EdgeInsets;
  locating: boolean;
  onRelocate: () => void;
  onClose: () => void;
}) {
  const { colors, text } = useTheme();
  const t = useT();
  const mapRef = useRef<MapView>(null);
  const initialRegion: Region = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    latitudeDelta: FULL_SPAN,
    longitudeDelta: FULL_SPAN,
  };
  const regionRef = useRef<Region>(initialRegion);

  const zoomBy = (factor: number) => {
    const region = regionRef.current;
    mapRef.current?.animateToRegion(
      {
        ...region,
        latitudeDelta: clampDelta(region.latitudeDelta * factor),
        longitudeDelta: clampDelta(region.longitudeDelta * factor),
      },
      220,
    );
  };

  const recenter = () => {
    onRelocate();
    mapRef.current?.animateToRegion(
      { ...initialRegion, ...coords },
      400,
    );
  };

  return (
    // Mounted permanently, shown via `visible` — same iOS dismissal-race
    // avoidance as the other modal hosts.
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          paddingTop: insets.top,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={text.heading}>{t("location.myLocation")}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          {/* Only while shown: the modal itself stays mounted (iOS dismissal
              race), but a hidden live map — with user-location tracking on —
              kept rendering behind the settings screen and made its back
              button stutter after any location action. */}
          {visible ? (
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              provider={MAP_PROVIDER}
              initialRegion={initialRegion}
              onRegionChangeComplete={(region) => {
                regionRef.current = region;
              }}
              showsUserLocation
              showsMyLocationButton={false}
              showsPointsOfInterest={false}
              toolbarEnabled={false}
            >
              <LocationDot coords={coords} />
            </MapView>
          ) : null}

          <View
            style={{
              position: "absolute",
              top: spacing.md,
              right: spacing.md,
              gap: spacing.sm,
            }}
          >
            <MapIconButton
              icon="add"
              label={t("map.zoomIn")}
              onPress={() => zoomBy(0.5)}
            />
            <MapIconButton
              icon="remove"
              label={t("map.zoomOut")}
              onPress={() => zoomBy(2)}
            />
          </View>

          <MapIconButton
            icon="locate"
            label={t("location.myLocation")}
            loading={locating}
            onPress={recenter}
            style={{
              position: "absolute",
              right: spacing.md,
              // Above the home indicator, not under it.
              bottom: insets.bottom + spacing.xl,
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function LocationDot({ coords }: { coords: Coords }) {
  const { colors } = useTheme();
  // Same rule as the price bubbles: a custom marker needs tracking on until
  // its first layout or Android snapshots it blank.
  const tracking = useMarkerTracking();

  return (
    <Marker
      coordinate={coords}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracking.tracksViewChanges}
    >
      <View
        onLayout={tracking.onLayout}
        collapsable={false}
        style={{
          width: 22,
          height: 22,
          borderRadius: radii.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${colors.primary}33`,
        }}
      >
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: radii.pill,
            backgroundColor: colors.primary,
            borderWidth: 2,
            borderColor: "#FFFFFF",
          }}
        />
      </View>
    </Marker>
  );
}

export default MiniLocationMap;
