// src/features/map/PolygonPicker.tsx
// Full-screen drawing page around PolygonEditor (app/add/draw.tsx). Holds the
// draft ring so a cancel leaves the caller's value untouched, and lazy-loads
// the editor so the map only mounts once the page opens.
//
// A screen, not a <Modal>: inside a React Native Modal the map took no pan or
// pinch at all on the new architecture — the same map on an ordinary screen
// (the browse tab) moves fine.
import { Suspense, lazy, useState } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../components/ui";
import { spacing, radii, sizing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import {
  MIN_POLYGON_POINTS,
  dedupeRing,
  formatAreaM2,
  polygonAreaM2,
  ringSelfIntersects,
} from "../listings/utils/geo";

const PolygonEditor = lazy(() => import("./PolygonEditor"));

interface Props {
  /** Ring to reopen for editing; empty starts a new one. */
  initial: [number, number][];
  onCancel: () => void;
  onSave: (points: [number, number][]) => void;
}

export function PolygonPicker({ initial, onCancel, onSave }: Props) {
  const { colors, text, shadow } = useTheme();
  const t = useT();
  // Padding from the hook rather than a <SafeAreaView>, so the map between
  // header and footer can still run edge to edge.
  const insets = useSafeAreaInsets();
  const [points, setPoints] = useState<[number, number][]>(initial);

  const ring = dedupeRing(points);
  // Both conditions the API enforces, checked here where the shape is still on
  // screen and fixable — a rejection after submit points at nothing.
  const invalid = ringSelfIntersects(ring);
  const canSave = ring.length >= MIN_POLYGON_POINTS && !invalid;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.md,
          // Taller than a stock header: iOS parks its "back to app" pill in
          // the status bar, and the controls were sitting right under it.
          paddingTop: spacing.md,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        {/* A filled disc, not a bare word: on the drawing screen these two
              controls are the only chrome, and "Bekor qilish" as plain grey
              text read as a caption rather than a button. */}
        <Pressable
          onPress={onCancel}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          style={({ pressed }) => ({
            width: sizing.controlMd,
            height: sizing.controlMd,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          })}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={text.bodyStrong} numberOfLines={1}>
            {t("map.drawTitle")}
          </Text>
          <Text style={text.caption} numberOfLines={1}>
            {t("map.points", { count: ring.length })}
            {ring.length >= MIN_POLYGON_POINTS
              ? ` · ${formatAreaM2(polygonAreaM2(ring))}`
              : ""}
          </Text>
        </View>

        <Button
          title={t("common.save")}
          icon="checkmark"
          size="sm"
          disabled={!canSave}
          onPress={() => onSave(ring)}
          style={{ minWidth: 116, ...(canSave ? shadow.control : null) }}
        />
      </View>

      {invalid ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            backgroundColor: colors.dangerSurface,
            borderBottomWidth: 1,
            borderBottomColor: colors.dangerBorder,
          }}
        >
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={{ ...type.caption, color: colors.danger, flex: 1 }}>
            {t("map.selfIntersects")}
          </Text>
        </View>
      ) : null}

      <Suspense
        fallback={
          <View style={{ flex: 1, justifyContent: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        }
      >
        <PolygonEditor
          value={points}
          onChange={setPoints}
          center={initial[0]}
        />
      </Suspense>
    </View>
  );
}

export default PolygonPicker;
