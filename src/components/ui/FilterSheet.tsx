import { Children, memo, type ReactNode } from "react";
import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  SlideInDown,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, sizing, type, weight } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import { Button } from "./Button";
import { Rise } from "./Rise";

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  /** Rendered as a "clear" action in the footer; omit when nothing is set. */
  onReset?: () => void;
  /** How many filters differ from their default — drives the title's badge. */
  activeCount?: number;
  /**
   * How many listings the current filters match.
   *
   * Turns the footer button from "apply" into what applying will get you,
   * which is the one number anyone adjusting a filter is watching. Omit it
   * where the screen cannot know the count yet.
   */
  resultCount?: number;
  children: ReactNode;
}

/**
 * Filters live in a sheet rather than in rows pinned under the header: the
 * chip rows cost two lines of every screen, permanently, to show options most
 * people change once. This keeps the feed full-height and gives each group
 * room to be labelled and to wrap.
 */
export const FilterSheet = memo(function FilterSheet({
  visible,
  onClose,
  onReset,
  activeCount = 0,
  resultCount,
  children,
}: SheetProps) {
  const { colors, text, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const reduceMotion = useReducedMotion();

  /**
   * Drag-down-to-dismiss, on the grabber and the title row.
   *
   * The grabber was already drawn — a 44pt pill that every sheet in every
   * app lets you pull — and it did nothing, which is a control that lies.
   * The gesture is bound to the header only, not the whole panel: on the
   * body it would fight the ScrollView and the price slider for the same
   * vertical drag.
   */
  const dragY = useSharedValue(0);

  const panel = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  /**
   * The dim behind the sheet, thinning as the sheet is pulled down.
   *
   * A backdrop that stays at full strength while the panel slides out from
   * under it makes the drag feel like it is moving one layer of a picture.
   * Tying the two together is what makes the gesture feel like it is
   * dismissing the whole thing rather than nudging a card.
   */
  const backdrop = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, dragY.value / 420),
  }));

  const drag = Gesture.Pan()
    .onUpdate((e) => {
      // Downwards only: dragging up would lift the sheet off its own edge.
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      // Far enough, or thrown hard enough. A flick that has barely moved is
      // still a dismissal, which is why velocity counts on its own.
      if (e.translationY > 120 || e.velocityY > 900) {
        scheduleOnRN(onClose);
      }
      dragY.value = withSpring(0, { damping: 20, stiffness: 180 });
    });

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
      // Both bars, not just the top one. statusBarTranslucent alone leaves
      // the modal window stopping ABOVE the navigation bar, so a sheet that
      // anchors its footer to the bottom has that footer clipped by the
      // system strip — and the dim never reaches it either, so whatever is
      // behind shows through at full brightness. Android is edge-to-edge
      // from targetSdk 35, which makes this the matching half of a pair.
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {/* A Modal is its own native root: gesture-handler gestures inside it
          (the price slider) only fire on Android with a root of their own. */}
      <GestureHandlerRootView
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", inset: 0, backgroundColor: colors.overlay },
            backdrop,
          ]}
        />
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
          style={[
            panel,
            {
              // Never the whole screen — the dimmed strip at the top is what
              // says this is a sheet over the feed and not a page of its own —
              // but close to it, so a long filter list is not read through a
              // letterbox. The body scrolls; the footer stays put.
              maxHeight: "92%",
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xxl,
              borderTopRightRadius: radii.xxl,
              borderWidth: 1,
              borderColor: colors.border,
              paddingTop: spacing.sm,
              ...shadow.raised,
            },
          ]}
        >
          <GestureDetector gesture={drag}>
            <View>
              {/* Grabber — and now actually the thing you grab. */}
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

              {/* Title and a way out. "Reset" used to live up here beside the
              title, which put a destructive action in the corner a thumb
              reaches for on the way to closing; it is down with the other
              decision now, and this corner just closes. */}
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
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <Text style={text.title}>{t("filters.title")}</Text>
                  {/* Keyed on the count, so every filter switched on or off
                      remounts it with a spring — the change is felt at the
                      title rather than only read off the feed behind. */}
                  {activeCount > 0 ? (
                    <Animated.View
                      key={activeCount}
                      entering={
                        reduceMotion
                          ? undefined
                          : ZoomIn.springify().damping(12)
                      }
                      style={{
                        minWidth: 24,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: radii.pill,
                        backgroundColor: colors.primarySoft,
                        borderWidth: 1,
                        borderColor: colors.primaryBorder,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          ...type.caption,
                          ...weight("700"),
                          color: colors.primary,
                        }}
                      >
                        {activeCount}
                      </Text>
                    </Animated.View>
                  ) : null}
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t("filters.close")}
                  style={({ pressed }) => ({
                    width: 32,
                    height: 32,
                    borderRadius: radii.pill,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: pressed
                      ? colors.borderStrong
                      : colors.surfaceRaised,
                  })}
                >
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>
          </GestureDetector>

          <ScrollView
            // flexShrink, and it is load-bearing. The panel is capped at 92%
            // of the screen; without this the ScrollView sizes itself to its
            // CONTENT, overflows that cap and pushes the footer below the
            // panel's bottom edge — the Apply and Reset buttons end up off
            // the screen, which is the one part of this sheet that must
            // never be. Shrinking makes the body yield to the header and
            // footer and scroll inside what is left.
            style={{ flexShrink: 1 }}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.lg,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* A hairline between groups rather than a box around each.
                Boxes were tried and every fill collided with something: the
                chips are drawn on `surface` and the text fields on
                `surfaceRaised`, so whichever of the two a card took, one of
                its own controls disappeared into it. A rule costs nothing
                and says the same thing.

                Each group still rises in after the one above it. */}
            {visible
              ? Children.toArray(children).map((child, i, all) => (
                  <Rise key={i} index={i + 1}>
                    <View
                      style={{
                        // md, not lg: six groups at 24pt top and bottom put
                        // half a screen of air between the first filter and
                        // the last, and the rule already separates them.
                        paddingVertical: spacing.md,
                        borderBottomWidth: i === all.length - 1 ? 0 : 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      {child}
                    </View>
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
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {/* Only once something is actually set — an always-visible
                  "clear" on an untouched sheet is a button that does
                  nothing and still has to be read past. */}
              {onReset ? (
                <Animated.View
                  style={{ flex: 1 }}
                  entering={reduceMotion ? undefined : FadeIn.duration(180)}
                >
                  <Button
                    title={t("filters.reset")}
                    icon="refresh"
                    variant="secondary"
                    onPress={onReset}
                  />
                </Animated.View>
              ) : null}
              <Button
                title={
                  resultCount === undefined
                    ? t("filters.apply")
                    : t("filters.applyCount", { count: resultCount })
                }
                onPress={onClose}
                style={{ flex: onReset ? 1.4 : 1 }}
              />
            </View>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
});

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
              ...weight("700"),
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
