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

  // Dismiss first, then act: the callback usually navigates, and an open
  // modal across a route change strands it over the new screen.
  const dismissThen = (action?: () => void) => {
    close();
    action?.();
  };

  const accent = request?.destructive ? colors.danger : colors.primary;

  return (
    // The Modal stays MOUNTED and is driven by `visible` — unmounting a
    // transparent modal mid-dismissal is an iOS race that leaves the dead
    // modal host eating touches (unresponsive back buttons after an archive
    // or logout confirm). Native fade replaces the reanimated entering
    // animations, which with a persistent mount would only fire once.
    <Modal
      visible={request !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Android hardware back and web Escape both land here.
      onRequestClose={() => dismissThen(request?.onCancel)}
    >
      {request === null ? null : (
      <View
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
          onPress={() => dismissThen(request.onCancel)}
        />

        <View
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
            <Text style={text.heading}>{t(request.titleKey, request.params)}</Text>
            {request.messageKey ? (
              <Text style={{ ...text.body, color: colors.textMuted }}>
                {t(request.messageKey, request.params)}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {request.cancelKey ? (
              <DialogButton
                label={t(request.cancelKey)}
                onPress={() => dismissThen(request.onCancel)}
                color={colors.text}
                background={colors.surfaceRaised}
                border={colors.border}
              />
            ) : null}
            <DialogButton
              label={t(request.confirmKey)}
              onPress={() => dismissThen(request.onConfirm)}
              color={request.destructive ? colors.danger : colors.onPrimary}
              background={request.destructive ? colors.dangerSurface : accent}
              border={request.destructive ? colors.dangerBorder : accent}
            />
          </View>
        </View>
      </View>
      )}
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
