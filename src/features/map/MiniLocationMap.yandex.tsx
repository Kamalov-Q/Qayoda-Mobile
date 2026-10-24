// src/features/map/MiniLocationMap.yandex.tsx
// "My location" card for the profile screen: a compact ask-first state, then a
// tappable map preview that opens a full-screen interactive map.
import { useCallback, useMemo, useRef, useState } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import {
  Marker,
  YandexMapView,
  type YandexMapViewRef,
} from "expo-yandex-mapkit";
import {
  useSafeAreaInsets,
  type EdgeInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useLanguage, useT } from "../../i18n";
import { Button } from "../../components/ui/Button";
import { useMyLocation, type Coords } from "../listings/hooks/useMyLocation";
import { MapIconButton } from "./MapIconButton";
import { MAP_TYPE } from "./mapLayer";
import { reverseGeocode } from "./geocoder";
import {
  animateToRegion,
  logoPadding,
  regionToCamera,
  useInitialCamera,
  visibleRegionToRegion,
  type Region,
} from "./maps";

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
  const language = useLanguage();
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
    // decorative. Best-effort by construction: reverseGeocode never throws,
    // and a miss just leaves the line off. Yandex rather than the device
    // geocoder, so the address comes back in the app's language instead of
    // the OS's — see geocoder.ts.
    setAddressLine(await reverseGeocode(position, language));
  }, [locate, language]);

  /** Controlled: re-locating moves the preview to the new spot. */
  const previewCamera = useMemo(
    () =>
      coords
        ? regionToCamera({
            ...coords,
            latitudeDelta: PREVIEW_SPAN,
            longitudeDelta: PREVIEW_SPAN,
          })
        : null,
    [coords],
  );

  // --- Ask-first state: a compact row, not a dead grey slab -----------------
  if (!coords || !previewCamera) {
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
        {/* Touches are blocked by THIS wrapper, never by a pointerEvents on
              the map itself. See MAP_STYLE_RULE in maps.ts. */}
        <View style={{ flex: 1, pointerEvents: "none" }}>
          <YandexMapView
            // The preview is a picture: interactiveDisabled takes the map out
            // of the gesture chain entirely, so the settings list keeps its
            // scroll and every touch falls through to the Pressable that
            // opens the real, fully interactive map.
            style={{ flex: 1 }}
            mapType={MAP_TYPE}
            cameraPosition={previewCamera}
            interactiveDisabled
            logoPosition={{ horizontal: "left", vertical: "bottom" }}
          >
            <LocationDot coords={coords} />
          </YandexMapView>
        </View>

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
  const mapRef = useRef<YandexMapViewRef>(null);
  const initialRegion: Region = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    latitudeDelta: FULL_SPAN,
    longitudeDelta: FULL_SPAN,
  };
  const regionRef = useRef<Region>(initialRegion);
  const fullCamera = useInitialCamera(initialRegion);

  const zoomBy = (factor: number) => {
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
  };

  const recenter = () => {
    onRelocate();
    animateToRegion(mapRef.current, { ...initialRegion, ...coords }, 400);
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
            {t("location.myLocation")}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          {/* Only while shown: the modal itself stays mounted (iOS dismissal
              race), but a hidden live map — with user-location tracking on —
              kept rendering behind the settings screen and made its back
              button stutter after any location action. */}
          {visible ? (
            <YandexMapView
              ref={mapRef}
              style={{ flex: 1 }}
              mapType={MAP_TYPE}
              cameraPosition={fullCamera}
              showUserPosition
              logoPosition={{ horizontal: "left", vertical: "bottom" }}
              logoPadding={logoPadding(
                spacing.md,
                insets.bottom + spacing.md,
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
              <LocationDot coords={coords} />
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

  return (
    <Marker
      point={coords}
      anchor={{ x: 0.5, y: 0.5 }}
      // Fixed artwork: snapshot it once rather than on every render.
      tracksViewChanges={false}
    >
      <View
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
