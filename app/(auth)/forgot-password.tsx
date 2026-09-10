// app/(auth)/forgot-password.tsx — asks for the phone, sends the same login
// OTP, and hands over to the reset screen where code + new password land.
import { useMemo } from "react";
import { Text, View } from "react-native";
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
import { useRequestReset } from "../../src/features/auth/hooks/useAuth";
import { useAuthFlowStore } from "../../src/features/auth/store/auth-flow.store";
import {
  formatUzPhoneInput,
  isUzMobile,
  normalizePhone,
} from "../../src/lib/phone";

const makeSchema = (t: ReturnType<typeof useT>) =>
  z.object({
    phone: z.string().refine(isUzMobile, t("validation.phoneInvalid")),
  });

type FormData = z.infer<ReturnType<typeof makeSchema>>;

export default function ForgotPasswordScreen() {
  const requestReset = useRequestReset();
  // Prefilled with whatever the welcome screen already holds.
  const knownPhone = useAuthFlowStore((s) => s.phone);
  const { text } = useTheme();
  const t = useT();

  const schema = useMemo(() => makeSchema(t), [t]);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { phone: formatUzPhoneInput(knownPhone) },
  });

  const onSubmit = ({ phone }: FormData) =>
    requestReset.mutate(normalizePhone(phone));

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
            <BackButton fallback="/(auth)/welcome" />
            <LanguageSwitcher />
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={text.display}>{t("auth.resetTitle")}</Text>
            <Text style={text.caption}>{t("auth.welcomeSubtitle")}</Text>
          </View>
        </View>

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
                returnKeyType="go"
                maxLength={12} // "90 123 45 67"
                onSubmitEditing={handleSubmit(onSubmit)}
                value={value}
                onChangeText={(v) => onChange(formatUzPhoneInput(v))}
                onBlur={onBlur}
                error={errors.phone?.message}
              />
            )}
          />

          <ErrorBanner
            message={
              requestReset.isError ? errorMessage(requestReset.error) : null
            }
          />

          <Button
            title={t("auth.sendCode")}
            onPress={handleSubmit(onSubmit)}
            loading={requestReset.isPending}
          />
        </View>
      </View>
    </Screen>
  );
}
