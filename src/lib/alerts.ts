// Confirmations and notices, translated.
//
// These used to call React Native's Alert.alert. react-native-web implements
// that as an empty no-op, so on web the dialog never appeared and the
// onConfirm behind it never ran — logout and archive both silently did
// nothing. They now go through the in-app DialogHost, which renders on every
// platform and can translate its own buttons.
import { showDialog } from "../components/ui/Dialog";
import type { TranslationKey, TranslationParams } from "../i18n";

interface ConfirmOptions {
  titleKey: TranslationKey;
  messageKey?: TranslationKey;
  params?: TranslationParams;
  /** Label for the affirmative button. Defaults to common.confirm. */
  confirmKey?: TranslationKey;
  cancelKey?: TranslationKey;
  /** Renders the affirmative button in the danger palette. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

/** Two-button confirmation. Resolves through callbacks, not a promise, so
 *  callers stay in the same style the rest of the app uses. */
export function confirm({
  titleKey,
  messageKey,
  params,
  confirmKey = "common.confirm",
  cancelKey = "common.cancel",
  destructive,
  onConfirm,
  onCancel,
}: ConfirmOptions) {
  showDialog({
    titleKey,
    messageKey,
    params,
    confirmKey,
    cancelKey,
    destructive,
    onConfirm,
    onCancel,
  });
}

/** Single-button notice. */
export function notify(
  titleKey: TranslationKey,
  messageKey?: TranslationKey,
  params?: TranslationParams,
) {
  showDialog({
    titleKey,
    messageKey,
    params,
    confirmKey: "common.close",
  });
}
