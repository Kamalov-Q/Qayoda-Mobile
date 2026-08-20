// src/features/map/ListingsMap.web.tsx
// Web stub, same contract as the native map. react-native-maps' web entry is
// react-native-web's UnimplementedView — MapView renders an empty grey box and
// Marker/Polygon do nothing — so on web the strip would be a dead rectangle
// that still looked like a map. This says what it is instead. A real web map
// means a separate implementation (@vis.gl/react-google-maps or similar).
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import { ViewportResponse, BBox } from "../listings/api/listings.api";

export interface ListingsMapHandle {
  animateTo: (lat: number, lng: number) => void;
}

interface Props {
  data: ViewportResponse | undefined;
  onRegionChange: (bbox: BBox, zoom: number) => void;
  onPressListing: (id: string) => void;
}

export function ListingsMap(_props: Props) {
  const { colors } = useTheme();
  const t = useT();

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        padding: spacing.lg,
        backgroundColor: colors.surfaceSunken,
      }}
    >
      <Ionicons name="map-outline" size={28} color={colors.textFaint} />
      <Text
        style={{ ...type.caption, color: colors.textMuted, textAlign: "center" }}
      >
        {t("map.unavailableWeb")}
      </Text>
    </View>
  );
}

export default ListingsMap;
