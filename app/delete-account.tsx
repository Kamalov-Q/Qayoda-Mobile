// app/delete-account.tsx
// Deleting your own account.
//
// A screen rather than a dialog on purpose. Both stores require this path to
// exist and to be reachable without support, and a reviewer has to be able to
// read what it does before tapping it — a two-line alert cannot say which
// records survive and which do not. It also gives the wallet warning somewhere
// to live, which is the one consequence money can be lost to.
import { useState } from "react";
import { Text, View } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Button,
  Card,
  Section,
  TextField,
  HEADER_EDGES,
} from "../src/components/ui";
import { spacing, type } from "../src/theme/tokens";
import { useTheme } from "../src/theme/useTheme";
import { useT, type TranslationKey } from "../src/i18n";
import { confirm } from "../src/lib/alerts";
import { useIsAuthed } from "../src/features/auth/guest";
import { RedirectToSignIn } from "../src/features/auth/components/RedirectToSignIn";
import { useDeleteAccount } from "../src/features/profile/hooks/useDeleteAccount";
import { useWalletOverview } from "../src/features/wallet/hooks/useWalletOverview";

const REASON_MAX = 500;

/** Mirrors section 3 of the published deletion page, in the same order. */
const REMOVED: TranslationKey[] = [
  "deleteAccount.goesProfile",
  "deleteAccount.goesListings",
  "deleteAccount.goesVideos",
  "deleteAccount.goesContacts",
  "deleteAccount.goesPush",
];

/** And section 4 — the records that outlive the account, and why. */
const KEPT: TranslationKey[] = [
  "deleteAccount.staysMessages",
  "deleteAccount.staysPayments",
];

export default function DeleteAccountScreen() {
  const { colors, text } = useTheme();
  const t = useT();
  const authed = useIsAuthed();
  const [reason, setReason] = useState("");
  const remove = useDeleteAccount();
  const wallet = useWalletOverview();

  if (!authed) {
    return (
      <Screen style={{ paddingTop: spacing.md }} edges={HEADER_EDGES}>
        <RedirectToSignIn />
      </Screen>
    );
  }

  const hasBalance = (wallet.data?.balanceTiyin ?? 0) > 0;

  const onDelete = () =>
    confirm({
      titleKey: "deleteAccount.confirmTitle",
      messageKey: "deleteAccount.confirmMessage",
      confirmKey: "deleteAccount.action",
      destructive: true,
      onConfirm: () => remove.mutate(reason.trim() || undefined),
    });

  return (
    <Screen style={{ paddingTop: spacing.md }} edges={HEADER_EDGES}>
      {/* Not registered in the root Stack, so without this the header shows
          the route segment — "delete-account" — instead of a title. */}
      <Stack.Screen options={{ title: t("deleteAccount.title") }} />

      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={text.display}>{t("deleteAccount.title")}</Text>
          <Text style={text.caption}>{t("deleteAccount.intro")}</Text>
        </View>

        {/* Shown only when there is money to lose: a standing warning on an
            empty wallet is noise, and noise is what gets skipped. */}
        {hasBalance ? (
          <Card
            style={{
              backgroundColor: colors.dangerSurface,
              borderColor: colors.dangerBorder,
            }}
          >
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Ionicons name="wallet-outline" size={20} color={colors.danger} />
              <Text style={{ ...text.body, flex: 1 }}>
                {t("deleteAccount.balanceWarning", {
                  balance: wallet.data?.balance ?? "",
                })}
              </Text>
            </View>
          </Card>
        ) : null}

        <Section title={t("deleteAccount.removedTitle")}>
          <Card>
            <View style={{ gap: spacing.sm }}>
              {REMOVED.map((key) => (
                <Row key={key} icon="close-circle" tone={colors.danger}>
                  {t(key)}
                </Row>
              ))}
            </View>
          </Card>
        </Section>

        <Section title={t("deleteAccount.keptTitle")}>
          <Card>
            <View style={{ gap: spacing.sm }}>
              {KEPT.map((key) => (
                <Row key={key} icon="shield-checkmark" tone={colors.textMuted}>
                  {t(key)}
                </Row>
              ))}
            </View>
          </Card>
        </Section>

        <Section title={t("deleteAccount.reasonTitle")}>
          <TextField
            label={undefined}
            value={reason}
            onChangeText={setReason}
            placeholder={t("deleteAccount.reasonPlaceholder")}
            multiline
            maxLength={REASON_MAX}
          />
        </Section>

        <Button
          title={t("deleteAccount.action")}
          icon="trash-outline"
          variant="danger"
          onPress={onDelete}
          loading={remove.isPending}
        />

        <Text style={{ ...text.caption, textAlign: "center" }}>
          {t("deleteAccount.footnote")}
        </Text>
      </View>
    </Screen>
  );
}

function Row({
  icon,
  tone,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  children: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      <Ionicons name={icon} size={16} color={tone} style={{ marginTop: 2 }} />
      <Text style={{ ...type.body, color: colors.text, flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}
