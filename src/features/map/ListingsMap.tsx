import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, {
  Circle as MapCircle,
  Marker,
  Polygon,
  Region,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
} from "react-native-maps";
import { MAP_PROVIDER } from "./provider";
import Svg, { Circle, Rect, Text as SvgText } from "react-native-svg";
import { spacing } from "../../theme/tokens";
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
  toPosition,
  radiusRegion,
  regionToViewport,
  withAlpha,
  TASHKENT_REGION,
} from "./maps";
import { useMarkerTracking } from "./useMarkerTracking";
import { usePriceFormatter, useSpecsFormatter } from "../listings/utils/format";
import { MapIconButton } from "./MapIconButton";
import { ListingPreviewSheet } from "./ListingPreviewSheet";
import { ListingStackSheet } from "./ListingStackSheet";
import { MyLocationButton } from "./MyLocationButton";
import { useMyLocation } from "../listings/hooks/useMyLocation";

export interface ListingsMapHandle {
  animateTo: (lat: number, lng: number) => void;
  /** Frames a search circle, so applying one shows everything inside it. */
  fitRadius: (center: [number, number], radiusM: number) => void;
}

/** The search circle, as the screen's filter state describes it. */
export interface RadiusCircle {
  /** GeoJSON [lng, lat] — the order everything outside this folder speaks. */
  center: [number, number];
  /** Null draws the centre pin but no ring: "anywhere", still centred here. */
  radiusM: number | null;
  /** While true the pin is draggable and a tap on the map moves it. */
  editable?: boolean;
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
  /**
   * Whether a listing's preview card is open. The screen floats its own
   * chrome over the same bottom strip (the "Topildi" count), which covered the
   * card's "view details" link — so it needs to know to step aside.
   */
  onSelectionChange?: (open: boolean) => void;
  /** Drawn over the listings; null when no radius filter is being used. */
  circle?: RadiusCircle | null;
  /** The centre was dragged, or tapped onto a new spot. Editable circles only. */
  onCircleMove?: (center: [number, number]) => void;
  /** The map's own radius control was pressed. Omitted, no control is drawn. */
  onToggleRadius?: () => void;
  /** Tints that control — the panel is open, or a radius is applied. */
  radiusActive?: boolean;
}

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

/**
 * The same idea at polygon zoom, far finer: a twelfth of the screen is about
 * 30pt, which is close enough that one price bubble sits on top of another.
 * Anything looser would merge parcels that are plainly separate — down here
 * the point is only to stop a listing hiding behind its neighbour.
 */
const BUBBLE_GRID_DIVISIONS = 12;

/** One price bubble's worth of listings — usually exactly one. */
interface BubbleGroup {
  key: string;
  latitude: number;
  longitude: number;
  features: MapPolygonFeature[];
}

/**
 * Buckets the drawn parcels by where their bubbles would land.
 *
 * Only bubbles merge; every outline is still drawn from the full list. A
 * group of one renders exactly as before, so the common case is untouched.
 *
 * A plain grid, so two parcels that are close but fall either side of a cell
 * boundary keep their own bubbles. That is the old behaviour — slightly
 * overlapping pins — and it degrades gracefully; the case this exists for is
 * listings at the SAME point, which always land in the same cell.
 */
