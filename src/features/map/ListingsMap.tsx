import {
  memo,
  useCallback,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import MapView, {
  Marker,
  Polygon,
  Region,
  PROVIDER_DEFAULT,
  type LatLng,
} from "react-native-maps";
import { Image } from "expo-image";
import { radii, spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import {
  ViewportResponse,
  BBox,
  MapPolygonFeature,
} from "../listings/api/listings.api";
import {
  ringToLatLngs,
  toLatLng,
  regionToViewport,
  withAlpha,
  TASHKENT_REGION,
} from "./maps";
import { useMarkerTracking } from "./useMarkerTracking";
import { usePriceFormatter, useSpecsFormatter } from "../listings/utils/format";
import { resolveMediaUrl } from "../../lib/media-url";
import { MapIconButton } from "./MapIconButton";
import { MyLocationButton } from "./MyLocationButton";
import { useMyLocation } from "../listings/hooks/useMyLocation";

export interface ListingsMapHandle {
  animateTo: (lat: number, lng: number) => void;
}

interface Props {
  data: ViewportResponse | undefined;
  onRegionChange: (bbox: BBox, zoom: number) => void;
  onPressListing: (id: string) => void;
  /**
   * Room to leave at the bottom for whatever the screen floats over the map —
   * on the sale tab, the map/list switch. Everything the map pins to its own
   * bottom edge (the preview card, the locate button) is lifted by it.
   */
  bottomInset?: number;
}

// Height of the preview card, so the locate button can clear it.
const CARD_HEIGHT = 110;

/**
 * How long after tapping a polygon or its price bubble the map's own press —
 * and any camera settle — is treated as part of that same tap.
 *
 * Both providers deliver the map press alongside the overlay's. iOS is the
 * blunt one: `handleMapTap` dispatches the polygon's `onPress` and then falls
 * through to the map's with no early return, so selecting a listing and
 * clearing the selection happened in the same tap and the map looked dead
 * exactly where it had something to show.
 */
const OVERLAY_PRESS_GRACE_MS = 400;

// Guard rails for the zoom buttons: past either end animateToRegion just
// bounces, so stop where the providers do (block scale to whole world).
const MIN_DELTA = 0.0008;
const MAX_DELTA = 120;

const clampDelta = (d: number) => Math.min(MAX_DELTA, Math.max(MIN_DELTA, d));

export const ListingsMap = memo(
  forwardRef<ListingsMapHandle, Props>(function ListingsMap(
    { data, onRegionChange, onPressListing, bottomInset = 0 },
    ref,
  ) {
    const mapRef = useRef<MapView>(null);
    // The zoom buttons need the current camera, and MapView has no synchronous
    // getter — so the last settled region is remembered here.
    const regionRef = useRef<Region>(TASHKENT_REGION);
    const [selected, setSelected] = useState<MapPolygonFeature | null>(null);
    const overlayPressedAt = useRef(0);
    const { locate, loading: locating } = useMyLocation();
    const { colors, text, shadow } = useTheme();
    const t = useT();
    const formatPrice = usePriceFormatter();
    const formatSpecs = useSpecsFormatter();

    useImperativeHandle(ref, () => ({
      animateTo: (latitude, longitude) => {
        mapRef.current?.animateToRegion(
          { latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
          600,
        );
      },
    }));

    const selectFeature = useCallback((feature: MapPolygonFeature) => {
      overlayPressedAt.current = Date.now();
      setSelected(feature);
    }, []);

    /** Dismisses the preview — unless the "dismiss" is the tail of the tap
     *  that just opened it. */
    const clearSelection = useCallback(() => {
      if (Date.now() - overlayPressedAt.current < OVERLAY_PRESS_GRACE_MS) return;
      setSelected(null);
    }, []);

    const handleRegionChangeComplete = useCallback(
      (region: Region) => {
        regionRef.current = region;
        const { bbox, zoom } = regionToViewport(region);
        onRegionChange(bbox, zoom);
        // Panning away from a selected parcel should drop its card — but a
        // marker press nudges the camera on Android, and that settles here.
        clearSelection();
      },
      [onRegionChange, clearSelection],
    );

    // Halving the spans is one conventional zoom step in; doubling is one out.
    const zoomBy = useCallback((factor: number) => {
      const region = regionRef.current;
      mapRef.current?.animateToRegion(
        {
          ...region,
          latitudeDelta: clampDelta(region.latitudeDelta * factor),
          longitudeDelta: clampDelta(region.longitudeDelta * factor),
        },
        220,
      );
    }, []);

    const goToMyLocation = useCallback(async () => {
      const pos = await locate();
      if (!pos) return;
      mapRef.current?.animateToRegion(
        {
          latitude: pos.latitude,
          longitude: pos.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        600,
      );
      // camera settle → onRegionChangeComplete → nearby listings fetch automatically
    }, [locate]);

    return (
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_DEFAULT}
          initialRegion={TASHKENT_REGION}
          mapType="hybrid"
          onRegionChangeComplete={handleRegionChangeComplete}
          onPress={clearSelection}
          showsUserLocation
          showsMyLocationButton={false}
          showsPointsOfInterest={false}
          toolbarEnabled={false}
          // Android recentres on a marker press by default, which settles into
          // onRegionChangeComplete a beat later — another route to the card
          // being torn down by the tap that opened it.
          moveOnMarkerPress={false}
        >
          {data?.mode === "polygons" &&
            data.features.map((f) => (
              <PolygonWithLabel
                key={f.id}
                feature={f}
                onPress={() => selectFeature(f)}
              />
            ))}

          {data?.mode === "points" &&
            data.features.map((f) => (
              <PriceMarker
                key={f.listingId}
                coordinate={toLatLng(f.centroid.coordinates)}
                label={formatPrice(f.price, f.currency)}
                onPress={() => onPressListing(f.listingId)}
              />
            ))}
        </MapView>

        {/* Zoom pair, top-right. The locate button keeps the bottom corner —
            it pairs with the blue you-are-here dot rather than with the
            camera. */}
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

        <MyLocationButton
          onPress={goToMyLocation}
          loading={locating}
          bottomOffset={
            bottomInset +
            (selected ? CARD_HEIGHT + spacing.lg + spacing.md : spacing.xl)
          }
        />

        {selected ? (
          <Pressable
            onPress={() => onPressListing(selected.id)}
            accessibilityRole="button"
            style={{
              position: "absolute",
              left: spacing.md,
              right: spacing.md,
              bottom: spacing.md + bottomInset,
              flexDirection: "row",
              backgroundColor: colors.surface,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
              ...shadow.raised,
            }}
          >
            <View
              style={{
                width: 120,
                height: CARD_HEIGHT,
                backgroundColor: colors.surfaceRaised,
              }}
            >
              {selected.thumbUrl ? (
                <Image
                  source={{ uri: resolveMediaUrl(selected.thumbUrl) }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : null}
            </View>

            <View
              style={{
                flex: 1,
                padding: spacing.md,
                justifyContent: "center",
                gap: 4,
              }}
            >
              <Text style={{ ...text.heading, color: colors.primary }}>
                {formatPrice(selected.price, selected.currency)}
              </Text>
              <Text style={text.body} numberOfLines={1}>
                {selected.title ?? t("listings.untitled")}
              </Text>
              <Text style={text.caption} numberOfLines={1}>
                {formatSpecs(selected)}
              </Text>
              <Text style={{ ...text.caption, color: colors.primary }}>
                {t("listings.viewDetails")}
              </Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    );
  }),
);

const PolygonWithLabel = memo(function PolygonWithLabel({
  feature,
  onPress,
}: {
  feature: MapPolygonFeature;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const formatPrice = usePriceFormatter();
  const formatSpecs = useSpecsFormatter();

  return (
    <>
      <Polygon
        coordinates={ringToLatLngs(feature.geom.coordinates[0])}
        strokeColor={colors.primary}
        strokeWidth={2}
        fillColor={withAlpha(colors.primary, 0.35)}
        tappable
        onPress={onPress}
      />
      {/* Guard: backend types centroid as nullable — no bubble without one */}
      {feature.centroid ? (
        <PriceMarker
          coordinate={toLatLng(feature.centroid.coordinates)}
          label={formatPrice(feature.price, feature.currency)}
          // Polygons only exist zoomed in, where there is room on screen for
          // more than the price — zoomed-out point markers stay price-only.
          sublabel={formatSpecs(feature) || undefined}
          onPress={onPress}
        />
      ) : null}
    </>
  );
});

const PriceMarker = memo(function PriceMarker({
  coordinate,
  label,
  sublabel,
  onPress,
}: {
  coordinate: LatLng;
  label: string;
  /** Second, smaller line (e.g. "80 m² · 3 xona") — shown when zoomed in. */
  sublabel?: string;
  onPress: () => void;
}) {
  const { colors, shadow } = useTheme();
  // A marker with custom children that starts at tracksViewChanges={false}
  // renders blank on Android — it is snapshotted before its child lays out.
  // Tracking stays on until that first layout, then off so panning is smooth.
  const tracking = useMarkerTracking();

  return (
    <Marker
      coordinate={coordinate}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracking.tracksViewChanges}
    >
      {/* Sized to be read at arm's length over satellite imagery, where a
          13pt label on a 4pt-padded chip disappears into the roofs. */}
      <View
        onLayout={tracking.onLayout}
        style={{
          backgroundColor: colors.primary,
          paddingHorizontal: 12,
          paddingVertical: sublabel ? 6 : 7,
          borderRadius: sublabel ? radii.lg : radii.pill,
          borderWidth: 2,
          borderColor: "#FFFFFF",
          alignItems: "center",
          ...shadow.control,
        }}
      >
        <Text
          style={{
            ...type.bodyStrong,
            fontWeight: "800",
            color: "#FFFFFF",
          }}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text
            style={{
              ...type.caption,
              fontSize: 11,
              fontWeight: "600",
              color: "#FFFFFF",
              opacity: 0.9,
            }}
          >
            {sublabel}
          </Text>
        ) : null}
      </View>
    </Marker>
  );
});
