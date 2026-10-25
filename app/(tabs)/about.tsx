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
] as const;

/**
 * The documents, hosted rather than bundled.
 *
 * Google Play and the App Store both require the privacy policy and the
 * account-deletion page to be reachable at a public URL, so the website holds
 * the only copy — a correction there needs no new build.
 *
 * Uzbek lives at the root and Russian under /ru/, which is why the language
 * is a path segment rather than a query: the pages link to each other.
 */
const LEGAL_BASE = "https://api.growencity.uz/legal";

const LEGAL = [
  {
    labelKey: "about.privacy" as TranslationKey,
    icon: "shield-checkmark-outline",
    file: "privacy.html",
  },
  {
    labelKey: "about.offer" as TranslationKey,
    icon: "document-text-outline",
    file: "offer.html",
  },
  {
    labelKey: "about.deleteAccount" as TranslationKey,
    icon: "trash-outline",
    file: "delete-account.html",
  },
] as const;

export default function AboutScreen() {
  const { text } = useTheme();
  const t = useT();
  const language = useLanguage();
  const legalDir = language === "ru" ? `${LEGAL_BASE}/ru` : LEGAL_BASE;
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
                    `${legalDir}/${row.file}`,
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
  divider,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  divider: boolean;
  onPress: () => void;
}) {
  const { colors, text } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
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
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}
