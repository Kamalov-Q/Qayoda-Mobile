// app/(tabs)/about.tsx
// About the app. The prose is placeholder; the contact values are dummies to
// be replaced when the real ones exist. Structure and rows are final.
import { Text, View, Pressable, Linking } from "react-native";
import Constants from "expo-constants";
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
import { useT, type TranslationKey } from "../../src/i18n";
import { toast } from "../../src/components/ui/Toast";

// Dummy contact details — swap for the real ones. Not translated: an email
// address is the same in every language.
const CONTACTS = [
  {
    labelKey: "about.contactEmail" as TranslationKey,
    icon: "mail-outline",
    value: "support@qayoda.uz",
    url: "mailto:support@qayoda.uz",
  },
  {
    labelKey: "about.contactPhone" as TranslationKey,
    icon: "call-outline",
    value: "+998 71 200 00 00",
    url: "tel:+998712000000",
  },
  {
    labelKey: "about.contactWebsite" as TranslationKey,
    icon: "globe-outline",
    value: "qayoda.uz",
    url: "https://qayoda.uz",
  },
] as const;

const LEGAL = [
  { labelKey: "about.terms" as TranslationKey, icon: "document-text-outline" },
  { labelKey: "about.privacy" as TranslationKey, icon: "shield-checkmark-outline" },
] as const;

export default function AboutScreen() {
  const { text } = useTheme();
  const t = useT();
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
                // No documents exist yet — an honest "coming soon" beats a
                // link that opens nothing.
                onPress={() => toast.infoKey("about.soon")}
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
