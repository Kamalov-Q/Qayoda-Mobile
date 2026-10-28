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
import { spacing, radii, weight } from "../src/theme/tokens";
import { useTheme, useThemeMode } from "../src/theme/useTheme";
import {
  usePreferences,
  type Currency,
  type ThemeMode,
} from "../src/lib/preferences";
import {
  useT,
  useLanguage,
  type Language,
  type TranslationKey,
} from "../src/i18n";
import { useIsAuthed } from "../src/features/auth/guest";
import { SignInMethods } from "../src/features/auth/components/SignInMethods";
import { useSupportUnread } from "../src/features/support/hooks/useSupport";
import { useVerification } from "../src/features/verification/hooks/useVerification";
import { MiniLocationMap } from "../src/features/map/MiniLocationMap";
import { useRates } from "../src/features/listings/hooks/useRates";

export default function SettingsScreen() {
  const supportUnread = useSupportUnread();
  const verification = useVerification();
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
      {
        value: "system",
        label: t("settings.themeSystem"),
        icon: "contrast-outline",
      },
      {
        value: "light",
        label: t("settings.themeLight"),
        icon: "sunny-outline",
      },
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
        {/* First: the badge is the thing on this screen that changes how
            other people see you, and it is the reason most people open
            settings from a profile at all. */}
        {authed ? (
          <Section title={t("verify.title")}>
            <Pressable
              onPress={() => router.push("/verify-profile")}
              accessibilityRole="button"
              accessibilityLabel={t("verify.title")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed
                  ? colors.surfaceRaised
                  : colors.surface,
              })}
            >
              <Ionicons
                name={
                  verification.data?.isVerified
                    ? "checkmark-circle"
                    : "shield-checkmark-outline"
                }
                size={20}
                color={colors.primary}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={text.bodyStrong}>{t("verify.title")}</Text>
                {/* Says where you stand rather than repeating the heading:
                    somebody who applied last night wants that answer here,
                    not one screen further in. */}
                <Text style={text.caption}>
                  {verification.data?.isVerified
                    ? t("verify.verifiedTitle")
                    : verification.data?.request?.status === "PENDING"
                      ? t("verify.pendingTitle")
                      : verification.data?.request?.status === "REJECTED"
                        ? t("verify.rejectedTitle")
                        : t("verify.hint")}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textFaint}
              />
            </Pressable>
          </Section>
        ) : null}

        {/* Then, and only when signed in: the one part of settings that is
            about what you did rather than how the app behaves. */}
        {authed ? (
          <Section title={t("activity.title")}>
            <Pressable
              onPress={() => router.push("/activity")}
              accessibilityRole="button"
              accessibilityLabel={t("activity.title")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed
                  ? colors.surfaceRaised
                  : colors.surface,
              })}
            >
              <Ionicons name="pulse-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={text.bodyStrong}>{t("activity.title")}</Text>
                <Text style={text.caption}>{t("activity.intro")}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textFaint}
              />
            </Pressable>
          </Section>
        ) : null}

        {/* Straight after activity: when someone opens Settings with a
            problem, this is what they were looking for. */}
        {authed ? (
          <Section title={t("support.title")}>
            <Pressable
              onPress={() => router.push("/support")}
              accessibilityRole="button"
              accessibilityLabel={t("support.title")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed
                  ? colors.surfaceRaised
                  : colors.surface,
              })}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={20}
                color={colors.primary}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={text.bodyStrong}>{t("support.title")}</Text>
                <Text style={text.caption}>{t("support.hint")}</Text>
              </View>
              {supportUnread > 0 ? (
                <View
                  style={{
                    minWidth: 22,
                    height: 22,
                    paddingHorizontal: 6,
                    borderRadius: radii.pill,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.primary,
                  }}
                >
                  <Text
                    style={{
                      ...text.caption,
                      color: colors.onPrimary,
                      ...weight("700"),
                    }}
                  >
                    {supportUnread}
                  </Text>
                </View>
              ) : null}
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textFaint}
              />
            </Pressable>
          </Section>
        ) : null}

        {/* Which ways in this account has — a number, a Telegram login, or
            both. No password row: there are no passwords any more, here or
            on the way in. A number that can receive an SMS is the whole
            credential. */}
        {authed ? (
          <Section title={t("auth.methods")}>
            <SignInMethods />
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
          <RateNote />
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
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textFaint}
              />
            </Pressable>
          </Card>
        </Section>

        {/* Last, and only for a signed-in account. Apple requires the path to
            account deletion to be reachable from inside the app, and settings
            is the first place a reviewer looks for it. */}
        {authed ? (
          <Section title={t("deleteAccount.title")}>
            <Card flush>
              <Pressable
                onPress={() => router.push("/delete-account")}
                accessibilityRole="button"
                accessibilityLabel={t("deleteAccount.title")}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.md,
                  backgroundColor: pressed
                    ? colors.surfaceRaised
                    : "transparent",
                })}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={colors.danger}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ ...text.bodyStrong, color: colors.danger }}>
                    {t("deleteAccount.title")}
                  </Text>
                  <Text style={text.caption}>{t("deleteAccount.intro")}</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textFaint}
                />
              </Pressable>
            </Card>
          </Section>
        ) : null}

        <Text style={{ ...text.caption, textAlign: "center" }}>
          {t("about.version", {
            version: Constants.expoConfig?.version ?? "1.0.0",
          })}
        </Text>
      </View>
    </Screen>
  );
}

/**
 * The rate every converted price on screen is computed from, and where it
 * came from.
 *
 * Shown because the app silently rewrites prices: a listing quoted in so'm
 * is displayed in dollars to anybody whose currency is set to USD, and until
 * now nothing said what it was divided by. When the server cannot reach the
 * Central Bank it falls back to a market aggregate — close, but not the
 * figure a seller will check their own price against — and if both fail it
 * uses a hardcoded constant that can be several percent out. A converted
 * price with no provenance is a number the reader cannot argue with.
 *
 * Silent when the viewer's currency is the one the rate does not affect?
 * No — both directions convert, so it is shown either way.
 */
function RateNote() {
  const { colors, text } = useTheme();
  const t = useT();
  const language = useLanguage();
  const { data } = useRates();

  if (!data?.usdToUzs) return null;

  // `source` is absent from an API that predates it. Saying nothing beats
  // guessing: the rate itself is still worth printing.
  const source = data.source;

  // Severity follows the source, because the error does. A market aggregate
  // sits about 1% from the Central Bank's figure — a caveat, stated in words
  // and not worth shouting. The hardcoded constant is whatever the som has
  // done since somebody typed it, which was about 7% when this was written,
  // and that IS worth a colour: every price on screen is wrong by it.
  const alarming = source === "CONSTANT";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginLeft: spacing.xs,
      }}
    >
      <Ionicons
        name={alarming ? "alert-circle-outline" : "swap-horizontal-outline"}
        size={13}
        color={alarming ? colors.danger : colors.textFaint}
      />
      <Text style={{ ...text.caption, flex: 1 }} numberOfLines={2}>
        {t("settings.rateLine", {
          rate: Math.round(data.usdToUzs).toLocaleString(language),
        })}
        {source ? ` · ${t(`settings.rateSource${source}` as TranslationKey)}` : ""}
      </Text>
    </View>
  );
}
