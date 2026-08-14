// src/features/map/PolygonEditor.web.tsx
// Web stub. react-native-maps' web entry is react-native-web's
// UnimplementedView — MapView renders an empty grey box and Polygon/Marker do
// nothing — so the editor would silently be an inert rectangle on web. This
// platform extension says so instead. A real web editor means a separate
// implementation (@vis.gl/react-google-maps or similar), not a prop tweak.
import { View, Text } from "react-native";
import { spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";

interface Props {
  value: [number, number][];
  onChange: (points: [number, number][]) => void;
  center?: [number, number];
}

export function PolygonEditor(_props: Props) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
      }}
    >
      <Text
        style={{ ...type.body, color: colors.textMuted, textAlign: "center" }}
      >
        {t("map.unavailableWeb")}
      </Text>
    </View>
  );
}

export default PolygonEditor;
