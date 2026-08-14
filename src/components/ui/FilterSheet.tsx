import { memo, type ReactNode } from "react";
import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, sizing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import { Button } from "./Button";
import { TextField } from "./TextField";

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

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none" // reanimated drives it; the native slide double-animates
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
              <Pressable onPress={onReset} hitSlop={12} accessibilityRole="button">
                <Text style={{ ...type.bodyStrong, color: colors.primary }}>
                  {t("filters.reset")}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.lg,
              gap: spacing.lg,
            }}
            showsVerticalScrollIndicator={false}
          >
            {children}
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
      </Animated.View>
    </Modal>
  );
}

interface PriceRangeProps {
  min: string;
  max: string;
  onChangeMin: (value: string) => void;
  onChangeMax: (value: string) => void;
}

/** Digits only: the bounds are parsed with Number(), and a stray separator
 *  would turn the whole filter into NaN and hide every listing. */
const digits = (value: string) => value.replace(/[^\d]/g, "");

/** Min/max price pair, sized so the two fields share the sheet's width. */
export const PriceRangeFilter = memo(function PriceRangeFilter({
  min,
  max,
  onChangeMin,
  onChangeMax,
}: PriceRangeProps) {
  const t = useT();

  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <TextField
          label={t("filters.priceFrom")}
          placeholder="0"
          keyboardType="number-pad"
          value={min}
          onChangeText={(v) => onChangeMin(digits(v))}
          suffix="$"
        />
      </View>
      <View style={{ flex: 1 }}>
        <TextField
          label={t("filters.priceTo")}
          placeholder="100000"
          keyboardType="number-pad"
          value={max}
          onChangeText={(v) => onChangeMax(digits(v))}
          suffix="$"
        />
      </View>
    </View>
  );
});

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
        <View
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
        </View>
      ) : null}
    </Pressable>
  );
});
