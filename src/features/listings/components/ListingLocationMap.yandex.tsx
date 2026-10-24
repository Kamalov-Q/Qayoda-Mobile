// src/features/listings/components/ListingLocationMap.yandex.tsx
// Where the listing actually is: a non-interactive map preview with the real
// drawn boundary, expanding to a full-screen map on tap. The boundary is the
// app's whole pitch — the detail page is exactly where it must show up.
import { useMemo, useRef, useState } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import {
  Marker,
  Polygon,
  YandexMapView,
  type YandexMapViewRef,
} from "expo-yandex-mapkit";
import {
  animateToRegion,
  isDrawableRing,
  logoPadding,
  ringToLatLngs,
  TASHKENT_REGION,
  useInitialCamera,
  toLatLng,
  visibleRegionToRegion,
  withAlpha,
  type Region,
} from "../../map/maps";
import { MapPin } from "../../map/MapPin";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, sizing, type } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT } from "../../../i18n";
import { MapIconButton } from "../../map/MapIconButton";
import { MAP_TYPE } from "../../map/mapLayer";
import { NavigateButton } from "../../map/NavigateButton";
import { useMyLocation } from "../hooks/useMyLocation";

interface Props {
  /** GeoJSON polygon rings, [lng, lat] — as the API returns `geom.coordinates`. */
  coordinates: [number, number][][] | null | undefined;
  /** PIN listings: the dropped point, [lng, lat] — from `centroid.coordinates`. */
  centroid?: [number, number] | null;
  address?: string | null;
}

const PREVIEW_HEIGHT = 170;
/** Padding factor around the boundary so it never kisses the frame. */
const SPAN_PAD = 1.6;
const MIN_SPAN = 0.003;

const MIN_DELTA = 0.0008;
const MAX_DELTA = 120;
const clampDelta = (d: number) => Math.min(MAX_DELTA, Math.max(MIN_DELTA, d));

function regionFor(ring: [number, number][]): Region {
  let west = Infinity,
    east = -Infinity,
    south = Infinity,
    north = -Infinity;
  for (const [lng, lat] of ring) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return {
    latitude: (south + north) / 2,
    longitude: (west + east) / 2,
    latitudeDelta: Math.max((north - south) * SPAN_PAD, MIN_SPAN),
    longitudeDelta: Math.max((east - west) * SPAN_PAD, MIN_SPAN),
  };
}

