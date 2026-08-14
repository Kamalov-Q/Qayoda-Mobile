// src/features/map/MiniLocationMap.web.tsx
// Web stub — react-native-maps renders an empty grey box there, so the frame
// says what it is instead of pretending to be a map. See ListingsMap.web.tsx.
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";

const HEIGHT = 170;

export function MiniLocationMap() {
  const { colors } = useTheme();
  const t = useT();

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
        style={{ ...type.caption, color: colors.textMuted, textAlign: "center" }}
      >
        {t("map.unavailableWeb")}
      </Text>
    </View>
  );
}

export default MiniLocationMap;
