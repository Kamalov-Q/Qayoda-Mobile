// The "how you sign in" rows on the account screen: one per provider, linked
// or not, with the action that flips it. The server refuses to unlink the
// last one (LAST_IDENTITY), so that row shows no button at all rather than a
// button that only ever errors.
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../../../components/ui";
import { spacing } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT } from "../../../i18n";
import { confirm } from "../../../lib/alerts";
import type { AuthProvider } from "../api/auth.api";
import { isGoogleSignInAvailable } from "../google";
import {
  linkTelegram,
  useIdentities,
  useLinkGoogle,
  useUnlink,
} from "../hooks/useIdentities";

const ROWS: {
  provider: AuthProvider;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: "auth.methodPhone" | "auth.methodGoogle" | "auth.methodTelegram";
}[] = [
  { provider: "PHONE", icon: "call-outline", labelKey: "auth.methodPhone" },
  { provider: "GOOGLE", icon: "logo-google", labelKey: "auth.methodGoogle" },
  { provider: "TELEGRAM", icon: "paper-plane-outline", labelKey: "auth.methodTelegram" },
];

export function SignInMethods() {
  const { data, isLoading } = useIdentities();
  const linkGoogle = useLinkGoogle();
  const unlink = useUnlink();
  const { colors, text } = useTheme();
  const t = useT();

  const linked = new Set(data?.map((i) => i.provider));
  const canUnlink = linked.size > 1;

  const onUnlink = (provider: AuthProvider) =>
    confirm({
      titleKey: "auth.unlinkConfirmTitle",
      messageKey: "auth.unlinkConfirmMessage",
      confirmKey: "auth.unlink",
      destructive: true,
      onConfirm: () => unlink.mutate(provider),
    });

  return (
    <Card flush>
      {ROWS.map((row, index) => {
        const isLinked = linked.has(row.provider);
        // A phone can only be added by signing in with it — there is no
        // "link phone" endpoint — so its row has no add action.
        const canLink =
          row.provider === "GOOGLE"
            ? isGoogleSignInAvailable()
            : row.provider === "TELEGRAM";
        const busy =
          (row.provider === "GOOGLE" && linkGoogle.isPending) ||
          (unlink.isPending && unlink.variables === row.provider);

        const action = isLinked
          ? canUnlink
            ? { label: t("auth.unlink"), onPress: () => onUnlink(row.provider), danger: true }
            : null
          : canLink
            ? {
                label: t("auth.link"),
                onPress: () =>
                  row.provider === "GOOGLE" ? linkGoogle.mutate() : linkTelegram(),
                danger: false,
              }
            : null;

        return (
          <View
            key={row.provider}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              padding: spacing.md,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}
          >
            <Ionicons
              name={row.icon}
              size={20}
              color={isLinked ? colors.primary : colors.textFaint}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={text.bodyStrong}>{t(row.labelKey)}</Text>
              <Text style={text.caption}>
                {isLoading
                  ? "…"
                  : t(isLinked ? "auth.linked" : "auth.notLinked")}
              </Text>
            </View>
            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : action ? (
              <Pressable
                onPress={action.onPress}
                accessibilityRole="button"
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Text
                  style={{
                    ...text.bodyStrong,
                    color: action.danger ? colors.danger : colors.primary,
                  }}
                >
                  {action.label}
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}
