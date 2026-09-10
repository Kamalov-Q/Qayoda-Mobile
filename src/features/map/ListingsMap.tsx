import {
  memo,
  useCallback, useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Platform, StyleSheet, Text, View, Pressable } from "react-native";
import MapView, {
  Marker,
  Polygon,
  Region,
  type LatLng,
} from "react-native-maps";
import { MAP_PROVIDER } from "./provider";
import { Image } from "expo-image";
import Svg, { Circle, Rect, Text as SvgText } from "react-native-svg";
import { radii, spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import {
  ViewportResponse,
  BBox,
  MapPointFeature,
  MapPolygonFeature,
} from "../listings/api/listings.api";
import {
  isDrawableRing,
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

/** Hard ceiling on live map views: every feature is a native marker (and
 *  often a polygon), and past a couple hundred iOS kills the app for memory
 *  long before the map becomes unusable for any other reason. */
const MAX_RENDERED_FEATURES = 120;

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

/** A grid cell is roughly this fraction of the screen — two bubbles closer
 *  than that overlap anyway, so they merge into one numbered cluster. */
const CLUSTER_GRID_DIVISIONS = 4;

interface PointCluster {
  key: string;
  latitude: number;
  longitude: number;
  count: number;
  /** Set when the cluster is a single listing — rendered as a price bubble. */
  single: MapPointFeature | null;
  /** Members' bounds, for the tap-to-zoom. */
  west: number;
  east: number;
  south: number;
  north: number;
}

/**
 * Screen-space grid clustering — the "449" circles every serious listings map
 * shows when zoomed out. Runs on each settled region over at most a few
 * hundred points, so a plain O(n) pass beats pulling in a cluster library.
 */
function clusterPoints(
  features: MapPointFeature[],
  region: Region,
): PointCluster[] {
  const cell = Math.max(region.longitudeDelta / CLUSTER_GRID_DIVISIONS, 1e-6);
  const buckets = new Map<string, MapPointFeature[]>();

  for (const f of features) {
    const [lng, lat] = f.centroid.coordinates;
    const key = `${Math.floor(lng / cell)}:${Math.floor(lat / cell)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(f);
    else buckets.set(key, [f]);
  }

  const raw: PointCluster[] = [];
  for (const [key, members] of buckets) {
    let west = Infinity,
      east = -Infinity,
      south = Infinity,
      north = -Infinity,
      sumLng = 0,
      sumLat = 0;
    for (const m of members) {
      const [lng, lat] = m.centroid.coordinates;
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      sumLng += lng;
      sumLat += lat;
    }
    raw.push({
      key,
      latitude: sumLat / members.length,
      longitude: sumLng / members.length,
      count: members.length,
      single: members.length === 1 ? members[0] : null,
      west,
      east,
      south,
      north,
    });
  }

  // Second pass: points that straddled a cell border land in neighbouring
  // cells and their bubbles stack on screen — merge anything closer than a
  // cell. O(n²) over at most a couple hundred clusters.
  const clusters: PointCluster[] = [];
  for (const c of raw) {
    const near = clusters.find(
      (r) =>
        Math.abs(r.longitude - c.longitude) < cell &&
        Math.abs(r.latitude - c.latitude) < cell,
    );
    if (!near) {
      clusters.push({ ...c });
      continue;
    }
    const total = near.count + c.count;
    near.latitude = (near.latitude * near.count + c.latitude * c.count) / total;
    near.longitude =
      (near.longitude * near.count + c.longitude * c.count) / total;
    near.count = total;
    near.single = null;
    near.west = Math.min(near.west, c.west);
    near.east = Math.max(near.east, c.east);
    near.south = Math.min(near.south, c.south);
    near.north = Math.max(near.north, c.north);
  }
  return clusters;
}

export const ListingsMap = memo(
  forwardRef<ListingsMapHandle, Props>(function ListingsMap(
    { data, onRegionChange, onPressListing, bottomInset = 0 },
    ref,
  ) {
    const mapRef = useRef<MapView>(null);
    // The zoom buttons need the current camera, and MapView has no synchronous
    // getter — so the last settled region is remembered here.
    const regionRef = useRef<Region>(TASHKENT_REGION);
    // Mirrored into state so the clusters recompute when the camera settles.
    const [settledRegion, setSettledRegion] = useState<Region>(TASHKENT_REGION);
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
        setSettledRegion(region);
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

    const clusters = useMemo(
      () =>
        data?.mode === "points"
          ? clusterPoints(data.features, settledRegion)
          : [],
      [data, settledRegion],
    );

    const zoomToCluster = useCallback((c: PointCluster) => {
      mapRef.current?.animateToRegion(
        {
          latitude: c.latitude,
          longitude: c.longitude,
          latitudeDelta: Math.max((c.north - c.south) * 1.6, 0.006),
          longitudeDelta: Math.max((c.east - c.west) * 1.6, 0.006),
        },
        400,
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
          provider={MAP_PROVIDER}
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
            data.features.slice(0, MAX_RENDERED_FEATURES).map((f) => (
              <PolygonWithLabel
                key={f.id}
                feature={f}
                onPress={() => selectFeature(f)}
              />
            ))}

          {data?.mode === "points" &&
            clusters.slice(0, MAX_RENDERED_FEATURES).map((c) =>
              c.single ? (
                <PriceMarker
                  key={c.single.listingId}
                  coordinate={toLatLng(c.single.centroid.coordinates)}
                  label={formatPrice(c.single.price, c.single.currency)}
                  onPress={() => onPressListing(c.single!.listingId)}
                />
              ) : (
                <ClusterMarker
                  key={c.key}
                  cluster={c}
                  onPress={() => zoomToCluster(c)}
                />
              ),
            )}
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

  // Only the outline is dropped when the ring is unusable or absent (PIN
  // listings carry no boundary at all) — the bubble below still places the
  // listing on the map, which beats it vanishing entirely.
  const ring = feature.geom?.coordinates[0];

  return (
    <>
      {ring && isDrawableRing(ring) ? (
        <Polygon
          coordinates={ringToLatLngs(ring)}
          strokeColor={colors.primary}
          strokeWidth={2}
          fillColor={withAlpha(colors.primary, 0.35)}
          tappable
          onPress={onPress}
        />
      ) : null}
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

/** The numbered circle a zoomed-out map collapses nearby listings into.
 *  Tapping it dives into that neighbourhood. */
const ClusterMarker = memo(function ClusterMarker({
  cluster,
  onPress,
}: {
  cluster: PointCluster;
  onPress: () => void;
}) {
  const { colors, shadow } = useTheme();
  const t = useT();
  const tracking = useMarkerTracking();
  // Bigger circles for bigger neighbourhoods, gently.
  const size = Math.min(56, 38 + Math.floor(Math.log10(cluster.count) * 12));

  return (
    <Marker
      coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      // Android + Fabric: the marker SNAPSHOT itself mispositions children
      // (offset discs, clipped text) — verified on the emulator. Keeping the
      // view live-composited sidesteps the capture entirely; with clustering
      // the visible marker count stays low enough that panning holds 60fps.
      tracksViewChanges={
        Platform.OS === "android" ? true : tracking.tracksViewChanges
      }
      zIndex={2}
      onPress={onPress}
      accessibilityLabel={t("map.clusterLabel", { count: cluster.count })}
    >
      {/* SVG, not styled Views: Fabric misaligns the borderRadius clip mask
          inside marker rasterisation on Android (verified through four
          structural variants on the emulator) — an Svg surface draws its own
          pixels and sidesteps the whole pipeline. */}
      <View
        onLayout={tracking.onLayout}
        collapsable={false}
        style={{ width: size + 6, height: size + 6 }}
      >
        <Svg width={size + 6} height={size + 6}>
          <Circle
            cx={(size + 6) / 2}
            cy={(size + 6) / 2}
            r={(size + 6) / 2}
            fill={colors.onPrimary}
          />
          <Circle
            cx={(size + 6) / 2}
            cy={(size + 6) / 2}
            r={size / 2}
            fill={colors.primary}
          />
          <SvgText
            x={(size + 6) / 2}
            y={(size + 6) / 2}
            fill={colors.onPrimary}
            fontSize={cluster.count > 99 ? 13 : 15}
            fontWeight="bold"
            textAnchor="middle"
            alignmentBaseline="central"
          >
            {String(cluster.count)}
          </SvgText>
        </Svg>
      </View>
    </Marker>
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

  // EXPLICIT width, like the cluster circle (which never clipped): letting
  // the bubble size itself from its text is what cut bubbles to "$5" on
  // Android — the snapshot is measured narrower than the text renders,
  // especially with the OS font scale up. Fixed metrics make the bitmap
  // deterministic; allowFontScaling=false keeps the estimate honest.
  const width = Math.ceil(
    Math.max(label.length * 9.2, (sublabel?.length ?? 0) * 6.4) + 28,
  );
  const height = sublabel ? 46 : 33;

  return (
    <Marker
      coordinate={coordinate}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      // Android + Fabric: the marker SNAPSHOT itself mispositions children
      // (offset discs, clipped text) — verified on the emulator. Keeping the
      // view live-composited sidesteps the capture entirely; with clustering
      // the visible marker count stays low enough that panning holds 60fps.
      tracksViewChanges={
        Platform.OS === "android" ? true : tracking.tracksViewChanges
      }
      zIndex={1}
    >
      {/* Same SVG rationale as the cluster. */}
      <View
        onLayout={tracking.onLayout}
        collapsable={false}
        style={{ width: width + 4, height: height + 4 }}
      >
        <Svg width={width + 4} height={height + 4}>
          <Rect
            x={0}
            y={0}
            width={width + 4}
            height={height + 4}
            rx={(height + 4) / 2}
            fill="#FFFFFF"
          />
          <Rect
            x={2}
            y={2}
            width={width}
            height={height}
            rx={height / 2}
            fill={colors.primary}
          />
          <SvgText
            x={(width + 4) / 2}
            y={sublabel ? (height + 4) / 2 - 7 : (height + 4) / 2}
            fill="#FFFFFF"
            fontSize={15}
            fontWeight="bold"
            textAnchor="middle"
            alignmentBaseline="central"
          >
            {label}
          </SvgText>
          {sublabel ? (
            <SvgText
              x={(width + 4) / 2}
              y={(height + 4) / 2 + 9}
              fill="#FFFFFF"
              fontSize={10.5}
              fontWeight="600"
              opacity={0.92}
              textAnchor="middle"
              alignmentBaseline="central"
            >
              {sublabel}
            </SvgText>
          ) : null}
        </Svg>
      </View>
    </Marker>
  );
});
