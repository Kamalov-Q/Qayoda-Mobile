// src/features/map/MapUnavailable.tsx
// Stands in for a map in a binary without Yandex MapKit (Expo Go). Says what
// it is rather than leaving a blank frame — see mapSupport.ts.
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../components/ui";
import { spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";

interface Props {
  /** Fixed-height previews pass theirs; full-screen maps fill. */
  height?: number;
  /** Full-screen pickers have no other way out. */
  onCancel?: () => void;
}

export function MapUnavailable({ height, onCancel }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        ...(height ? { height } : { flex: 1 }),
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.md,
        padding: spacing.lg,
        backgroundColor: colors.surfaceSunken,
      }}
    >
      <Ionicons name="map-outline" size={28} color={colors.textFaint} />
      <Text
        style={{ ...type.caption, color: colors.textMuted, textAlign: "center" }}
      >
        {t("map.unavailableNative")}
      </Text>
      {onCancel ? (
        <View
          style={{
            position: "absolute",
            left: spacing.lg,
            right: spacing.lg,
            bottom: insets.bottom + spacing.lg,
          }}
        >
          <Button title={t("common.cancel")} variant="secondary" onPress={onCancel} />
        </View>
      ) : null}
    </View>
  );
}
