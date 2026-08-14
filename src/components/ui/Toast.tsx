// Toasts. Backed by a store rather than context so they can be fired from
// anywhere — mutation callbacks, the api client, plain modules — with the same
// call the screens use.
import { memo, useEffect } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { create } from "zustand";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { spacing, radii, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT, type TranslationKey, type TranslationParams } from "../../i18n";

export type ToastType = "success" | "error" | "info";

/**
 * Message content is stored unresolved when it comes from the dictionary, so a
 * toast that is on screen when the user switches language re-renders in the
 * new one. Server strings have no key and are shown verbatim.
 */
type Content =
  | { kind: "text"; text: string }
  | { kind: "key"; key: TranslationKey; params?: TranslationParams };

interface ToastItem {
  id: number;
  type: ToastType;
  content: Content;
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
}

// Newest first, capped — a burst of failures should not paper over the screen.
const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 3200;
let nextId = 0;

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) =>
    set((s) => ({ toasts: [{ ...toast, id: nextId++ }, ...s.toasts].slice(0, MAX_VISIBLE) })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

function haptic(type: ToastType) {
  if (Platform.OS === "web") return;
  const style =
    type === "success"
      ? Haptics.NotificationFeedbackType.Success
      : type === "error"
        ? Haptics.NotificationFeedbackType.Error
        : Haptics.NotificationFeedbackType.Warning;
  Haptics.notificationAsync(style).catch(() => {});
}

function push(content: Content, type: ToastType, duration = DEFAULT_DURATION) {
  haptic(type);
  useToastStore.getState().push({ type, content, duration });
}

/**
 * Fire a toast from anywhere. `.t()` variants take a dictionary key and stay
 * translated; the plain variants take an already-resolved string (server
 * errors, interpolated values).
 */
export const toast = {
  success: (text: string) => push({ kind: "text", text }, "success"),
  error: (text: string) => push({ kind: "text", text }, "error"),
  info: (text: string) => push({ kind: "text", text }, "info"),
  successKey: (key: TranslationKey, params?: TranslationParams) =>
    push({ kind: "key", key, params }, "success"),
  errorKey: (key: TranslationKey, params?: TranslationParams) =>
    push({ kind: "key", key, params }, "error"),
  infoKey: (key: TranslationKey, params?: TranslationParams) =>
    push({ kind: "key", key, params }, "info"),
};

/** Mounted once, at the root, above the navigator. */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: insets.top + spacing.sm,
        left: spacing.md,
        right: spacing.md,
        gap: spacing.sm,
        // Absolute + box-none so the strip never blocks taps on the screen
        // underneath — only the cards themselves are touchable. This lives in
        // `style`; the `pointerEvents` prop is deprecated in RN 0.81.
        pointerEvents: "box-none",
      }}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </View>
  );
}

const ToastCard = memo(function ToastCard({ toast: item }: { toast: ToastItem }) {
  const { colors, shadow } = useTheme();
  const dismiss = useToastStore((s) => s.dismiss);
  const t = useT();

  useEffect(() => {
    const timer = setTimeout(() => dismiss(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, dismiss]);

  const accent =
    item.type === "success"
      ? colors.success
      : item.type === "error"
        ? colors.danger
        : colors.primary;

  const icon =
    item.type === "success"
      ? "checkmark-circle"
      : item.type === "error"
        ? "alert-circle"
        : "information-circle";

  const message =
    item.content.kind === "text"
      ? item.content.text
      : t(item.content.key, item.content.params);

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(18)}
      exiting={FadeOutUp.duration(180)}
      layout={LinearTransition.springify().damping(18)}
    >
      <Pressable
        onPress={() => dismiss(item.id)}
        accessibilityRole="alert"
        accessibilityLabel={message}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.border,
          // Colour lives in a leading rail rather than the whole fill, so the
          // text keeps body contrast in both schemes.
          borderLeftWidth: 4,
          borderLeftColor: accent,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          ...shadow.raised,
        }}
      >
        <Ionicons name={icon} size={20} color={accent} />
        <Text style={{ ...type.body, color: colors.text, flex: 1 }} numberOfLines={3}>
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );
});
