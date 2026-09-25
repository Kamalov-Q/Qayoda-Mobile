import { Modal, View, Text, Pressable } from "react-native";
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
  info,
  onClose,
}: {
  visible: boolean;
  actions: MessageAction[];
  /** Delivery and read times — shown, not pressable. */
  info?: string | null;
  onClose: () => void;
}) {
  const { colors, text, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();

  return (
    <Modal
      visible={visible}
      transparent
      // Kept MOUNTED and driven by `visible` — unmounting a transparent modal
      // mid-dismissal is an iOS race that leaves the dead modal host eating
      // touches (unresponsive back buttons after a few open/close cycles).
      // Native fade replaces the reanimated entering animations for the same
      // reason: with a persistent mount they would only ever fire once.
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
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

        <View
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

          {/* Above the actions and visibly not one of them: this is the
              answer to "did they see it", which is why the menu was opened
              at least as often as any of the buttons below. */}
          {info ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                marginBottom: spacing.xs,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Ionicons
                name="checkmark-done"
                size={15}
                color={colors.textMuted}
              />
              <Text style={text.caption}>{info}</Text>
            </View>
          ) : null}

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
                backgroundColor: pressed ? colors.surfaceRaised : "transparent",
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
        </View>
      </View>
    </Modal>
  );
}
