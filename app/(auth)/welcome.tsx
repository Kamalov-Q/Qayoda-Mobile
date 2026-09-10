// app/(auth)/welcome.tsx — progressive sign-in. Step 1 asks only for the
// phone; POST /auth/phone/check then decides step 2: a password field when the
// account has one, or an SMS code otherwise. First-time users therefore never
// see a password prompt (or an "invalid credentials" error) — they typed a
// number, they get a code, the account creates itself.
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
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
  BrandMark,
  BackButton,
  LanguageSwitcher,
} from "../../src/components/ui";
import { spacing } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";
import { errorMessage } from "../../src/lib/api-error";
import { authApi } from "../../src/features/auth/api/auth.api";
import {
  useRequestOtp,
  usePhoneLogin,
  useGoogleSignIn,
} from "../../src/features/auth/hooks/useAuth";
import { isGoogleSignInAvailable } from "../../src/features/auth/google";

import {
  formatUzPhoneInput,
  isUzMobile,
  normalizePhone,
  prettyPhone,
} from "../../src/lib/phone";

// Validation messages are user-facing, so the schema is rebuilt whenever the
// language changes rather than frozen at module load.
const makeSchema = (t: ReturnType<typeof useT>) =>
  z.object({
    phone: z.string().refine(isUzMobile, t("validation.phoneInvalid")),
  });

type FormData = z.infer<ReturnType<typeof makeSchema>>;

export default function WelcomeScreen() {
  // "phone" until the number is checked; then either the password step or a
  // hand-off to the OTP screen (which navigates away, so no third step here).
  const [passwordFor, setPasswordFor] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  const requestOtp = useRequestOtp();
  const phoneLogin = usePhoneLogin();
  const google = useGoogleSignIn();
  const { text, colors } = useTheme();
  const t = useT();

  const check = useMutation({
    mutationFn: (phone: string) => authApi.checkPhone(phone),
    onSuccess: ({ usePassword }, phone) => {
      if (usePassword) setPasswordFor(phone);
      else requestOtp.mutate(phone); // new number or OTP-only → straight to SMS
    },
  });

  const schema = useMemo(() => makeSchema(t), [t]);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { phone: "" }, // prevents "uncontrolled to controlled" warning
  });

  const onContinue = ({ phone }: FormData) =>
    check.mutate(normalizePhone(phone));

  const onLogin = () => {
    if (passwordFor && password) {
      phoneLogin.mutate({ phone: passwordFor, password });
    }
  };

  const busy =
    check.isPending ||
    requestOtp.isPending ||
    phoneLogin.isPending ||
    google.isPending;

  const error = phoneLogin.isError
    ? errorMessage(phoneLogin.error)
    : check.isError
      ? errorMessage(check.error)
      : requestOtp.isError
        ? errorMessage(requestOtp.error)
        : google.isError
          ? errorMessage(google.error)
          : null;

  const passwordStep = passwordFor !== null;

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
            {/* Welcome is pushed over the tabs by whatever action needed an
                account, so it needs its own way back — a guest who taps the
                heart by accident must not be trapped on a login screen. */}
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
            >
              <BackButton />
              <BrandMark />
            </View>
            <LanguageSwitcher />
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={text.display}>{t("auth.welcomeTitle")}</Text>
            <Text style={text.caption}>
              {passwordStep ? t("auth.loginWithPasswordSubtitle") : t("auth.welcomeSubtitle")}
            </Text>
          </View>
        </View>

        {passwordStep ? (
          <View style={{ gap: spacing.md }}>
            {/* The checked number, with the way to change it right next to
                it — retyping should not mean hunting for a back button. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={text.heading}>{prettyPhone(passwordFor)}</Text>
              <Button
                title={t("auth.changeNumber")}
                variant="link"
                size="sm"
                onPress={() => {
                  setPasswordFor(null);
                  setPassword("");
                  phoneLogin.reset();
                }}
              />
            </View>

            <TextField
              label={t("auth.password")}
              placeholder={t("auth.passwordPlaceholder")}
              secureTextEntry
              autoComplete="current-password"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={onLogin}
              value={password}
              onChangeText={setPassword}
            />

            <ErrorBanner message={error} />

            <Button
              title={t("auth.login")}
              onPress={onLogin}
              loading={phoneLogin.isPending}
              disabled={busy || !password}
            />

            <Button
              title={t("auth.forgotPassword")}
              variant="link"
              onPress={() => router.push("/(auth)/forgot-password")}
              disabled={busy}
            />
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <Controller
              control={control}
              name="phone"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  label={t("auth.phone")}
                  placeholder={t("auth.phonePlaceholder")}
                  icon="call-outline"
                  prefix="+998"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  returnKeyType="go"
                  maxLength={12} // "90 123 45 67"
                  onSubmitEditing={handleSubmit(onContinue)}
                  value={value}
                  onChangeText={(v) => onChange(formatUzPhoneInput(v))}
                  onBlur={onBlur}
                  error={errors.phone?.message}
                />
              )}
            />

            <ErrorBanner message={error} />

            <Button
              title={t("common.continue")}
              onPress={handleSubmit(onContinue)}
              loading={check.isPending || requestOtp.isPending}
              disabled={busy}
            />
          </View>
        )}

        <View
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={text.caption}>{t("auth.orContinueWith")}</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        <View style={{ gap: spacing.sm }}>
          {isGoogleSignInAvailable() && (
            <Button
              title={t("auth.continueWithGoogle")}
              variant="secondary"
              icon="logo-google"
              onPress={() => google.mutate()}
              loading={google.isPending}
              disabled={busy}
            />
          )}
          <Button
            title={t("auth.continueWithTelegram")}
            variant="secondary"
            icon="paper-plane-outline"
            onPress={() => router.push("/telegram")}
            disabled={busy}
          />
        </View>
      </View>
    </Screen>
  );
}
