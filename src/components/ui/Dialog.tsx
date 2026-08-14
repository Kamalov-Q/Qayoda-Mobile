// Confirmation dialogs.
//
// Not React Native's Alert: react-native-web ships `Alert.alert` as an empty
// no-op, so every confirmation silently did nothing on web and the action
// behind it never ran. This renders a real dialog on every platform, in the
// app's own theme, with translated buttons — which the OS alert could not give
// us either, since it labels its own cancel button.
//
// Store-backed like the toasts, so it can be opened from callbacks and plain
// modules rather than only from components holding a hook.
import { Modal, View, Text, Pressable } from "react-native";
import { create } from "zustand";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { spacing, radii, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT, type TranslationKey, type TranslationParams } from "../../i18n";

export interface DialogRequest {
  titleKey: TranslationKey;
  messageKey?: TranslationKey;
  params?: TranslationParams;
  confirmKey: TranslationKey;
  /** Omitted for single-button notices. */
  cancelKey?: TranslationKey;
  destructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface DialogState {
  request: DialogRequest | null;
  open: (request: DialogRequest) => void;
  close: () => void;
}

const useDialogStore = create<DialogState>((set) => ({
  request: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}));

/** Open a dialog from anywhere. */
export function showDialog(request: DialogRequest) {
  useDialogStore.getState().open(request);
}

/** Mounted once, at the root. */
export function DialogHost() {
  const request = useDialogStore((s) => s.request);
  const close = useDialogStore((s) => s.close);
  const { colors, text, shadow } = useTheme();
  const t = useT();

  if (!request) return null;

  const {
    titleKey,
    messageKey,
    params,
    confirmKey,
    cancelKey,
    destructive,
    onConfirm,
    onCancel,
  } = request;

  // Dismiss first, then act: the callback usually navigates, and leaving the
  // modal mounted across a route change strands it over the new screen.
  const dismissThen = (action?: () => void) => {
    close();
    action?.();
  };

  const accent = destructive ? colors.danger : colors.primary;

  return (
    <Modal
      visible
      transparent
      animationType="none" // reanimated drives it; the native fade double-animates
      statusBarTranslucent
      // Android hardware back and web Escape both land here.
      onRequestClose={() => dismissThen(onCancel)}
    >
      <Animated.View
        entering={FadeIn.duration(140)}
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.lg,
        }}
      >
        {/* Tapping the scrim cancels, matching the platform convention. */}
        <Pressable
          style={{ position: "absolute", inset: 0 }}
          accessibilityElementsHidden
          importantForAccessibility="no"
          onPress={() => dismissThen(onCancel)}
        />

        <Animated.View
          entering={FadeInDown.duration(180).springify().damping(20)}
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={{
            width: "100%",
            maxWidth: 400,
            backgroundColor: colors.surface,
            borderRadius: radii.xxl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            gap: spacing.lg,
            ...shadow.raised,
          }}
        >
          <View style={{ gap: spacing.sm }}>
            <Text style={text.heading}>{t(titleKey, params)}</Text>
            {messageKey ? (
              <Text style={{ ...text.body, color: colors.textMuted }}>
                {t(messageKey, params)}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {cancelKey ? (
              <DialogButton
                label={t(cancelKey)}
                onPress={() => dismissThen(onCancel)}
                color={colors.text}
                background={colors.surfaceRaised}
                border={colors.border}
              />
            ) : null}
            <DialogButton
              label={t(confirmKey)}
              onPress={() => dismissThen(onConfirm)}
              color={destructive ? colors.danger : colors.onPrimary}
              background={destructive ? colors.dangerSurface : accent}
              border={destructive ? colors.dangerBorder : accent}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function DialogButton({
  label,
  onPress,
  color,
  background,
  border,
}: {
  label: string;
  onPress: () => void;
  color: string;
  background: string;
  border: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.md,
        borderRadius: radii.md,
        backgroundColor: background,
        borderWidth: 1,
        borderColor: border,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text style={{ ...type.bodyStrong, fontSize: 16, color }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
