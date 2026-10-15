// src/features/map/MapPin.tsx
// The teardrop pin react-native-maps used to draw by default. MapLibre has no
// stock pin, so this is it — anchored at its tip ("bottom") wherever it is
// placed, so the point it marks is the point the tip touches.
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/useTheme";

export const MAP_PIN_SIZE = 40;

export function MapPin() {
  const { colors } = useTheme();
  return (
    // collapsable={false}: Android renders ViewAnnotation children to a bitmap
    // and a collapsed wrapper measures as nothing.
    <View
      collapsable={false}
      style={{ width: MAP_PIN_SIZE, height: MAP_PIN_SIZE, alignItems: "center" }}
    >
      <Ionicons name="location-sharp" size={MAP_PIN_SIZE} color={colors.primary} />
    </View>
  );
}
