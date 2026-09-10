// app/settings.tsx — everything app-shaped from behind the profile tab's gear:
// how you sign in, your location, appearance, language, and the about page.
// The profile tab itself keeps only what is about the person.
import { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Card,
  Section,
  OptionList,
  HEADER_EDGES,
  type Option,
} from "../src/components/ui";
import { spacing, radii } from "../src/theme/tokens";
import { useTheme, useThemeMode } from "../src/theme/useTheme";
import {
  usePreferences,
  type Currency,
  type ThemeMode,
} from "../src/lib/preferences";
import { useT, type Language } from "../src/i18n";
import { useIsAuthed } from "../src/features/auth/guest";
import { SignInMethods } from "../src/features/auth/components/SignInMethods";
import { MiniLocationMap } from "../src/features/map/MiniLocationMap";

export default function SettingsScreen() {
  const authed = useIsAuthed();
  const { colors, text } = useTheme();
  const t = useT();

  const [themeMode, setThemeMode] = useThemeMode();
  const language = usePreferences((s) => s.language);
  const setLanguage = usePreferences((s) => s.setLanguage);
  const currency = usePreferences((s) => s.currency);
  const setCurrency = usePreferences((s) => s.setCurrency);

  const currencyOptions = useMemo<Option<Currency>[]>(
    () => [
      { value: "USD", label: t("settings.currencyUsd"), icon: "logo-usd" },
      { value: "UZS", label: t("settings.currencyUzs"), icon: "cash-outline" },
    ],
    [t],
  );

  const themeOptions = useMemo<Option<ThemeMode>[]>(
    () => [
      { value: "system", label: t("settings.themeSystem"), icon: "contrast-outline" },
      { value: "light", label: t("settings.themeLight"), icon: "sunny-outline" },
      { value: "dark", label: t("settings.themeDark"), icon: "moon-outline" },
    ],
    [t],
  );

  const languageOptions = useMemo<Option<Language>[]>(
    () => [
      { value: "uz", label: "O'zbekcha", icon: "language-outline" },
      { value: "ru", label: "Русский", icon: "language-outline" },
    ],
    [],
  );

  return (
    <Screen edges={HEADER_EDGES}>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        {authed ? (
          <Section title={t("auth.methods")}>
            <SignInMethods />
            <Pressable
              onPress={() => router.push("/change-password")}
              accessibilityRole="button"
              accessibilityLabel={t("auth.changePassword")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md,
                marginTop: spacing.sm,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
              })}
            >
              <Ionicons name="key-outline" size={20} color={colors.primary} />
              <Text style={{ ...text.bodyStrong, flex: 1 }}>
                {t("auth.changePassword")}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textFaint}
              />
            </Pressable>
          </Section>
        ) : null}

        <Section title={t("location.title")}>
          <Card flush>
            <MiniLocationMap />
          </Card>
        </Section>

        <Section title={t("settings.appearance")}>
          <Card flush>
            <OptionList
              options={themeOptions}
              value={themeMode}
              onChange={setThemeMode}
            />
          </Card>
        </Section>

        <Section title={t("settings.language")}>
          <Card flush>
            <OptionList
              options={languageOptions}
              value={language}
              onChange={setLanguage}
            />
          </Card>
        </Section>

        <Section title={t("settings.currency")}>
          <Card flush>
            <OptionList
              options={currencyOptions}
              value={currency}
              onChange={setCurrency}
            />
          </Card>
        </Section>

        <Section title={t("about.title")}>
          <Card flush>
            <Pressable
              onPress={() => router.push("/(tabs)/about")}
              accessibilityRole="button"
              accessibilityLabel={t("about.title")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md,
                backgroundColor: pressed ? colors.surfaceRaised : "transparent",
              })}
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={{ ...text.bodyStrong, flex: 1 }}>
                {t("about.title")}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Pressable>
          </Card>
        </Section>

        <Text style={{ ...text.caption, textAlign: "center" }}>
          {t("about.version", {
            version: Constants.expoConfig?.version ?? "1.0.0",
          })}
        </Text>
      </View>
    </Screen>
  );
}
