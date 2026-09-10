// app/telegram.tsx — the "waiting for the bot" screen.
//
// Reached from the welcome screen (sign in) and from the account screen with
// ?link=1 (attach Telegram to the signed-in account). The hook does the whole
// handshake; this screen only shows where it is and offers the two actions
// that make sense while waiting: re-open Telegram, or start over.
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  Screen,
  Button,
  ErrorBanner,
  BackButton,
  LanguageSwitcher,
} from "../src/components/ui";
import { spacing, radii, type } from "../src/theme/tokens";
import { useTheme } from "../src/theme/useTheme";
import { useT } from "../src/i18n";
import { errorMessage } from "../src/lib/api-error";
import { useTelegramSignIn } from "../src/features/auth/hooks/useAuth";

export default function TelegramScreen() {
  const { link } = useLocalSearchParams<{ link?: string }>();
  const { phase, session, error, restart, openTelegram } = useTelegramSignIn(
    link === "1",
  );
  const { text, colors } = useTheme();
  const t = useT();

  return (
    <Screen centered>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <BackButton />
            <LanguageSwitcher />
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={text.display}>{t("auth.telegramTitle")}</Text>
            <Text style={text.caption}>{t("auth.telegramSubtitle")}</Text>
          </View>
        </View>

        {/* The bot shows the same code in its confirmation, so a user with two
            sessions open can tell which one they are approving. */}
        <View
          style={{
            alignSelf: "center",
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.xl,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.primaryBorder,
            backgroundColor: colors.primarySoft,
          }}
        >
          <Text
            style={{
              ...type.display,
              fontSize: 32,
              letterSpacing: 6,
              color: colors.primary,
              fontVariant: ["tabular-nums"],
            }}
          >
            {session?.shortCode ?? "······"}
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          {(phase === "starting" || phase === "waiting") && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
              }}
            >
              <ActivityIndicator color={colors.primary} />
              <Text style={text.caption}>{t("auth.telegramWaiting")}</Text>
            </View>
          )}

          <ErrorBanner
            message={
              phase === "expired"
                ? t("auth.telegramExpired")
                : phase === "error"
                  ? errorMessage(error)
                  : null
            }
          />

          {phase === "waiting" ? (
            <Button title={t("auth.telegramOpen")} onPress={openTelegram} />
          ) : phase !== "starting" ? (
            <Button title={t("common.retry")} onPress={restart} />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
