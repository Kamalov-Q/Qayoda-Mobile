// app/(tabs)/account.tsx
import { useMemo } from "react";
import { Text, View, Pressable } from "react-native";
import { router, type Href } from "expo-router";
import Constants from "expo-constants";
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
import { useT, type Language, type TranslationKey } from "../../src/i18n";
import { confirm } from "../../src/lib/alerts";
import { MiniLocationMap } from "../../src/features/map/MiniLocationMap";
import { useAuthStore } from "../../src/features/auth/store/auth.store";
import { useLogout } from "../../src/features/auth/hooks/useAuth";
import { useMyListings } from "../../src/features/listings/hooks/useMyListings";
import { useSavedListings } from "../../src/features/listings/hooks/useSavedListings";

const LINKS = [
  {
    key: "mine",
    labelKey: "profile.linkMyListings" as TranslationKey,
    icon: "business-outline",
    href: "/(tabs)/places" as Href,
  },
  {
    key: "saved",
    labelKey: "profile.linkSaved" as TranslationKey,
    icon: "heart-outline",
    href: "/(tabs)/saved" as Href,
  },
  {
    key: "add",
    labelKey: "profile.linkAdd" as TranslationKey,
    icon: "add-circle-outline",
    href: "/add" as Href,
  },
  {
    key: "about",
    labelKey: "profile.linkAbout" as TranslationKey,
    icon: "information-circle-outline",
    href: "/(tabs)/about" as Href,
  },
] as const;

export default function AccountScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { text, colors, shadow } = useTheme();
  const t = useT();

  const [themeMode, setThemeMode] = useThemeMode();
  const language = usePreferences((s) => s.language);
  const setLanguage = usePreferences((s) => s.setLanguage);

  // Counts reuse the queries the other tabs already keep warm, so this screen
  // costs no extra requests once either has been visited.
  const { data: mine } = useMyListings();
  const { data: saved } = useSavedListings();
  const activeCount = mine?.filter((l) => l.status === "ACTIVE").length;

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
            only content on this screen that is about the person, not a setting.
            The stats strip lives inside it — the numbers are also about them. */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.xxl,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
            ...shadow.card,
          }}
        >
          <View
            style={{
              alignItems: "center",
              gap: spacing.md,
              paddingVertical: spacing.lg,
              paddingHorizontal: spacing.md,
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

          <View
            style={{
              flexDirection: "row",
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <StatCell
              label={t("profile.statListings")}
              value={mine?.length}
              onPress={() => router.push("/(tabs)/places")}
            />
            <StatCell
              label={t("profile.statActive")}
              value={activeCount}
              divider
              onPress={() => router.push("/(tabs)/places")}
            />
            <StatCell
              label={t("profile.statSaved")}
              value={saved?.length}
              divider
              onPress={() => router.push("/(tabs)/saved")}
            />
          </View>
        </View>

        <Section title={t("profile.links")}>
          <Card flush>
            {LINKS.map((link, index) => (
              <Pressable
                key={link.key}
                onPress={() => router.push(link.href)}
                accessibilityRole="button"
                accessibilityLabel={t(link.labelKey)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.md,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                  backgroundColor: pressed
                    ? colors.surfaceRaised
                    : "transparent",
                })}
              >
                <Ionicons name={link.icon} size={20} color={colors.primary} />
                <Text style={{ ...text.bodyStrong, flex: 1 }}>
                  {t(link.labelKey)}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textFaint}
                />
              </Pressable>
            ))}
          </Card>
        </Section>

        {/* Above the settings groups: it is about the person, like the
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

        <Text style={{ ...text.caption, textAlign: "center" }}>
          {t("about.version", {
            version: Constants.expoConfig?.version ?? "1.0.0",
          })}
        </Text>
      </View>
    </Screen>
  );
}

function StatCell({
  label,
  value,
  divider,
  onPress,
}: {
  label: string;
  /** undefined while the backing query has not resolved yet. */
  value: number | undefined;
  divider?: boolean;
  onPress: () => void;
}) {
  const { colors, text } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? "—"}`}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        gap: 2,
        paddingVertical: spacing.md,
        borderLeftWidth: divider ? 1 : 0,
        borderLeftColor: colors.border,
        backgroundColor: pressed ? colors.surfaceRaised : "transparent",
      })}
    >
      <Text style={text.heading}>{value ?? "—"}</Text>
      <Text style={{ ...type.caption, fontSize: 12, color: colors.textMuted }}>
        {label}
      </Text>
    </Pressable>
  );
}
