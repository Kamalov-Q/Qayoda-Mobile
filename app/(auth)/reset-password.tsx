// app/(auth)/reset-password.tsx — the second half of forgot-password: the SMS
// code proves the phone, the new password (typed twice) replaces the old one,
// and the returned session signs the user straight in.
import { useEffect, useMemo, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Screen,
  Button,
  OtpInput,
  TextField,
  ErrorBanner,
  BackButton,
  LanguageSwitcher,
  toast,
} from "../../src/components/ui";
import { spacing } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";
import { errorMessage } from "../../src/lib/api-error";
import {
  useResendOtp,
  useResetPassword,
} from "../../src/features/auth/hooks/useAuth";
import { useAuthFlowStore } from "../../src/features/auth/store/auth-flow.store";
import { prettyPhone } from "../../src/lib/phone";

const RESEND_COOLDOWN = 60;


const makeSchema = (t: ReturnType<typeof useT>) =>
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

type FormData = z.infer<ReturnType<typeof makeSchema>>;

export default function ResetPasswordScreen() {
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const phone = useAuthFlowStore((s) => s.phone);
  const reset = useResetPassword();
  const resendOtp = useResendOtp();
  const repeatRef = useRef<TextInput>(null);
  const { colors, text } = useTheme();
  const t = useT();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const schema = useMemo(() => makeSchema(t), [t]);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", repeat: "" },
  });

  const onSubmit = handleSubmit((d) =>
    reset.mutate(
      { code, password: d.password },
      { onError: () => setCode("") },
    ),
  );

  const SLOT = "%PHONE%";
  const [before, after] = t("auth.resetSubtitle", { phone: SLOT }).split(SLOT);

  const onResend = () => {
    resendOtp.mutate(undefined, {
      onSuccess: () => toast.successKey("auth.otpResent"),
    });
    setCooldown(RESEND_COOLDOWN);
    setCode("");
  };

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
            <BackButton fallback="/(auth)/forgot-password" />
            <LanguageSwitcher />
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={text.display}>{t("auth.resetTitle")}</Text>
            <Text style={text.caption}>
              {before}
              <Text style={{ color: colors.text, fontWeight: "600" }}>
                {prettyPhone(phone)}
              </Text>
              {after}
            </Text>
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <OtpInput value={code} onChange={setCode} error={reset.isError} />

          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t("auth.password")}
                placeholder={t("auth.passwordPlaceholder")}
                secureTextEntry
                autoComplete="new-password"
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
            message={reset.isError ? errorMessage(reset.error) : null}
          />

          <Button
            title={t("auth.finish")}
            onPress={onSubmit}
            loading={reset.isPending}
            disabled={code.length !== 6}
          />

          <Button
            title={
              cooldown > 0
                ? t("auth.otpResendIn", { seconds: cooldown })
                : t("auth.otpResend")
            }
            variant="link"
            disabled={cooldown > 0}
            loading={resendOtp.isPending}
            onPress={onResend}
          />
        </View>
      </View>
    </Screen>
  );
}
