// What a guest sees where a personal screen would be: one card that says why
// the screen is empty and the single action that fixes it.
import { View, Text } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../../components/ui";
import { spacing } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT } from "../../../i18n";

export function GuestPrompt({ subtitle }: { subtitle?: string }) {
  const { colors, text } = useTheme();
  const t = useT();

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.md,
        padding: spacing.xl,
      }}
    >
      <Ionicons name="person-circle-outline" size={48} color={colors.primary} />
      <View style={{ gap: spacing.xs, alignItems: "center" }}>
        <Text style={{ ...text.heading, textAlign: "center" }}>
          {t("auth.guestTitle")}
        </Text>
        <Text style={{ ...text.caption, textAlign: "center" }}>
          {subtitle ?? t("auth.guestSubtitle")}
        </Text>
      </View>
      <Button
        title={t("auth.signIn")}
        icon="log-in-outline"
        onPress={() => router.push("/(auth)/welcome")}
        style={{ alignSelf: "stretch" }}
      />
    </View>
  );
}
