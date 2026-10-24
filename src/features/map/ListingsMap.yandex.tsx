// src/features/map/ListingsMap.yandex.tsx
// The browse map: parcels, price bubbles, clusters and the search circle.
import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { StyleSheet, View } from "react-native";
import {
  Circle,
  Marker,
  Polygon,
  YandexMapView,
  type CameraPositionChangeEvent,
  type MapPressEvent,
  type MarkerDragEvent,
  type YandexMapViewRef,
} from "expo-yandex-mapkit";
// Aliased: react-native-svg and MapKit both export a Circle, and the two mean
// very different things here — one is a shape in a marker's artwork, the
// other is the search radius on the ground.
import Svg, {
  Circle as SvgCircle,
  Polygon as SvgPolygon,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { fonts, sizing, spacing } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import {
  ViewportResponse,
  BBox,
  MapPointFeature,
  MapPolygonFeature,
} from "../listings/api/listings.api";
import {
  animateToRegion,
  isDrawableRing,
  logoPadding,
  regionToCamera,
  ringToLatLngs,
  visibleRegionToRegion,
  toLatLng,
  toPosition,
  radiusRegion,
  regionToViewport,
  withAlpha,
  TASHKENT_REGION,
  type Region,
} from "./maps";
import { usePriceFormatter, useSpecsFormatter } from "../listings/utils/format";
import { MapIconButton } from "./MapIconButton";
import { MAP_TYPE } from "./mapLayer";
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
   * Room to leave at the TOP for the same reason — on the home tab the
   * search box, the purpose chips and the category row all float over the
   * map's own top-right controls, which would otherwise sit underneath them.
   */
  topInset?: number;
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

/**
 * Where the browse map opens. A module constant rather than a value built in
 * the render: `cameraPosition` is a controlled prop, so a fresh object on
 * every render is a camera that keeps being told where to go while the
 * reader is panning it somewhere else.
 */
const OPENING_CAMERA = regionToCamera(TASHKENT_REGION);

/** Hard ceiling on live map views: every feature is a native placemark (and
 *  often a polygon), and past a couple hundred iOS kills the app for memory
 *  long before the map becomes unusable for any other reason. */
const MAX_RENDERED_FEATURES = 120;

/**
 * How long after tapping a polygon or its price bubble the map's own press —
 * and any camera settle — is treated as part of that same tap.
 *
 * Every provider this app has run on delivers the map press alongside the
 * overlay's, and selecting a listing then clearing the selection in the same
 * tap left the map looking dead exactly where it had something to show.
 * MapKit offers `handled` on a shape to stop the fall-through, but this
 * window also covers the camera nudge a marker press causes on Android,
 * which no `handled` flag reaches — so the window stays and is the one
 * mechanism, rather than two half-covering each other.
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
      topInset = 0,
      onSelectionChange,
      circle,
      onCircleMove,
      onToggleRadius,
      radiusActive,
    },
    ref,
  ) {
    const mapRef = useRef<YandexMapViewRef>(null);
    // The zoom buttons need the current camera, and the map has no synchronous
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
        animateToRegion(
          mapRef.current,
          { latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
          600,
        );
      },
      fitRadius: (center, radiusM) => {
        animateToRegion(
          mapRef.current,
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
      (e: { nativeEvent: MapPressEvent }) => {
        if (circle?.editable && onCircleMove) {
          // A marker press arrives as a map press too (the same fall-through
          // the grace window exists for), and tapping a price bubble must not
          // quietly move the centre somewhere else.
          if (Date.now() - overlayPressedAt.current < OVERLAY_PRESS_GRACE_MS)
            return;
          onCircleMove(toPosition(e.nativeEvent.point));
          return;
        }
        clearSelection();
      },
      [circle?.editable, onCircleMove, clearSelection],
    );

    const handleCenterDragEnd = useCallback(
      (e: { nativeEvent: MarkerDragEvent }) => {
        onCircleMove?.(toPosition(e.nativeEvent.point));
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

    // The listings fetch is driven by the camera settling. Whether the first
    // settle is reported on load varies, so the loaded map reports its own
    // opening region if nothing has yet — never twice.
    //
    // Driven off onCameraPositionChanged rather than the library's
    // onRegionChangeComplete alias — see visibleRegionToRegion in maps.ts for
    // why that prop cannot be used. `finished` is read synchronously, before
    // the promise, which is exactly the bug being avoided.
    const reportedRef = useRef(false);
    const onCameraChanged = useCallback(
      (e: { nativeEvent: CameraPositionChangeEvent }) => {
        if (!e.nativeEvent.finished) return;
        mapRef.current
          ?.getVisibleRegion()
          .then((visible) => {
            if (!visible) return;
            reportedRef.current = true;
            handleRegionChangeComplete(visibleRegionToRegion(visible));
          })
          .catch(() => {});
      },
      [handleRegionChangeComplete],
    );
    const onMapLoaded = useCallback(() => {
      if (!reportedRef.current) handleRegionChangeComplete(regionRef.current);
    }, [handleRegionChangeComplete]);

    // Halving the spans is one conventional zoom step in; doubling is one out.
    const zoomBy = useCallback((factor: number) => {
      const region = regionRef.current;
      animateToRegion(
        mapRef.current,
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
      animateToRegion(
        mapRef.current,
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
      animateToRegion(
        mapRef.current,
        {
          latitude: pos.latitude,
          longitude: pos.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        600,
      );
      // camera settle → onCameraChanged → nearby listings fetch automatically
    }, [locate]);

    return (
      <View style={{ flex: 1 }}>
        <YandexMapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          mapType={MAP_TYPE}
          // The opening camera only — a module constant, so this object is
          // built once and never fights the reader for the camera after.
          cameraPosition={OPENING_CAMERA}
          showUserPosition
          // Bottom-LEFT: the zoom / layer / radius stack owns the top right,
          // and the locate button the bottom right. See MAP_LOGO_RULE in
          // maps.ts — MapKit always draws it and it may not be covered.
          logoPosition={{ horizontal: "left", vertical: "bottom" }}
          // bottomInset alone is not enough: it reserves the strip the
          // screen floats its OWN chrome in (the "Topildi: N" count sits
          // bottom-left, exactly where the logo lands), so the logo has to
          // clear that pill too rather than share the corner with it.
          logoPadding={logoPadding(
            spacing.md,
            bottomInset + sizing.controlMd + spacing.md,
          )}
          onCameraPositionChanged={onCameraChanged}
          onMapLoaded={onMapLoaded}
          onMapPress={handleMapPress}
        >
          {/* Every parcel draws its own outline; the bubbles are grouped, so
              two listings at one address cannot hide behind each other. */}
          {data?.mode === "polygons" ? (
            <ParcelOutlines
              features={data.features.slice(0, MAX_RENDERED_FEATURES)}
              onSelect={selectFeature}
            />
          ) : null}

          {/* Over the parcels it is narrowing rather than under them. */}
          {circle && circle.radiusM != null ? (
            <RadiusRing
              center={circle.center}
              radiusM={circle.radiusM}
              color={colors.primary}
            />
          ) : null}

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

          {/* Last, so the centre sits over everything it is measuring from.
              Keyed on editable: the pin changes size when it gains its grab
              collar, and Android draws annotations from a bitmap taken once. */}
          {circle ? (
            <Marker
              // Keyed on editable: the pin changes size when it gains its
              // grab collar, and MapKit snapshots a marker's children to a
              // bitmap — a remount is what makes it take a fresh one.
              key={circle.editable ? "center-edit" : "center"}
              point={toLatLng(circle.center)}
              anchor={{ x: 0.5, y: 0.5 }}
              draggable={!!circle.editable}
              onDragEnd={handleCenterDragEnd}
            >
              <RadiusCenterPin
                color={colors.primary}
                editable={!!circle.editable}
              />
            </Marker>
          ) : null}
        </YandexMapView>

        {/* Zoom pair, top-right. The locate button keeps the bottom corner —
            it pairs with the blue you-are-here dot rather than with the
            camera. */}
        <View
          style={{
            position: "absolute",
            top: topInset + spacing.md,
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
          {/* Separated from the zoom pair by their own gap — they change what
              the map is showing, not where the camera is. */}
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
 * Every parcel's boundary.
 *
 * Drawn per listing even where several share a spot — the outlines are what
 * distinguishes them, and two plots that overlap on screen still have
 * different edges. Only their PRICE BUBBLES merge (see BubbleGroup), because
 * two bubbles at one point are just one bubble with the other hidden behind.
 *
 * One <Polygon> each rather than a single GeoJSON source, which is what
 * MapKit offers — and it means a tap arrives already knowing which listing
 * it hit, instead of carrying an id to look back up.
 */
const ParcelOutlines = memo(function ParcelOutlines({
  features,
  onSelect,
}: {
  features: MapPolygonFeature[];
  /** Takes the feature, so the parent can hand down one stable callback. */
  onSelect: (feature: MapPolygonFeature) => void;
}) {
  return (
    <>
      {features.map((feature) => (
        <ParcelOutline key={feature.id} feature={feature} onSelect={onSelect} />
      ))}
    </>
  );
});

/**
 * One parcel's outline.
 *
 * Its own component purely so the press handler is stable per parcel: built
 * inline in the map above, every outline would get a fresh closure on every
 * render of the screen and none of them could be skipped.
 *
 * Renders nothing when the ring is unusable or absent (PIN listings carry no
 * boundary at all) — the bubble still places the listing on the map, which
 * beats it vanishing entirely.
 */
const ParcelOutline = memo(function ParcelOutline({
  feature,
  onSelect,
}: {
  feature: MapPolygonFeature;
  onSelect: (feature: MapPolygonFeature) => void;
}) {
  const { colors } = useTheme();
  const ring = feature.geom?.coordinates[0];

  const points = useMemo(
    () => (isDrawableRing(ring) ? ringToLatLngs(ring) : null),
    [ring],
  );
  const onPress = useCallback(() => onSelect(feature), [onSelect, feature]);

  if (!points) return null;

  return (
    <Polygon
      points={points}
      fillColor={withAlpha(colors.primary, 0.35)}
      strokeColor={colors.primary}
      strokeWidth={2}
      onPress={onPress}
    />
  );
});

/** The search radius, in metres on the ground. */
const RadiusRing = memo(function RadiusRing({
  center,
  radiusM,
  color,
}: {
  center: [number, number];
  radiusM: number;
  color: string;
}) {
  // A real circle in metres, not the 64-sided polygon the previous renderer
  // needed: MapKit measures the radius on the ground, so it stays round at
  // every zoom and stays the right size this far from the equator.
  return (
    <Circle
      center={toLatLng(center)}
      radius={radiusM}
      fillColor={withAlpha(color, 0.14)}
      strokeColor={color}
      strokeWidth={2}
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
      hasVideo={feature.hasVideo}
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
  const onPress = useCallback(() => onZoom(cluster), [onZoom, cluster]);
  // Bigger circles for bigger neighbourhoods, gently.
  const size = Math.min(56, 38 + Math.floor(Math.log10(cluster.count) * 12));

  return (
    <Marker
      point={{ latitude: cluster.latitude, longitude: cluster.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={onPress}
      identifier={cluster.key}
      // The circle is fixed once its count is known, so MapKit takes one
      // bitmap of these children instead of re-snapshotting every render.
      tracksViewChanges={false}
    >
      {/* SVG, as before: one surface that draws its own pixels, crisp at any
          size and identical on both platforms. */}
      <View collapsable={false} style={{ width: size + 6, height: size + 6 }}>
        <Svg width={size + 6} height={size + 6}>
          <SvgCircle
            cx={(size + 6) / 2}
            cy={(size + 6) / 2}
            r={(size + 6) / 2}
            fill={colors.onPrimary}
          />
          <SvgCircle
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
            fontFamily={fonts["700"]}
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
      hasVideo={feature.hasVideo}
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
  hasVideo,
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
  /** Draws a camera at the head of the pill: this listing has a walkthrough. */
  hasVideo?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  // A fresh object here is a fresh prop, and a fresh prop is a marker that
  // re-renders whenever anything on the screen does — hence the two loose
  // numbers above and this one memo.
  const point = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);

  // EXPLICIT width, like the cluster circle (which never clipped): letting
  // the bubble size itself from its text is what cut bubbles to "$5" on
  // Android — the snapshot is measured narrower than the text renders,
  // especially with the OS font scale up. Fixed metrics make the bitmap
  // deterministic; allowFontScaling=false keeps the estimate honest.
  //
  // Still true under MapKit, and for the same reason: `tracksViewChanges`
  // exists on <Marker> precisely because these children are snapshotted to a
  // bitmap placemark icon, exactly as the previous renderer did it. Do not
  // "simplify" any of this back to auto-sizing.
  // The count rides at the right end of the pill, in a disc of its own. Room
  // is reserved for it in the width rather than hung off the corner: the
  // marker is anchored by its centre, and a badge outside the canvas would
  // shift the whole bubble off the point it is marking.
  const badgeSpace = badge ? 26 : 0;
  // The camera gets reserved width for the same reason the count does: the
  // marker is anchored by its centre, so anything hung outside the canvas
  // would shift the whole bubble off the point it marks.
  const videoSpace = hasVideo ? 17 : 0;
  const width =
    Math.ceil(
      Math.max(label.length * 9.2, (sublabel?.length ?? 0) * 6.4) + 28,
    ) +
    badgeSpace +
    videoSpace;
  const height = sublabel ? 46 : 33;
  /** Text centres over the pill MINUS the badge, so it does not sit crooked. */
  const textCenter = (width + 4 - badgeSpace + videoSpace) / 2;

  return (
    <Marker
      point={point}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      // The pill's artwork is fully determined by the props above, so one
      // snapshot is all it will ever need. Left at its `true` default, every
      // bubble on screen would re-snapshot on every render of the map.
      tracksViewChanges={false}
    >
      {/* Same SVG rationale as the cluster. */}
      <View
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
            fill={colors.onPrimary}
            fontSize={15}
            fontFamily={fonts["700"]}
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
              fill={colors.onPrimary}
              fontSize={10.5}
              fontFamily={fonts["600"]}
              fontWeight="600"
              opacity={0.92}
              textAnchor="middle"
              alignmentBaseline="central"
            >
              {sublabel}
            </SvgText>
          ) : null}
          {/* A camera, drawn rather than set in a font: these children are
              snapshotted to a bitmap placemark icon, and an icon font is the
              one thing that does not reliably survive that on Android. Body
              plus lens, which is all a video camera needs to be legible at
              nine pixels. */}
          {hasVideo ? (
            <>
              <Rect
                x={12}
                y={(height + 4) / 2 - 4.5}
                width={10}
                height={9}
                rx={2.5}
                fill={colors.onPrimary}
              />
              <SvgPolygon
                points={`${23},${(height + 4) / 2 - 4} ${27.5},${
                  (height + 4) / 2 - 6
                } ${27.5},${(height + 4) / 2 + 6} ${23},${(height + 4) / 2 + 4}`}
                fill={colors.onPrimary}
              />
            </>
          ) : null}
          {badge ? (
            <>
              <SvgCircle
                cx={width + 4 - badgeSpace / 2 - 3}
                cy={(height + 4) / 2}
                r={11}
                fill={colors.surface}
              />
              <SvgText
                x={width + 4 - badgeSpace / 2 - 3}
                y={(height + 4) / 2}
                fill={colors.primary}
                fontSize={12}
                fontFamily={fonts["700"]}
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
      collapsable={false}
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
