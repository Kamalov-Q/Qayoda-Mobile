// Where the listing actually is: a non-interactive map preview with the real
// drawn boundary, expanding to a full-screen map on tap. The boundary is the
// app's whole pitch — the detail page is exactly where it must show up.
import { useMemo, useRef, useState } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import MapView, { Marker, Polygon, Region } from "react-native-maps";
import { MAP_PROVIDER } from "../../map/provider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, type } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT } from "../../../i18n";
import { MapIconButton } from "../../map/MapIconButton";
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
  const latLngs = useMemo(
    () => (ring ?? []).map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
    [ring],
  );
  const hasRing = !!ring && ring.length >= 3;
  const region = useMemo<Region | null>(() => {
    if (hasRing) return regionFor(ring!);
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

  // No boundary AND no pin — nothing honest to draw.
  if (!region) return null;

  // Boundary when there is one; otherwise the pin. Same slot either way.
  const overlay = hasRing ? (
    <Polygon
      coordinates={latLngs}
      strokeColor={colors.primary}
      strokeWidth={2}
      fillColor={colors.primary + "33"}
    />
  ) : (
    <Marker coordinate={{ latitude: centroid![1], longitude: centroid![0] }} />
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
              the MapView itself. iOS recycles native map views, and
              react-native-maps resets its props record to defaults when it
              reuses one (RNMapsMapView prepareMapView), so React Native never
              sees pointerEvents change back and the next map created
              anywhere — the location pickers after posting — inherited
              userInteractionEnabled = NO and ignored every touch. A plain
              View recycles cleanly. See MAP_STYLE_RULE in maps.ts. */}
        <View style={{ flex: 1, pointerEvents: "none" }}>
          <MapView
            // A picture, not a widget: touches fall through (via the wrapper
            // above) to the Pressable that opens the real map.
            style={{ flex: 1 }}
            provider={MAP_PROVIDER}
            // Same as the location card: the preview is a picture, not a widget.
            cacheEnabled
            initialRegion={region}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
            showsPointsOfInterests={false}
          >
            {overlay}
          </MapView>
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
        </View>
      ) : null}

      <FullListingMap
        visible={fullOpen}
        region={region}
        polygon={overlay}
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
  polygon,
  title,
  insets,
  onClose,
}: {
  visible: boolean;
  region: Region;
  polygon: React.ReactNode;
  title: string;
  insets: { top: number; bottom: number };
  onClose: () => void;
}) {
  const { colors, text } = useTheme();
  const t = useT();
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>(region);
  const { locate, loading: locating } = useMyLocation();

  const zoomBy = (factor: number) => {
    const r = regionRef.current;
    mapRef.current?.animateToRegion(
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
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              provider={MAP_PROVIDER}
              // Rooftops, not bare streets — same rationale as the pickers.
              mapType="hybrid"
              initialRegion={region}
              onRegionChangeComplete={(r) => {
                regionRef.current = r;
              }}
              // The blue dot + the boundary together answer "how far is it
              // from me" — the whole reason to open the full map.
              showsUserLocation
              showsMyLocationButton={false}
              showsPointsOfInterests={false}
              toolbarEnabled={false}
            >
              {polygon}
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

          {/* Jump to me; the listing marker stays put, so panning back is one
              swipe. Frames BOTH when the two are close enough to share one. */}
          <MapIconButton
            icon="locate"
            label={t("location.myLocation")}
            loading={locating}
            onPress={async () => {
              const pos = await locate();
              if (!pos) return;
              mapRef.current?.fitToCoordinates(
                [
                  { latitude: pos.latitude, longitude: pos.longitude },
                  { latitude: region.latitude, longitude: region.longitude },
                ],
                {
                  edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
                  animated: true,
                },
              );
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
