// app/(tabs)/about.tsx
// About the app. The description is still placeholder prose; the contacts and
// the document links are real.
import { Text, View, Pressable, Linking } from "react-native";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Card,
  Section,
  BrandMark,
  TAB_EDGES,
} from "../../src/components/ui";
import { spacing, type } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT, useLanguage, type TranslationKey } from "../../src/i18n";

// Not translated: a phone number and an email address read the same in every
// language.
const CONTACTS = [
  {
    labelKey: "about.contactEmail" as TranslationKey,
    icon: "mail-outline",
    value: "agromind5229@gmail.com",
    url: "mailto:agromind5229@gmail.com",
  },
  {
    labelKey: "about.contactPhone" as TranslationKey,
    icon: "call-outline",
    value: "+998 95 555 52 29",
    url: "tel:+998955555229",
  },
  {
    // The same number as support, deliberately shown twice.
    //
    // An agency or a developer looking to advertise does not read "Telefon"
    // as an invitation — it reads as the line you ring when the app is
    // broken. A row that says what it is for is the whole point, and one
    // number is easier to answer than two.
    labelKey: "about.contactPartnership" as TranslationKey,
    hintKey: "about.contactPartnershipHint" as TranslationKey,
    icon: "briefcase-outline",
    value: "+998 95 555 52 29",
    url: "tel:+998955555229",
  },
  {
    // The key existed and nothing used it. The site is live now, and it is
    // where the legal documents below actually live.
    labelKey: "about.contactWebsite" as TranslationKey,
    icon: "globe-outline",
    value: "growencity.uz",
    url: "https://growencity.uz",
  },
] as const;

/**
 * The documents, on the WEBSITE rather than bundled or on the API.
 *
 * Google Play and the App Store both require the privacy policy and the
 * account-deletion page at a public URL, so a hosted copy is not optional —
 * and a correction to a hosted copy needs no new build.
 *
 * ── Why these moved off api.growencity.uz ──────────────────────────────────
 *
 * They used to be static HTML served by the API's nginx, from before the
 * website existed. The website then grew real pages for the same three
 * documents, and there were two copies of the same legal text with nothing
 * keeping them in step.
 *
 * They drifted within weeks, in the direction nobody would guess: the static
 * files had the current contact details and the maintained website pages had
 * the old ones. Which copy is right is not a question a privacy policy
 * should raise.
 *
 * The website is the one copy now. It is also the URL Play and App Store
 * Connect are given, so a reviewer and a user read the same page — and the
 * language toggle, the contents sidebar and the contact block come with it,
 * none of which the static files had.
 *
 * The old /legal/*.html files can stay where they are: a store listing or a
 * screenshot somewhere may still point at them. They should be replaced with
 * redirects to these paths, so there is one document and one URL for it.
 */
const SITE = "https://growencity.uz";

const LEGAL = [
  {
    labelKey: "about.privacy" as TranslationKey,
    icon: "shield-checkmark-outline",
    path: "privacy",
  },
  {
    // "Public offer" is the terms of use — the website calls the same
    // document by its own name.
    labelKey: "about.offer" as TranslationKey,
    icon: "document-text-outline",
    path: "terms",
  },
  {
    labelKey: "about.deleteAccount" as TranslationKey,
    icon: "trash-outline",
    path: "account-deletion",
  },
] as const;

export default function AboutScreen() {
  const { text } = useTheme();
  const t = useT();
  const language = useLanguage();
  // The website carries the language as the first path segment for BOTH
  // languages — there is no bare root. `/ru/privacy`, `/uz/privacy`.
  const legalDir = `${SITE}/${language === "ru" ? "ru" : "uz"}`;
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <Screen style={{ paddingTop: spacing.md }} edges={TAB_EDGES}>
      <View style={{ gap: spacing.xl }}>
        <Text style={text.display}>{t("about.title")}</Text>

        {/* Identity block, mirroring the profile screen's banner. */}
        <View
          style={{
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: spacing.lg,
          }}
        >
          <BrandMark />
          <Text style={text.caption}>{t("about.version", { version })}</Text>
        </View>

        <Section title={t("about.descriptionTitle")}>
          <Card>
            <Text style={text.body}>{t("about.description")}</Text>
          </Card>
        </Section>

        <Section title={t("about.contactTitle")}>
          <Card flush>
            {CONTACTS.map((row, index) => (
              <InfoRow
                key={row.labelKey}
                icon={row.icon}
                label={t(row.labelKey)}
                value={row.value}
                hint={"hintKey" in row ? t(row.hintKey) : undefined}
                divider={index > 0}
                onPress={() => Linking.openURL(row.url).catch(() => {})}
              />
            ))}
          </Card>
        </Section>

        <Section title={t("about.legalTitle")}>
          <Card flush>
            {LEGAL.map((row, index) => (
              <InfoRow
                key={row.labelKey}
                icon={row.icon}
                label={t(row.labelKey)}
                divider={index > 0}
                onPress={() => {
                  WebBrowser.openBrowserAsync(
                    `${legalDir}/${row.path}`,
                  ).catch(() => {});
                }}
              />
            ))}
          </Card>
        </Section>
      </View>
    </Screen>
  );
}

function InfoRow({
  icon,
  label,
  value,
  hint,
  divider,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  /** What the row is FOR, when the label alone does not say it. */
  hint?: string;
  divider: boolean;
  onPress: () => void;
}) {
  const { colors, text } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        [label, value, hint].filter(Boolean).join(', ')
      }
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: colors.border,
        backgroundColor: pressed ? colors.surfaceRaised : "transparent",
      })}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={text.bodyStrong}>{label}</Text>
        {value ? (
          <Text style={{ ...type.caption, color: colors.textMuted }}>
            {value}
          </Text>
        ) : null}
        {hint ? (
          <Text style={{ ...type.caption, color: colors.textFaint }}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}
