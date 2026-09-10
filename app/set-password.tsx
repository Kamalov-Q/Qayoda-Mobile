// app/set-password.tsx — the step right after onboarding for phone accounts:
// pick the password that phone+password login will use from now on. Forced
// (no back), same as onboarding: reached only via router.replace, and the
// "must set a password" routing in establishSession brings a user who killed
// the app straight back here on their next OTP login.
import { useMemo, useRef } from "react";
import { Text, TextInput, View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Redirect } from "expo-router";
import {
  Screen,
  Button,
  TextField,
  ErrorBanner,
  LanguageSwitcher,
} from "../src/components/ui";
import { spacing } from "../src/theme/tokens";
import { useTheme } from "../src/theme/useTheme";
import { useT } from "../src/i18n";
import { errorMessage } from "../src/lib/api-error";
import { useAuthStore } from "../src/features/auth/store/auth.store";
import { useSetPassword } from "../src/features/auth/hooks/useAuth";

export const makePasswordSchema = (t: ReturnType<typeof useT>) =>
  z
    .object({
      password: z
        .string()
        .min(6, t("validation.minChars", { count: 6 }))
        .max(64, t("validation.maxChars", { count: 64 })),
      repeat: z.string(),
    })
    .refine((d) => d.password === d.repeat, {
      message: t("validation.passwordMismatch"),
      path: ["repeat"],
    });

type FormData = z.infer<ReturnType<typeof makePasswordSchema>>;

export default function SetPasswordScreen() {
  const user = useAuthStore((s) => s.user);
  const setPassword = useSetPassword();
  const repeatRef = useRef<TextInput>(null);
  const { text } = useTheme();
  const t = useT();

  const schema = useMemo(() => makePasswordSchema(t), [t]);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", repeat: "" },
  });

  // Deep link / reload safety net.
  if (!user) return <Redirect href="/(tabs)/home" />;

  const onSubmit = handleSubmit((d) => setPassword.mutate(d.password));

  return (
    <Screen centered>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.md }}>
          <View style={{ alignItems: "flex-end" }}>
            <LanguageSwitcher />
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={text.display}>{t("auth.setPasswordTitle")}</Text>
            <Text style={text.caption}>{t("auth.setPasswordSubtitle")}</Text>
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          {user.phoneNumber ? (
            <Text style={text.caption}>
              {t("auth.phone")}: {user.phoneNumber}
            </Text>
          ) : null}

          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t("auth.password")}
                placeholder={t("auth.passwordPlaceholder")}
                secureTextEntry
                autoComplete="new-password"
                autoFocus
                returnKeyType="next"
                onSubmitEditing={() => repeatRef.current?.focus()}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="repeat"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                ref={repeatRef}
                label={t("auth.passwordRepeat")}
                placeholder={t("auth.passwordPlaceholder")}
                secureTextEntry
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={onSubmit}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.repeat?.message}
              />
            )}
          />

          <ErrorBanner
            message={setPassword.isError ? errorMessage(setPassword.error) : null}
          />

          <Button
            title={t("auth.finish")}
            onPress={onSubmit}
            loading={setPassword.isPending}
          />
        </View>
      </View>
    </Screen>
  );
}
