import { Children, memo, type ReactNode } from "react";
import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  SlideInDown,
  ZoomIn,
  useReducedMotion,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, sizing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import { Button } from "./Button";
import { Rise } from "./Rise";

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  /** Rendered as a "clear" action in the header; omit when nothing is set. */
  onReset?: () => void;
  children: ReactNode;
}

/**
 * Filters live in a sheet rather than in rows pinned under the header: the
 * chip rows cost two lines of every screen, permanently, to show options most
 * people change once. This keeps the feed full-height and gives each group
 * room to be labelled and to wrap.
 */
export function FilterSheet({
  visible,
  onClose,
  onReset,
  children,
}: SheetProps) {
  const { colors, text, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const reduceMotion = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      // Kept MOUNTED and driven by `visible` — unmounting a transparent modal
      // mid-dismissal is an iOS race that leaves the dead modal host eating
      // touches (unresponsive back buttons after a few open/close cycles).
      // The dim backdrop uses the native fade; the panel's own spring comes
      // from remounting it per open (see the key below), since with a
      // persistent mount an entering animation would only ever fire once.
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* A Modal is its own native root: gesture-handler gestures inside it
          (the price slider) only fire on Android with a root of their own. */}
      <GestureHandlerRootView
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

        {/* Keyed on `visible`: the Modal stays mounted (see above), so this
            panel is remounted on every open instead — which is what lets the
            entering spring and the section stagger play each time, not once. */}
        <Animated.View
          key={visible ? "open" : "closed"}
          entering={
            visible && !reduceMotion
              ? SlideInDown.springify().damping(20).stiffness(180)
              : undefined
          }
          accessibilityViewIsModal
          style={{
            // Never taller than the screen: with every group expanded the body
            // scrolls instead of pushing the footer out of reach.
            maxHeight: "85%",
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xxl,
            borderTopRightRadius: radii.xxl,
            borderWidth: 1,
            borderColor: colors.border,
            paddingTop: spacing.sm,
            ...shadow.raised,
          }}
        >
          {/* Grabber — signals "drag/tap away to dismiss" without a chrome bar. */}
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

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.md,
            }}
          >
            <Text style={text.heading}>{t("filters.title")}</Text>
            {onReset ? (
              <Animated.View
                entering={reduceMotion ? undefined : FadeIn.duration(180)}
              >
                <Pressable
                  onPress={onReset}
                  hitSlop={12}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Ionicons name="refresh" size={16} color={colors.primary} />
                  <Text style={{ ...type.bodyStrong, color: colors.primary }}>
                    {t("filters.reset")}
                  </Text>
                </Pressable>
              </Animated.View>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.lg,
              gap: spacing.lg,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Each group rises in after the one above it, on every open. */}
            {visible
              ? Children.toArray(children).map((child, i) => (
                  <Rise key={i} index={i + 1}>
                    {child}
                  </Rise>
                ))
              : children}
          </ScrollView>

          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              // Clears the home indicator without a second SafeAreaView, which
              // inside a Modal would inset from the wrong edge.
              paddingBottom: insets.bottom + spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Button title={t("common.done")} onPress={onClose} />
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** The range slider, under the name both filter screens already import. */
export { PriceRangeSlider as PriceRangeFilter } from "./PriceRangeSlider";

interface ButtonProps {
  onPress: () => void;
  /** How many filters differ from their default; drives the badge. */
  activeCount?: number;
}

/** Header affordance that opens the sheet, badged when filters are on. */
export const FilterButton = memo(function FilterButton({
  onPress,
  activeCount = 0,
}: ButtonProps) {
  const { colors } = useTheme();
  const t = useT();
  const active = activeCount > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("filters.title")}
      accessibilityState={{ expanded: false }}
      style={({ pressed }) => ({
        width: sizing.controlMd,
        height: sizing.controlMd,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        // The active state is carried by fill AND badge, so it still reads
        // when the tint is hard to see.
        borderColor: active ? colors.primaryBorder : colors.border,
        backgroundColor: pressed
          ? colors.surfaceRaised
          : active
            ? colors.primarySoft
            : colors.surface,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Ionicons
        name="options-outline"
        size={20}
        color={active ? colors.primary : colors.textMuted}
      />

      {active ? (
        // Keyed on the count: every change remounts it with a pop, so a filter
        // taking effect is felt at the button, not just read.
        <Animated.View
          key={activeCount}
          entering={ZoomIn.springify().damping(12)}
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: radii.pill,
            backgroundColor: colors.primary,
            borderWidth: 2,
            borderColor: colors.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              ...type.caption,
              fontSize: 10,
              fontWeight: "700",
              color: colors.onPrimary,
            }}
          >
            {activeCount}
          </Text>
        </Animated.View>
      ) : null}
    </Pressable>
  );
});
