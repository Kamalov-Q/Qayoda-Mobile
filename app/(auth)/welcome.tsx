// app/(auth)/welcome.tsx
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router } from "expo-router";
import {
  Screen,
  Button,
  TextField,
  SegmentedControl,
  ErrorBanner,
  BrandMark,
  LanguageSwitcher,
} from "../../src/components/ui";
import { spacing } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";
import { errorMessage } from "../../src/lib/api-error";
import { useRequestOtp } from "../../src/features/auth/hooks/useAuth";
import { useAuthFlowStore } from "../../src/features/auth/store/auth-flow.store";

// Only the two purposes this screen can start; the store's OtpPurpose also
// covers CHANGE_EMAIL / RESET_PASSWORD, which are driven from elsewhere.
type Intent = "LOGIN" | "REGISTER";

// Validation messages are user-facing, so the schema is rebuilt whenever the
// language changes rather than frozen at module load.
const makeSchema = (t: ReturnType<typeof useT>) =>
  z.object({ email: z.string().email(t("validation.emailInvalid")) });

type FormData = z.infer<ReturnType<typeof makeSchema>>;

export default function WelcomeScreen() {
  const [intent, setIntent] = useState<Intent>("LOGIN");
  const setEmailAndPurpose = useAuthFlowStore((s) => s.setEmailAndPurpose);
  const requestOtp = useRequestOtp();
  const { text } = useTheme();
  const t = useT();

  const schema = useMemo(() => makeSchema(t), [t]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" }, // prevents "uncontrolled to controlled" warning
  });

  const segments = useMemo(
    () =>
      [
        { value: "LOGIN", label: t("auth.login") },
        { value: "REGISTER", label: t("auth.register") },
      ] as const satisfies readonly { value: Intent; label: string }[],
    [t],
  );

  const onSubmit = ({ email }: FormData) => {
    const normalized = email.trim().toLowerCase();
    setEmailAndPurpose(normalized, intent);
    requestOtp.mutate({ email: normalized, purpose: intent });
  };

  const isLogin = intent === "LOGIN";

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
            <BrandMark />
            <LanguageSwitcher />
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={text.display}>
              {t(isLogin ? "auth.welcomeTitle" : "auth.registerTitle")}
            </Text>
            <Text style={text.caption}>
              {t(isLogin ? "auth.welcomeSubtitle" : "auth.registerSubtitle")}
            </Text>
          </View>
        </View>

        <SegmentedControl
          segments={segments}
          value={intent}
          onChange={setIntent}
        />

        <View style={{ gap: spacing.md }}>
          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t("auth.email")}
                placeholder={t("auth.emailPlaceholder")}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="go"
                onSubmitEditing={handleSubmit(onSubmit)}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
              />
            )}
          />

          <ErrorBanner
            message={requestOtp.isError ? errorMessage(requestOtp.error) : null}
          />

          <Button
            title={t("common.continue")}
            onPress={handleSubmit(onSubmit)}
            loading={requestOtp.isPending}
          />

          {isLogin && (
            <Button
              title={t("auth.loginWithPassword")}
              variant="link"
              onPress={() => router.push("/(auth)/login-password")}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}
