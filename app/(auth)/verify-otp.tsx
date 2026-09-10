import { useState, useEffect, useRef } from "react";
import { Text, View } from "react-native";
import {
  Screen,
  Button,
  OtpInput,
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
  useVerifyOtp,
  useResendOtp,
} from "../../src/features/auth/hooks/useAuth";
import { useAuthFlowStore } from "../../src/features/auth/store/auth-flow.store";
import { prettyPhone } from "../../src/lib/phone";

const RESEND_COOLDOWN = 60;


export default function VerifyOtpScreen() {
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const phone = useAuthFlowStore((s) => s.phone);
  const verifyOtp = useVerifyOtp();
  const resendOtp = useResendOtp();
  const submitted = useRef(false);
  const { text, colors } = useTheme();
  const t = useT();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = () =>
    verifyOtp.mutate(
      { code },
      {
        onError: () => {
          submitted.current = false;
          setCode("");
        },
      },
    );

  useEffect(() => {
    if (code.length === 6 && !submitted.current && !verifyOtp.isPending) {
      submitted.current = true;
      submit();
    }
    if (code.length < 6) submitted.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Split the rendered sentence on a marker so the number can be bolded
  // wherever each language's grammar places it.
  const SLOT = "%PHONE%";
  const [before, after] = t("auth.otpSubtitle", { phone: SLOT }).split(SLOT);

  const onResend = () => {
    resendOtp.mutate(undefined, {
      onSuccess: () => toast.successKey("auth.otpResent"),
    });
    setCooldown(RESEND_COOLDOWN);
    setCode("");
  };

  const error = verifyOtp.isError
    ? errorMessage(verifyOtp.error)
    : resendOtp.isError
      ? errorMessage(resendOtp.error)
      : null;

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
            <Text style={text.display}>{t("auth.otpTitle")}</Text>
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
          <OtpInput value={code} onChange={setCode} error={verifyOtp.isError} />

          <ErrorBanner message={error} />

          <Button
            title={t("common.confirm")}
            onPress={submit}
            loading={verifyOtp.isPending}
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
