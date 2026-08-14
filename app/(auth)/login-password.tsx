// app/(auth)/login-password.tsx
import { useMemo, useRef } from "react";
import { Text, View, TextInput } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Screen,
  Button,
  TextField,
  ErrorBanner,
  BackButton,
  LanguageSwitcher,
} from "../../src/components/ui";
import { spacing } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";
import { errorMessage } from "../../src/lib/api-error";
import { useLoginWithPassword } from "../../src/features/auth/hooks/useAuth";

const makeSchema = (t: ReturnType<typeof useT>) =>
  z.object({
    email: z.string().email(t("validation.emailInvalid")),
    password: z.string().min(1, t("validation.passwordRequired")),
  });

type FormData = z.infer<ReturnType<typeof makeSchema>>;

export default function LoginPasswordScreen() {
  const login = useLoginWithPassword();
  const passwordRef = useRef<TextInput>(null);
  const { text } = useTheme();
  const t = useT();

  const schema = useMemo(() => makeSchema(t), [t]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit((d) =>
    login.mutate({ email: d.email.trim().toLowerCase(), password: d.password }),
  );

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
            <Text style={text.display}>{t("auth.loginWithPasswordTitle")}</Text>
            <Text style={text.caption}>
              {t("auth.loginWithPasswordSubtitle")}
            </Text>
          </View>
        </View>

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
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                ref={passwordRef}
                label={t("auth.password")}
                placeholder={t("auth.passwordPlaceholder")}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
              />
            )}
          />

          <ErrorBanner
            message={login.isError ? errorMessage(login.error) : null}
          />

          <Button
            title={t("auth.login")}
            onPress={onSubmit}
            loading={login.isPending}
          />
        </View>
      </View>
    </Screen>
  );
}
