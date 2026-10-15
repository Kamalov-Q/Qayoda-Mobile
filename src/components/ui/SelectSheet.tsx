// A Joymee-style bottom picker: a titled sheet of radio rows that closes on
// pick. For the one-of-N filters that used to live in a chip row eating a
// line of every screen.
import { Modal, View, Text, Pressable, ScrollView } from "react-native";
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
            // Capped, or a long list (16 districts in a region) grows past the
            // top of the screen and takes the handle and title with it —
            // leaving no way to scroll and no way to close.
            maxHeight: "85%",
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
          {/* The handle and title stay put; only the rows move. flexShrink
              lets the list give up height to the cap above, which is what
              makes it scroll instead of overflowing. */}
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
            bounces={false}
          >
            <OptionList
              options={options}
              value={value}
              onChange={(next) => {
                onSelect(next);
                onClose();
              }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
