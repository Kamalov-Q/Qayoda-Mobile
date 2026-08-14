// src/features/map/PolygonPickerModal.tsx
// Full-screen drawing sheet around PolygonEditor. Holds the draft ring so a
// cancel leaves the caller's value untouched, and lazy-loads the editor so the
// map is only mounted once the sheet actually opens.
import { Suspense, lazy, useState } from "react";
import { Modal, View, Text, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import {
  MIN_POLYGON_POINTS,
  formatAreaM2,
  polygonAreaM2,
} from "../listings/utils/geo";

const PolygonEditor = lazy(() => import("./PolygonEditor"));

interface Props {
  visible: boolean;
  /** Ring to reopen for editing; empty starts a new one. */
  initial: [number, number][];
  onCancel: () => void;
  onSave: (points: [number, number][]) => void;
}

export function PolygonPickerModal({
  visible,
  initial,
  onCancel,
  onSave,
}: Props) {
  const { colors } = useTheme();
  const t = useT();
  const [points, setPoints] = useState<[number, number][]>(initial);
  const canSave = points.length >= MIN_POLYGON_POINTS;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable onPress={onCancel} hitSlop={12}>
            <Text style={{ ...type.bodyStrong, color: colors.textMuted }}>
              {t("common.cancel")}
            </Text>
          </Pressable>

          <View style={{ alignItems: "center" }}>
            <Text style={{ ...type.bodyStrong, color: colors.text }}>
              {t("map.drawTitle")}
            </Text>
            <Text style={{ ...type.caption, color: colors.textMuted }}>
              {t("map.points", { count: points.length })}
              {canSave ? ` · ${formatAreaM2(polygonAreaM2(points))}` : ""}
            </Text>
          </View>

          <Pressable
            onPress={() => onSave(points)}
            disabled={!canSave}
            hitSlop={12}
          >
            <Text
              style={{
                ...type.bodyStrong,
                color: canSave ? colors.primary : colors.textFaint,
              }}
            >
              {t("common.save")}
            </Text>
          </Pressable>
        </View>

        <Suspense
          fallback={
            <View style={{ flex: 1, justifyContent: "center" }}>
              <ActivityIndicator />
            </View>
          }
        >
          <PolygonEditor
            value={points}
            onChange={setPoints}
            center={initial[0]}
          />
        </Suspense>
      </SafeAreaView>
    </Modal>
  );
}

export default PolygonPickerModal;
