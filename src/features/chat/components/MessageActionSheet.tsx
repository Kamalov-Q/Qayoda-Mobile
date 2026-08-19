import { Modal, View, Text, Pressable } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT, type TranslationKey } from "../../../i18n";

export interface MessageAction {
  key: string;
  labelKey: TranslationKey;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

/**
 * The long-press menu. Not Alert.alert with a button list: react-native-web
 * ships Alert as a no-op, so on web the menu never opened — the same reason
 * the confirmations moved to DialogHost.
 */
export function MessageActionSheet({
  visible,
  actions,
  onClose,
}: {
  visible: boolean;
  actions: MessageAction[];
  onClose: () => void;
}) {
  const { colors, text, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View
        entering={FadeIn.duration(140)}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: colors.overlay,
        }}
      >
        <Pressable
          style={{ position: "absolute", inset: 0 }}
          accessibilityElementsHidden
          importantForAccessibility="no"
          onPress={onClose}
        />

        <Animated.View
          entering={SlideInDown.duration(240).springify().damping(22)}
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xxl,
            borderTopRightRadius: radii.xxl,
            borderWidth: 1,
            borderColor: colors.border,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            ...shadow.raised,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: radii.pill,
              backgroundColor: colors.borderStrong,
              marginBottom: spacing.sm,
            }}
          />

          {actions.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                backgroundColor: pressed
                  ? colors.surfaceRaised
                  : "transparent",
              })}
            >
              <Ionicons
                name={action.icon}
                size={20}
                color={action.destructive ? colors.danger : colors.textMuted}
              />
              <Text
                style={{
                  ...text.body,
                  color: action.destructive ? colors.danger : colors.text,
                }}
              >
                {t(action.labelKey)}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
