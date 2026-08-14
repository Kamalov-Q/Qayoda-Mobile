// src/features/map/MiniLocationMap.tsx
// A framed preview of where the user is, for the profile screen.
import { useCallback, useState } from "react";
import { View, Text } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import { Button } from "../../components/ui/Button";
import { useMyLocation, type Coords } from "../listings/hooks/useMyLocation";
import { MyLocationButton } from "./MyLocationButton";
import { useMarkerTracking } from "./useMarkerTracking";

/** Tall enough to place a neighbourhood, short enough to stay a card. */
const HEIGHT = 170;

/** A couple of blocks across — a city-wide view would say nothing. */
const SPAN = 0.008;

export function MiniLocationMap() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const { locate, loading } = useMyLocation();
  const { colors } = useTheme();
  const t = useT();

  // Nothing is requested on mount: opening the profile tab is not consent, and
  // a permission sheet nobody asked for is the fastest way to get denied
  // permanently. The frame asks first, then locates.
  const onLocate = useCallback(async () => {
    const position = await locate();
    if (position) setCoords(position);
  }, [locate]);

  if (!coords) {
    return (
      <View
        style={{
          height: HEIGHT,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          padding: spacing.lg,
          backgroundColor: colors.surfaceSunken,
        }}
      >
        <Ionicons name="location-outline" size={26} color={colors.textFaint} />
        <Text
          style={{
            ...type.caption,
            color: colors.textMuted,
            textAlign: "center",
          }}
        >
          {t("location.previewHint")}
        </Text>
        <Button
          title={t("location.show")}
          icon="locate"
          variant="secondary"
          size="sm"
          loading={loading}
          onPress={onLocate}
        />
      </View>
    );
  }

  return (
    <View style={{ height: HEIGHT }}>
      <MapView
        style={{ flex: 1 }}
        provider={PROVIDER_DEFAULT}
        // Controlled region, so re-locating recentres the frame. Gestures are
        // off: this is a preview, and a map that pans inside a scrolling
        // settings list fights the scroll.
        region={{
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: SPAN,
          longitudeDelta: SPAN,
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

      <MyLocationButton
        onPress={onLocate}
        loading={loading}
        bottomOffset={spacing.sm}
      />
    </View>
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
