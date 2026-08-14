import { useMemo } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Button,
  Card,
  Section,
  OptionList,
  TAB_EDGES,
  type Option,
} from "../../src/components/ui";
import { spacing, radii, type } from "../../src/theme/tokens";
import { useTheme, useThemeMode } from "../../src/theme/useTheme";
import { usePreferences, type ThemeMode } from "../../src/lib/preferences";
import { useT, type Language } from "../../src/i18n";
import { confirm } from "../../src/lib/alerts";
import { MiniLocationMap } from "../../src/features/map/MiniLocationMap";
import { useAuthStore } from "../../src/features/auth/store/auth.store";
import { useLogout } from "../../src/features/auth/hooks/useAuth";

export default function AccountScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { text, colors, shadow } = useTheme();
  const t = useT();

  const [themeMode, setThemeMode] = useThemeMode();
  const language = usePreferences((s) => s.language);
  const setLanguage = usePreferences((s) => s.setLanguage);

  const themeOptions = useMemo<Option<ThemeMode>[]>(
    () => [
      {
        value: "system",
        label: t("settings.themeSystem"),
        icon: "phone-portrait-outline",
      },
      { value: "light", label: t("settings.themeLight"), icon: "sunny-outline" },
      { value: "dark", label: t("settings.themeDark"), icon: "moon-outline" },
    ],
    [t],
  );

  // Each language is written in itself — someone who has the app stuck in a
  // language they can't read needs to recognise their own on this list.
  const languageOptions = useMemo<Option<Language>[]>(
    () => [
      { value: "uz", label: "O'zbekcha", icon: "language-outline" },
      { value: "ru", label: "Русский", icon: "language-outline" },
    ],
    [],
  );

  const initials = [user?.name, user?.surname]
    .filter(Boolean)
    .map((s) => s![0]?.toUpperCase())
    .join("");

  const onLogout = () =>
    confirm({
      titleKey: "auth.logoutConfirmTitle",
      messageKey: "auth.logoutConfirmMessage",
      confirmKey: "auth.logout",
      destructive: true,
      onConfirm: () => logout.mutate(),
    });

  return (
    <Screen style={{ paddingTop: spacing.md }} edges={TAB_EDGES}>
      <View style={{ gap: spacing.xl }}>
        <Text style={text.display}>{t("tabs.profile")}</Text>

        {/* Identity block reads as a banner rather than a list row: it is the
            only content on this screen that is about the person, not a setting. */}
        <View
          style={{
            alignItems: "center",
            gap: spacing.md,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: radii.xxl,
            borderWidth: 1,
            borderColor: colors.border,
            ...shadow.card,
          }}
        >
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: radii.pill,
              backgroundColor: colors.primarySoft,
              borderWidth: 1,
              borderColor: colors.primaryBorder,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {initials ? (
              <Text
                style={{
                  ...type.display,
                  fontSize: 26,
                  color: colors.primary,
                }}
              >
                {initials}
              </Text>
            ) : (
              <Ionicons name="person" size={32} color={colors.primary} />
            )}
          </View>

          <View style={{ alignItems: "center", gap: 2 }}>
            <Text style={text.heading} numberOfLines={1}>
              {user?.name} {user?.surname}
            </Text>
            <Text style={text.caption} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
        </View>

        {/* Sits above the settings groups: it is about the person, like the
            identity card, rather than about how the app behaves. */}
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

        <Button
          title={t("auth.logout")}
          icon="log-out-outline"
          variant="danger"
          onPress={onLogout}
          loading={logout.isPending}
        />
      </View>
    </Screen>
  );
}
