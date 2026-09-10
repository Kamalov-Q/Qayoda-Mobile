// A Joymee-style bottom picker: a titled sheet of radio rows that closes on
// pick. For the one-of-N filters that used to live in a chip row eating a
// line of every screen.
import { Modal, View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, radii } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { OptionList, type Option } from "./OptionList";

interface Props<T extends string> {
  visible: boolean;
  title: string;
  options: readonly Option<T>[];
  value: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}

export function SelectSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: Props<T>) {
  const { colors, text, shadow } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    // Kept MOUNTED and driven by `visible` — the same iOS dismissal-race
    // avoidance as every other modal host in the app.
    <Modal
      visible={visible}
      transparent
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
              width: 44,
              height: 4,
              borderRadius: radii.pill,
              backgroundColor: colors.borderStrong,
              marginBottom: spacing.md,
            }}
          />
          <Text
            style={{ ...text.heading, textAlign: "center", marginBottom: spacing.sm }}
          >
            {title}
          </Text>
          <OptionList
            options={options}
            value={value}
            onChange={(next) => {
              onSelect(next);
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
