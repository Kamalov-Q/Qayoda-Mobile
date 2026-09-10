// app/change-password.tsx — from Settings. Proving the current password is
// the whole point: a phone left unlocked must not be enough to swap the lock.
// Accounts that never set one (OTP/Telegram/Google-only) skip that field.
import { useMemo, useRef } from "react";
import { Text, TextInput, View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import {
  Screen,
  Button,
  TextField,
  ErrorBanner,
  HEADER_EDGES,
  toast,
} from "../src/components/ui";
import { spacing } from "../src/theme/tokens";
import { useTheme } from "../src/theme/useTheme";
import { useT } from "../src/i18n";
import { errorMessage } from "../src/lib/api-error";
import { authApi } from "../src/features/auth/api/auth.api";
import { useAuthStore } from "../src/features/auth/store/auth.store";

const makeSchema = (t: ReturnType<typeof useT>, needsCurrent: boolean) =>
  z
    .object({
      current: needsCurrent
        ? z.string().min(1, t("validation.required"))
        : z.string().optional(),
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

type FormData = z.infer<ReturnType<typeof makeSchema>>;

export default function ChangePasswordScreen() {
  const user = useAuthStore((s) => s.user);
  const needsCurrent = !!user?.hasPassword;
  const newRef = useRef<TextInput>(null);
  const repeatRef = useRef<TextInput>(null);
  const { text } = useTheme();
  const t = useT();

  const change = useMutation({
    mutationFn: (d: FormData) =>
      authApi.setPassword(d.password, needsCurrent ? d.current : undefined),
    onSuccess: () => {
      const { accessToken, user: u, setSession } = useAuthStore.getState();
      if (accessToken && u) setSession(accessToken, { ...u, hasPassword: true });
      toast.successKey("auth.passwordChanged");
      router.back();
    },
  });

  const schema = useMemo(
    () => makeSchema(t, needsCurrent),
    [t, needsCurrent],
  );
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { current: "", password: "", repeat: "" },
  });

  const onSubmit = handleSubmit((d) => change.mutate(d));

  return (
    <Screen edges={HEADER_EDGES}>
      <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
        <Text style={text.caption}>{t("auth.setPasswordSubtitle")}</Text>

        {needsCurrent ? (
          <Controller
            control={control}
            name="current"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t("auth.currentPassword")}
                placeholder={t("auth.passwordPlaceholder")}
                secureTextEntry
                autoComplete="current-password"
                autoFocus
                returnKeyType="next"
                onSubmitEditing={() => newRef.current?.focus()}
                value={value ?? ""}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.current?.message}
              />
            )}
          />
        ) : null}

        <Controller
          control={control}
          name="password"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              ref={newRef}
              label={t("auth.password")}
              placeholder={t("auth.passwordPlaceholder")}
              secureTextEntry
              autoComplete="new-password"
              autoFocus={!needsCurrent}
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
          message={change.isError ? errorMessage(change.error) : null}
        />

        <Button
          title={t("common.confirm")}
          onPress={onSubmit}
          loading={change.isPending}
        />
      </View>
    </Screen>
  );
}
