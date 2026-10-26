import { memo, useState } from "react";
import { View, Text, Pressable, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from "react-native-reanimated";
import { radii, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { usePreferences } from "../../lib/preferences";
import { LANGUAGES, type Language } from "../../i18n";

/**
 * Language is also settable from Settings, but that lives behind the login —
 * someone who can't read the current language has to be able to switch before
 * authenticating, not after. It sits in the profile header too, where it is
 * the one app-level control worth having in reach rather than behind the gear.
 *
 * Two-letter codes rather than endonyms: this sits in a screen corner where
 * "O'zbekcha" would not fit, and UZ/RU are recognisable regardless of which
 * language the app is currently stuck in. The full name goes to screen readers.
 */
const SHORT: Record<Language, string> = { uz: "UZ", ru: "RU" };
const FULL: Record<Language, string> = { uz: "O'zbekcha", ru: "Русский" };

export const LanguageSwitcher = memo(function LanguageSwitcher() {
  const { colors, shadow } = useTheme();
  const language = usePreferences((s) => s.language);
  const setLanguage = usePreferences((s) => s.setLanguage);

  /**
   * The thumb is positioned from a measured segment width rather than a
   * guessed one: "UZ" and "RU" are the same width today, but the control
   * takes whatever LANGUAGES holds, and a third code would quietly break a
   * hard-coded offset.
   */
  const [segment, setSegment] = useState(0);
  const onLayout = (e: LayoutChangeEvent) =>
    setSegment(e.nativeEvent.layout.width);

  const index = Math.max(0, LANGUAGES.indexOf(language));

  /**
   * The filled pill slides between the codes instead of being repainted on
   * one and cleared on the other, which is what makes the control feel like
   * a switch rather than two buttons. A spring, so it overshoots a touch and
   * settles — the motion a physical toggle has.
   *
   * It runs on the UI thread: `index` is the only thing React re-renders,
   * and it changes once per tap.
   */
  const offset = useDerivedValue(() =>
    withSpring(index * segment, { damping: 18, stiffness: 220, mass: 0.6 }),
  );
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        flexDirection: "row",
        backgroundColor: colors.surfaceRaised,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 3,
      }}
    >
      {/* Behind the labels, so the text never has to cross-fade. */}
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 3,
              left: 3,
              width: segment,
              height: 30,
              borderRadius: radii.pill,
              backgroundColor: colors.primary,
              ...shadow.card,
            },
            thumbStyle,
          ]}
        />
      ) : null}

      {LANGUAGES.map((code, i) => {
        const active = code === language;
        return (
          <Pressable
            key={code}
            // Measured once, from the first segment — they are laid out
            // identically, so one measurement positions the thumb for all.
            onLayout={i === 0 ? onLayout : undefined}
            onPress={() => setLanguage(code)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={FULL[code]}
            hitSlop={6}
            style={{
              minWidth: 40,
              height: 30,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 10,
              borderRadius: radii.pill,
            }}
          >
            <Text
              style={{
                ...type.bodyStrong,
                fontSize: 13,
                color: active ? colors.onPrimary : colors.textMuted,
              }}
            >
              {SHORT[code]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});
