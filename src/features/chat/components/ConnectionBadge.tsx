// src/features/chat/components/ConnectionBadge.tsx
import { memo } from "react";
import { View } from "react-native";
import Animated, { ZoomIn, useReducedMotion } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { radii } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT } from "../../../i18n";
import { PulseHalo } from "../../../components/ui/PulseHalo";
import { useConnectionStatus } from "../hooks/useConnectionStatus";

// Distinct shapes, not just colours, so the state still reads for anyone who
// can't tell green from red: a live dot, a spinner arrow, a struck cloud.
const ICONS = {
  online: "radio-button-on",
  connecting: "sync-outline",
  offline: "cloud-offline-outline",
} as const;

const SIZE = 34;

// Each state moves the way it means: online breathes (the halo), connecting
// turns, offline shakes once — a nudge that something needs attention, not a
// loop that nags for as long as the signal is gone.
const SPIN = {
  animationName: {
    from: { transform: [{ rotate: "0deg" }] },
    to: { transform: [{ rotate: "360deg" }] },
  },
  animationDuration: "1.1s",
  animationTimingFunction: "linear",
  animationIterationCount: "infinite",
} as const;

const SHAKE = {
  animationName: {
    "0%": { transform: [{ translateX: 0 }] },
    "20%": { transform: [{ translateX: -3 }] },
    "40%": { transform: [{ translateX: 3 }] },
    "60%": { transform: [{ translateX: -2 }] },
    "80%": { transform: [{ translateX: 2 }] },
    "100%": { transform: [{ translateX: 0 }] },
  },
  animationDuration: "0.45s",
  animationIterationCount: 1,
} as const;

/**
 * Icon-only status for the top of a screen: whether other people currently
 * see you as online. The words live in the accessibility label, so screen
 * readers still announce "onlayn" / "oflayn". Hidden for guests.
 */
export const ConnectionBadge = memo(function ConnectionBadge() {
  const status = useConnectionStatus();
  const { colors } = useTheme();
  const t = useT();
  const reduceMotion = useReducedMotion();
  if (!status) return null;

  const tone =
    status === "online"
      ? {
          fg: colors.success,
          bg: colors.successSurface,
          border: colors.successBorder,
        }
      : status === "offline"
        ? {
            fg: colors.danger,
            bg: colors.dangerSurface,
            border: colors.dangerBorder,
          }
        : {
            fg: colors.textMuted,
            bg: colors.surfaceRaised,
            border: colors.border,
          };

  const motion = reduceMotion
    ? null
    : status === "connecting"
      ? SPIN
      : status === "offline"
        ? SHAKE
        : null;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t(`chat.${status}`)}
      style={{
        width: SIZE,
        height: SIZE,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {status === "online" ? (
        <PulseHalo size={SIZE} color={colors.success} />
      ) : null}
      {/* Keyed on the state so every change remounts it: the new icon pops in
          (entering only — see Toast for why exit animations are avoided). */}
      <Animated.View
        key={status}
        entering={reduceMotion ? undefined : ZoomIn.springify().damping(14)}
        style={[
          {
            width: SIZE,
            height: SIZE,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: tone.border,
            backgroundColor: tone.bg,
          },
          status === "offline" ? motion : null,
        ]}
      >
        <Animated.View style={status === "connecting" ? motion : null}>
          <Ionicons name={ICONS[status]} size={18} color={tone.fg} />
        </Animated.View>
      </Animated.View>
    </View>
  );
});
