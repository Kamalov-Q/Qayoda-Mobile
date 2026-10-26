// src/features/profile/components/CompleteProfileSheet.tsx
// The one-time ask: a fresh account has a phone and a name, and nothing a
// buyer could read. This offers the rest, says what it buys, and takes no
// for an answer.
import { memo } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Button } from "../../../components/ui/Button";
import { radii, spacing, type } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT, type TranslationKey } from "../../../i18n";

/** What filling it in actually buys. Claims the product can keep. */
const BENEFITS: TranslationKey[] = [
  "completeProfile.benefitTrust",
  "completeProfile.benefitReach",
  "completeProfile.benefitContact",
];

interface Props {
  visible: boolean;
  /** "Fill it in" — the caller routes to the form. */
  onStart: () => void;
  /** "Later" and the backdrop both land here. */
  onDismiss: () => void;
}

export const CompleteProfileSheet = memo(function CompleteProfileSheet({
  visible,
  onStart,
  onDismiss,
}: Props) {
  const { colors, text, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();

  return (
    // Mounted and driven by `visible`, like every other modal host here —
    // the iOS dismissal race, same as SelectSheet.
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t("common.close")}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: colors.overlay,
        }}
      >
        {/* Stops a tap inside the card from reaching the backdrop. */}
        <Pressable onPress={() => {}} accessible={false}>
          <Animated.View
            entering={FadeInUp.duration(260)}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
              gap: spacing.lg,
              ...shadow.card,
            }}
          >
            {/* The grab handle, for the affordance only — this sheet is
                dismissed by the button or the backdrop, not by dragging. */}
            <View
              style={{
                alignSelf: "center",
                width: 40,
                height: 4,
                borderRadius: radii.pill,
                backgroundColor: colors.border,
              }}
            />

            <Animated.View
              entering={FadeIn.delay(80)}
              style={{ alignItems: "center", gap: spacing.md }}
            >
              <View
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: radii.xl,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primary,
                }}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={38}
                  color={colors.onPrimary}
                />
              </View>

              <Text style={{ ...text.heading, textAlign: "center" }}>
                {t("completeProfile.title")}
              </Text>
              <Text
                style={{
                  ...text.body,
                  color: colors.textMuted,
                  textAlign: "center",
                }}
              >
                {t("completeProfile.subtitle")}
              </Text>
            </Animated.View>

            <View style={{ gap: spacing.sm }}>
              {BENEFITS.map((key, i) => (
                <Animated.View
                  key={key}
                  entering={FadeInUp.delay(140 + i * 70).duration(260)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.success}
                  />
                  <Text style={{ ...text.body, flex: 1 }}>{t(key)}</Text>
                </Animated.View>
              ))}
            </View>

            <View style={{ gap: spacing.xs }}>
              <Button
                title={t("completeProfile.start")}
                icon="arrow-forward"
                onPress={onStart}
              />
              {/* Quiet, and a real way out: this is an ask, not a gate. */}
              <Pressable
                onPress={onDismiss}
                accessibilityRole="button"
                hitSlop={8}
                style={({ pressed }) => ({
                  alignSelf: "center",
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.lg,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={{ ...type.body, color: colors.textMuted }}>
                  {t("completeProfile.later")}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});