export function ListingLocationMap({ coordinates, centroid, address }: Props) {
  const [fullOpen, setFullOpen] = useState(false);
  const { colors, text } = useTheme();
  // Captured OUTSIDE the modal — inside a native Modal the safe-area context
  // can report zero insets (same fix as the location card's full map).
  const insets = useSafeAreaInsets();
  const t = useT();

  const ring = coordinates?.[0];
  // isDrawableRing rather than a length check: rings come off the API, and a
  // two-point "polygon" draws as nothing while still taking taps.
  const hasRing = isDrawableRing(ring);
  const boundary = useMemo(
    () => (hasRing ? ringToLatLngs(ring) : null),
    [hasRing, ring],
  );
  const region = useMemo<Region | null>(() => {
    if (hasRing) return regionFor(ring);
    if (centroid) {
      return {
        latitude: centroid[1],
        longitude: centroid[0],
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      };
    }
    return null;
  }, [hasRing, ring, centroid]);

  // Computed before the early return below: a hook cannot be called
  // conditionally, and `region` is null only when there is nothing to draw.
  const previewCamera = useInitialCamera(region ?? TASHKENT_REGION);

  // No boundary AND no pin — nothing honest to draw.
  if (!region) return null;

  // Boundary when there is one; otherwise the pin. Same slot either way.
  // Built as a function rather than an element so the two maps below each get
  // their own: a native view cannot be mounted into two parents at once, and
  // handing the same element to both left the preview empty once the modal
  // had opened.
  const overlay = () =>
    boundary ? (
      <Polygon
        points={boundary}
        fillColor={withAlpha(colors.primary, 0.2)}
        strokeColor={colors.primary}
        strokeWidth={2}
      />
    ) : (
      <Marker
        point={toLatLng(centroid!)}
        anchor={{ x: 0.5, y: 1 }}
        tracksViewChanges={false}
      >
        <MapPin />
      </Marker>
    );

  return (
    <View
      style={{
        borderRadius: radii.xl,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Pressable
        onPress={() => setFullOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("map.expand")}
        style={{ height: PREVIEW_HEIGHT }}
      >
        {/* Touches are blocked by THIS wrapper, never by a pointerEvents on
              the map itself. See MAP_STYLE_RULE in maps.ts. */}
        <View style={{ flex: 1, pointerEvents: "none" }}>
          <YandexMapView
            // A picture, not a widget: interactiveDisabled keeps it out of
            // the gesture chain, and touches fall through (via the wrapper
            // above) to the Pressable that opens the real map.
            style={{ flex: 1 }}
            mapType={MAP_TYPE}
            cameraPosition={previewCamera}
            interactiveDisabled
            logoPosition={{ horizontal: "left", vertical: "bottom" }}
          >
            {overlay()}
          </YandexMapView>
        </View>

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

      {address ? (
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
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text style={{ ...text.caption, flex: 1 }} numberOfLines={2}>
            {address}
          </Text>
          {/* Beside the address rather than on the map above it: the preview
              is one tap target that opens the full map, and a button sitting
              on it would be a second one competing for the same finger. */}
          <NavigateButton
            latitude={region.latitude}
            longitude={region.longitude}
            label={address}
            compact
          />
        </View>
      ) : null}

      <FullListingMap
        visible={fullOpen}
        region={region}
        renderOverlay={overlay}
        title={address ?? t("location.title")}
        insets={insets}
        onClose={() => setFullOpen(false)}
      />
    </View>
  );
}

function FullListingMap({
  visible,
  region,
  renderOverlay,
  title,
  insets,
  onClose,
}: {
  visible: boolean;
  region: Region;
  renderOverlay: () => React.ReactNode;
  title: string;
  insets: { top: number; bottom: number };
  onClose: () => void;
}) {
  const { colors, text } = useTheme();
  const t = useT();
  const mapRef = useRef<YandexMapViewRef>(null);
  const regionRef = useRef<Region>(region);
  const fullCamera = useInitialCamera(region);
  const { locate, loading: locating } = useMyLocation();

  const zoomBy = (factor: number) => {
    const r = regionRef.current;
    animateToRegion(
      mapRef.current,
      {
        ...r,
        latitudeDelta: clampDelta(r.latitudeDelta * factor),
        longitudeDelta: clampDelta(r.longitudeDelta * factor),
      },
      220,
    );
  };

  return (
    // Mounted permanently, shown via `visible` — the iOS dismissal-race
    // avoidance every modal host in the app uses.
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
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
          {/* Close on the LEFT, as a filled disc: on the right it sat under
              Expo Go's floating dev bubble, which swallowed the tap — the map
              looked like it had no way out. Same placement as the pickers. */}
          <Pressable
            onPress={onClose}
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
            {title}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          {visible ? (
            <YandexMapView
              ref={mapRef}
              style={{ flex: 1 }}
              mapType={MAP_TYPE}
              cameraPosition={fullCamera}
              // The blue dot + the boundary together answer "how far is it
              // from me" — the whole reason to open the full map.
              showUserPosition
              // Lifted over the Navigate pill in the bottom-left corner.
              logoPosition={{ horizontal: "left", vertical: "bottom" }}
              // Lifted over the Navigate pill, which is sizing.control tall.
              logoPadding={logoPadding(
                spacing.md,
                insets.bottom + spacing.xl + sizing.control,
              )}
              // Not onRegionChangeComplete — see visibleRegionToRegion.
              onCameraPositionChanged={(e) => {
                if (!e.nativeEvent.finished) return;
                mapRef.current
                  ?.getVisibleRegion()
                  .then((visible) => {
                    if (visible) regionRef.current = visibleRegionToRegion(visible);
                  })
                  .catch(() => {});
              }}
            >
              {renderOverlay()}
            </YandexMapView>
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
            {/* Apart from the zoom pair: it changes what the map shows, not
                where the camera is. */}
          </View>

          {/* The one thing this map cannot do itself: hand the place to
              whatever the reader navigates with. Bottom-left, labelled and
              filled — it is the only control here that leaves the app, and
              the reason most people open a full-screen map at all. */}
          <NavigateButton
            latitude={region.latitude}
            longitude={region.longitude}
            label={title}
            style={{
              position: "absolute",
              left: spacing.md,
              bottom: insets.bottom + spacing.xl,
            }}
          />

          {/* Jump to me; the listing marker stays put, so panning back is one
              swipe. Frames BOTH when the two are close enough to share one. */}
          <MapIconButton
            icon="locate"
            label={t("location.myLocation")}
            loading={locating}
            onPress={async () => {
              const pos = await locate();
              if (!pos) return;
              mapRef.current
                ?.fitToCoordinates(
                  [
                    { latitude: pos.latitude, longitude: pos.longitude },
                    { latitude: region.latitude, longitude: region.longitude },
                  ],
                  {
                    edgePadding: {
                      top: 80,
                      right: 80,
                      bottom: 80,
                      left: 80,
                    },
                  },
                )
                .catch(() => {});
            }}
            style={{
              position: "absolute",
              right: spacing.md,
              bottom: insets.bottom + spacing.xl,
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
