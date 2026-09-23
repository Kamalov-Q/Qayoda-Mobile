// src/features/moderation/ReportSheet.tsx
// The "why are you reporting this" bottom sheet: fixed reasons as radio rows,
// OTHER opening a free-text field. Same host pattern as SelectSheet — kept
// mounted, driven by `visible`, so iOS never races a dismissal.
//
// Shared by listing reports and chat reports: the two differ only in their
// reasons, their wording and where they post to.
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../components/ui";
import { toast } from "../../components/ui/Toast";
import { spacing, radii } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT, type TranslationKey } from "../../i18n";
import { ApiError } from "../../lib/api-client";
import { errorMessage } from "../../lib/api-error";

interface Props<R extends string> {
  visible: boolean;
  onClose: () => void;
  /** Reason keys, in the order they are offered. */
  reasons: readonly R[];
  title: string;
  subtitle: string;
  /** Label for one reason key. */
  labelFor: (reason: R) => string;
  /** Posts the report; rejecting with ALREADY_REPORTED is handled here. */
  submit: (reason: R, comment?: string) => Promise<unknown>;
  /** Toast keys for the two outcomes the caller owns the wording of. */
  sentKey: TranslationKey;
  alreadyKey: TranslationKey;
}

export function ReportSheet<R extends string>({
  visible,
  onClose,
  reasons,
  title,
  subtitle,
  labelFor,
  submit: post,
  sentKey,
  alreadyKey,
}: Props<R>) {
  const { colors, text, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const [reason, setReason] = useState<R | null>(null);
  const [comment, setComment] = useState("");

  const close = () => {
    onClose();
    // Reset for the next open — a half-filled report shouldn't linger.
    setReason(null);
    setComment("");
  };

  const submit = useMutation({
    mutationFn: () => post(reason!, comment.trim() || undefined),
    onSuccess: () => {
      toast.successKey(sentKey);
      close();
    },
    onError: (error) => {
      // Already reported is not a failure to fix — say so and close.
      if (error instanceof ApiError && error.code === "ALREADY_REPORTED") {
        toast.errorKey(alreadyKey);
        close();
        return;
      }
      toast.error(errorMessage(error));
    },
  });

  const canSubmit =
    !!reason && (reason !== "OTHER" || comment.trim().length > 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: colors.overlay,
        }}
        behavior="padding"
      >
        <Pressable
          style={{ position: "absolute", inset: 0 }}
          accessibilityElementsHidden
          importantForAccessibility="no"
          onPress={close}
        />

        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xxl,
            borderTopRightRadius: radii.xxl,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: insets.bottom + spacing.md,
            gap: spacing.md,
            ...shadow.card,
          }}
        >
          <View style={{ gap: 2 }}>
            <Text style={text.heading}>{title}</Text>
            <Text style={text.caption}>{subtitle}</Text>
          </View>

          <View style={{ gap: 2 }}>
            {reasons.map((key) => {
              const selected = reason === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setReason(key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    paddingVertical: 10,
                    paddingHorizontal: spacing.sm,
                    borderRadius: radii.lg,
                    backgroundColor: pressed
                      ? colors.surfaceRaised
                      : selected
                        ? colors.primarySoft
                        : "transparent",
                  })}
                >
                  <Ionicons
                    name={selected ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={selected ? colors.primary : colors.textFaint}
                  />
                  <Text
                    style={{
                      ...text.body,
                      flex: 1,
                      color: selected ? colors.primary : colors.text,
                      fontWeight: selected ? "600" : "400",
                    }}
                  >
                    {labelFor(key)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {reason === "OTHER" ? (
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder={t("report.otherPlaceholder")}
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={500}
              style={{
                ...text.body,
                minHeight: 88,
                textAlignVertical: "top",
                padding: spacing.md,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceRaised,
                color: colors.text,
              }}
            />
          ) : null}

          <Button
            title={t("report.submit")}
            onPress={() => submit.mutate()}
            disabled={!canSubmit}
            loading={submit.isPending}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
