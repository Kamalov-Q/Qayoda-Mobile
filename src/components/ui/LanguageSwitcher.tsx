import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { radii, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { usePreferences } from "../../lib/preferences";
import { LANGUAGES, type Language } from "../../i18n";

/**
 * Language is also settable from Settings, but that lives behind the login —
 * someone who can't read the current language has to be able to switch before
 * authenticating, not after.
 *
 * Two-letter codes rather than endonyms: this sits in a screen corner where
 * "O'zbekcha" would not fit, and UZ/RU are recognisable regardless of which
 * language the app is currently stuck in. The full name goes to screen readers.
 */
const SHORT: Record<Language, string> = { uz: "UZ", ru: "RU" };
const FULL: Record<Language, string> = { uz: "O'zbekcha", ru: "Русский" };

export const LanguageSwitcher = memo(function LanguageSwitcher() {
  const { colors } = useTheme();
  const language = usePreferences((s) => s.language);
  const setLanguage = usePreferences((s) => s.setLanguage);

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
      {LANGUAGES.map((code) => {
        const active = code === language;
        return (
          <Pressable
            key={code}
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
              backgroundColor: active ? colors.primary : "transparent",
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