function groupBubbles(
  features: MapPolygonFeature[],
  region: Region,
): BubbleGroup[] {
  const cell = Math.max(region.longitudeDelta / BUBBLE_GRID_DIVISIONS, 1e-9);
  const buckets = new Map<string, BubbleGroup>();

  for (const feature of features) {
    const coords = feature.centroid?.coordinates;
    if (!coords) continue;

    const [lng, lat] = coords;
    const key = `${Math.floor(lng / cell)}:${Math.floor(lat / cell)}`;
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.features.push(feature);
      // The bubble sits on the first of them rather than on the average of
      // the group: a marker that drifts as listings load is worse than one
      // that is a few metres off the middle.
    } else {
      buckets.set(key, {
        key,
        latitude: lat,
        longitude: lng,
        features: [feature],
      });
    }
  }

  return [...buckets.values()];
}

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
    {
      data,
      onRegionChange,
      onPressListing,
      bottomInset = 0,
      onSelectionChange,
      circle,
      onCircleMove,
      onToggleRadius,
      radiusActive,
    },
    ref,
  ) {
    const mapRef = useRef<MapView>(null);
    // The zoom buttons need the current camera, and MapView has no synchronous
    // getter — so the last settled region is remembered here.
    const regionRef = useRef<Region>(TASHKENT_REGION);
    // Mirrored into state so the clusters recompute when the camera settles.
    const [settledRegion, setSettledRegion] = useState<Region>(TASHKENT_REGION);
    const [selected, setSelected] = useState<MapPolygonFeature | null>(null);
    /** Several listings share a spot and the reader tapped their bubble. */
    const [stack, setStack] = useState<BubbleGroup | null>(null);
    const overlayPressedAt = useRef(0);
    const { locate, loading: locating } = useMyLocation();
    const { colors } = useTheme();
    const t = useT();
    // Once for the whole map — see `bubbleViews`.
    const formatPrice = usePriceFormatter();
    const formatSpecs = useSpecsFormatter();

    useImperativeHandle(ref, () => ({
      animateTo: (latitude, longitude) => {
        mapRef.current?.animateToRegion(
          { latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
          600,
        );
      },
      fitRadius: (center, radiusM) => {
        mapRef.current?.animateToRegion(
          radiusRegion(toLatLng(center), radiusM),
          500,
        );
      },
    }));

    const selectFeature = useCallback(
      (feature: MapPolygonFeature) => {
        overlayPressedAt.current = Date.now();
        setStack(null);
        setSelected(feature);
        onSelectionChange?.(true);
      },
      [onSelectionChange],
    );

    /** A stacked bubble opens the list of what is under it, not one of them:
     *  picking for the reader would be picking at random. */
    const openStack = useCallback(
      (group: BubbleGroup) => {
        overlayPressedAt.current = Date.now();
        setSelected(null);
        setStack(group);
        onSelectionChange?.(true);
      },
      [onSelectionChange],
    );

    /** The card's close button. Unconditional: the reader asked for it, so
     *  the grace window below has no business second-guessing them. */
    const clearPreview = useCallback(() => {
      setSelected(null);
      setStack(null);
      onSelectionChange?.(false);
    }, [onSelectionChange]);

    /** Dismisses the preview — unless the "dismiss" is the tail of the tap
     *  that just opened it. */
    const clearSelection = useCallback(() => {
      if (Date.now() - overlayPressedAt.current < OVERLAY_PRESS_GRACE_MS)
        return;
      setSelected(null);
      setStack(null);
      onSelectionChange?.(false);
    }, [onSelectionChange]);

    /** A tap on empty map: while the circle is being set that means "centre it
     *  here", which is quicker than dragging across the screen. Otherwise it
     *  dismisses the preview card, as it always did. */
    const handleMapPress = useCallback(
      (e: MapPressEvent) => {
        if (circle?.editable && onCircleMove) {
          // iOS reports a marker press as a map press too (the same fall-
          // through the grace window exists for), and tapping a price bubble
          // must not quietly move the centre somewhere else.
          if (Date.now() - overlayPressedAt.current < OVERLAY_PRESS_GRACE_MS)
            return;
          onCircleMove(toPosition(e.nativeEvent.coordinate));
          return;
        }
        clearSelection();
      },
      [circle?.editable, onCircleMove, clearSelection],
    );

    const handleCenterDragEnd = useCallback(
      (e: MarkerDragStartEndEvent) => {
        onCircleMove?.(toPosition(e.nativeEvent.coordinate));
      },
      [onCircleMove],
    );

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

    const bubbles = useMemo(
      () =>
        data?.mode === "polygons"
          ? groupBubbles(
              data.features.slice(0, MAX_RENDERED_FEATURES),
              settledRegion,
            )
          : [],
      [data, settledRegion],
    );

    /**
     * Every bubble's text, formatted here rather than inside each marker.
     *
     * A price needs the display currency and the day's rate; reading those is
     * a store subscription plus a react-query observer. Done per marker that
     * is one of each per pin on screen — a hundred observers on one query,
     * every one of them re-rendering when it notifies. Done here it is one,
     * and the markers still compare cheaply because what they receive is a
     * string.
     */
    const bubbleViews = useMemo(
      () =>
        bubbles.map((group) => {
          if (group.features.length === 1) {
            const feature = group.features[0];
            return {
              key: feature.id,
              group,
              feature,
              label: formatPrice(feature.price, feature.currency),
              sublabel: formatSpecs(feature) || undefined,
            };
          }

          // The lowest, so the bubble is not a promise the cheapest listing
          // here cannot keep. "from" says there are dearer ones behind it.
          const cheapest = group.features.reduce((low: MapPolygonFeature, f) =>
            Number(f.price) < Number(low.price) ? f : low,
          );
          return {
            key: group.key,
            group,
            feature: null,
            label: `${t("map.priceFrom")} ${formatPrice(cheapest.price, cheapest.currency)}`,
            sublabel: t("map.stackCount", { count: group.features.length }),
          };
        }),
      [bubbles, formatPrice, formatSpecs, t],
    );

    /** The same, for the price bubbles at point zoom. */
    const clusterViews = useMemo(
      () =>
        clusters.slice(0, MAX_RENDERED_FEATURES).map((cluster) => ({
          cluster,
          label: cluster.single
            ? formatPrice(cluster.single.price, cluster.single.currency)
            : "",
        })),
      [clusters, formatPrice],
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
          style={StyleSheet.absoluteFill}
          provider={MAP_PROVIDER}
          initialRegion={TASHKENT_REGION}
          mapType="hybrid"
          onRegionChangeComplete={handleRegionChangeComplete}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton={false}
          showsPointsOfInterests={false}
          toolbarEnabled={false}
          // Android recentres on a marker press by default, which settles into
          // onRegionChangeComplete a beat later — another route to the card
          // being torn down by the tap that opened it.
          moveOnMarkerPress={false}
        >
          {/* Every parcel draws its own outline; the bubbles are grouped, so
              two listings at one address cannot hide behind each other. */}
          {data?.mode === "polygons" &&
            data.features
              .slice(0, MAX_RENDERED_FEATURES)
              .map((f) => (
                <ParcelOutline
                  key={f.id}
                  feature={f}
                  onSelect={selectFeature}
                />
              ))}

          {bubbleViews.map((view) =>
            view.feature ? (
              <ParcelBubble
                key={view.key}
                feature={view.feature}
                label={view.label}
                sublabel={view.sublabel}
                onSelect={selectFeature}
              />
            ) : (
              <StackBubble
                key={view.key}
                group={view.group}
                label={view.label}
                sublabel={view.sublabel ?? ""}
                onSelect={openStack}
              />
            ),
          )}

          {data?.mode === "points" &&
            clusterViews.map(({ cluster, label }) =>
              cluster.single ? (
                <PointMarker
                  key={cluster.single.listingId}
                  feature={cluster.single}
                  label={label}
                  onPress={onPressListing}
                />
              ) : (
                <ClusterMarker
                  key={cluster.key}
                  cluster={cluster}
                  onZoom={zoomToCluster}
                />
              ),
            )}

          {/* Last inside the map so the ring sits over the parcels it is
              narrowing rather than under them. */}
          {circle && circle.radiusM != null ? (
            <MapCircle
              center={toLatLng(circle.center)}
              radius={circle.radiusM}
              strokeWidth={2}
              strokeColor={colors.primary}
              fillColor={withAlpha(colors.primary, 0.14)}
            />
          ) : null}

          {circle ? (
            <Marker
              coordinate={toLatLng(circle.center)}
              anchor={{ x: 0.5, y: 0.5 }}
              draggable={!!circle.editable}
              onDragEnd={handleCenterDragEnd}
              // The pin grows a grab collar when it becomes editable, and a
              // frozen marker keeps the snapshot it was first drawn with.
              tracksViewChanges={!!circle.editable}
              zIndex={2}
              accessibilityLabel={t("map.radiusCenter")}
            >
              <RadiusCenterPin
                color={colors.primary}
                editable={!!circle.editable}
              />
            </Marker>
          ) : null}
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
          {/* Separated from the zoom pair by its own gap — it changes what the
              map is showing, not where the camera is. */}
          {onToggleRadius ? (
            <MapIconButton
              icon="locate-outline"
              label={t("map.radiusOn")}
              onPress={onToggleRadius}
              active={radiusActive}
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
        </View>

        {/* Stood down while a listing's card is open. The card fills the
            bottom of the map, and a control that had to climb above it would
            end up somewhere that means nothing — the card is what the reader
            is looking at, and it closes in one tap. */}
        {!selected ? (
          <MyLocationButton
            onPress={goToMyLocation}
            loading={locating}
            bottomOffset={bottomInset + spacing.xl}
          />
        ) : null}

        {/* Polygon mode only, as before: a tap on a drawn parcel opens this
            card, while a price bubble at point zoom still goes straight to
            the listing. */}
        {stack ? (
          <ListingStackSheet
            features={stack.features}
            onSelect={selectFeature}
            onClose={clearPreview}
          />
        ) : null}

        {selected ? (
          <ListingPreviewSheet
            feature={selected}
            onOpen={onPressListing}
            onClose={clearPreview}
            // Deliberately ignores `bottomInset`: the card takes the strip
            // the screen's own chrome floats in, which steps aside for it.
            bottomInset={0}
          />
        ) : null}
      </View>
    );
  }),
);

/**
 * One parcel's boundary.
 *
 * Drawn per listing even where several share a spot — the outlines are what
 * distinguishes them, and two plots that overlap on screen still have
 * different edges. Only their PRICE BUBBLES merge (see BubbleGroup), because
 * two bubbles at one point are just one bubble with the other hidden behind.
 */
const ParcelOutline = memo(function ParcelOutline({
  feature,
  onSelect,
}: {
  feature: MapPolygonFeature;
  /** Takes the feature, so the parent can hand down one stable callback for
   *  every polygon instead of a fresh closure per render. */
  onSelect: (feature: MapPolygonFeature) => void;
}) {
  const { colors } = useTheme();
  const onPress = useCallback(() => onSelect(feature), [onSelect, feature]);

  // Dropped when the ring is unusable or absent (PIN listings carry no
  // boundary at all) — the bubble still places the listing on the map, which
  // beats it vanishing entirely.
  const ring = feature.geom?.coordinates[0];
  if (!ring || !isDrawableRing(ring)) return null;

  return (
    <Polygon
      coordinates={ringToLatLngs(ring)}
      strokeColor={colors.primary}
      strokeWidth={2}
      fillColor={withAlpha(colors.primary, 0.35)}
      tappable
      onPress={onPress}
    />
  );
});

/**
 * A single listing's price bubble, in polygon mode.
 *
 * Its text is handed in already formatted. Formatting needs the display
 * currency and the day's exchange rate, and reading those is a store
 * subscription and a QUERY OBSERVER — per marker, which at a hundred markers
 * is a hundred of each, all re-rendering together whenever the rate query
 * notifies. The map does it once for everything it draws.
 */
const ParcelBubble = memo(function ParcelBubble({
  feature,
  label,
  sublabel,
  onSelect,
}: {
  feature: MapPolygonFeature;
  label: string;
  sublabel?: string;
  onSelect: (feature: MapPolygonFeature) => void;
}) {
  const onPress = useCallback(() => onSelect(feature), [onSelect, feature]);

  if (!feature.centroid) return null;

  return (
    <PriceMarker
      latitude={feature.centroid.coordinates[1]}
      longitude={feature.centroid.coordinates[0]}
      label={label}
      // Polygons only exist zoomed in, where there is room on screen for more
      // than the price — zoomed-out point markers stay price-only.
      sublabel={sublabel}
      onPress={onPress}
    />
  );
});

/**
 * The bubble for several listings sharing one spot: the cheapest price, and
 * how many others are under it.
 *
 * Two flats in one building, or the same plot advertised twice, put their
 * markers at the same coordinate — where one simply hides the other, and the
 * count above the map says two while the map shows one.
 */
const StackBubble = memo(function StackBubble({
  group,
  label,
  sublabel,
  onSelect,
}: {
  group: BubbleGroup;
  label: string;
  sublabel: string;
  onSelect: (group: BubbleGroup) => void;
}) {
  const onPress = useCallback(() => onSelect(group), [onSelect, group]);

  return (
    <PriceMarker
      latitude={group.latitude}
      longitude={group.longitude}
      label={label}
      sublabel={sublabel}
      badge={group.features.length}
      onPress={onPress}
    />
  );
});

/** The numbered circle a zoomed-out map collapses nearby listings into.
 *  Tapping it dives into that neighbourhood. */
const ClusterMarker = memo(function ClusterMarker({
  cluster,
  onZoom,
}: {
  cluster: PointCluster;
  onZoom: (cluster: PointCluster) => void;
}) {
  const { colors } = useTheme();
  const t = useT();
  const tracking = useMarkerTracking();
  const onPress = useCallback(() => onZoom(cluster), [onZoom, cluster]);
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

/**
 * One listing's price bubble in points mode.
 *
 * A wrapper purely so the bubble's props are stable: the cluster objects come
 * from a useMemo, so passing the feature down and building the handler here
 * means a marker only re-renders when its own listing changes — not every
 * time somebody types a letter into the search box above the map.
 */
const PointMarker = memo(function PointMarker({
  feature,
  label,
  onPress,
}: {
  feature: MapPointFeature;
  label: string;
  onPress: (listingId: string) => void;
}) {
  const handlePress = useCallback(
    () => onPress(feature.listingId),
    [onPress, feature.listingId],
  );

  return (
    <PriceMarker
      latitude={feature.centroid.coordinates[1]}
      longitude={feature.centroid.coordinates[0]}
      label={label}
      onPress={handlePress}
    />
  );
});

const PriceMarker = memo(function PriceMarker({
  latitude,
  longitude,
  label,
  sublabel,
  badge,
  onPress,
}: {
  // Two numbers rather than a LatLng: a fresh object here is a fresh prop,
  // and a fresh prop is a marker that re-renders whenever anything on the
  // screen does. Everything a marker receives has to compare by value.
  latitude: number;
  longitude: number;
  label: string;
  /** Second, smaller line (e.g. "80 m² · 3 xona") — shown when zoomed in. */
  sublabel?: string;
  /** How many listings this one bubble stands for, when it is more than one. */
  badge?: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const coordinate = useMemo(
    () => ({ latitude, longitude }),
    [latitude, longitude],
  );
  // A marker with custom children that starts at tracksViewChanges={false}
  // renders blank on Android — it is snapshotted before its child lays out.
  // Tracking stays on until that first layout, then off so panning is smooth.
  const tracking = useMarkerTracking();

  // EXPLICIT width, like the cluster circle (which never clipped): letting
  // the bubble size itself from its text is what cut bubbles to "$5" on
  // Android — the snapshot is measured narrower than the text renders,
  // especially with the OS font scale up. Fixed metrics make the bitmap
  // deterministic; allowFontScaling=false keeps the estimate honest.
  // The count rides at the right end of the pill, in a disc of its own. Room
  // is reserved for it in the width rather than hung off the corner: the
  // marker is anchored by its centre, and a badge outside the canvas would
  // shift the whole bubble off the point it is marking.
  const badgeSpace = badge ? 26 : 0;
  const width =
    Math.ceil(
      Math.max(label.length * 9.2, (sublabel?.length ?? 0) * 6.4) + 28,
    ) + badgeSpace;
  const height = sublabel ? 46 : 33;
  /** Text centres over the pill MINUS the badge, so it does not sit crooked. */
  const textCenter = (width + 4 - badgeSpace) / 2;

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
            x={textCenter}
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
              x={textCenter}
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
          {badge ? (
            <>
              <Circle
                cx={width + 4 - badgeSpace / 2 - 3}
                cy={(height + 4) / 2}
                r={11}
                fill="#FFFFFF"
              />
              <SvgText
                x={width + 4 - badgeSpace / 2 - 3}
                y={(height + 4) / 2}
                fill={colors.primary}
                fontSize={12}
                fontWeight="bold"
                textAnchor="middle"
                alignmentBaseline="central"
              >
                {badge}
              </SvgText>
            </>
          ) : null}
        </Svg>
      </View>
    </Marker>
  );
});

/**
 * The search circle's centre. A ring with a dot rather than a teardrop pin:
 * the point of it is which spot the distance is measured from, and a pin's tip
 * sits somewhere other than where the pin appears to be.
 *
 * Grows a grab collar while editable, which is the only affordance saying the
 * thing can be dragged at all.
 */
const RadiusCenterPin = memo(function RadiusCenterPin({
  color,
  editable,
}: {
  color: string;
  editable: boolean;
}) {
  const size = editable ? 34 : 22;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: withAlpha(color, editable ? 0.22 : 0),
        borderWidth: editable ? 1 : 0,
        borderColor: withAlpha(color, 0.5),
      }}
    >
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: color,
          borderWidth: 3,
          borderColor: "#FFFFFF",
        }}
      />
    </View>
  );
});
