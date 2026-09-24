// Adding a phone to an account that already exists — the Telegram/Google
// user's way past the phone gate.
//
// Deliberately NOT in the (auth) group: that layout redirects signed-in users
// away, and everyone who reaches this screen is signed in. Two steps on one
// screen, because there is only one thing to do here and a second route would
// just be somewhere to get stranded.
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import {
  Screen,
  Button,
  TextField,
  OtpInput,
  ErrorBanner,
  HEADER_EDGES,
  toast,
} from "../src/components/ui";
import { spacing } from "../src/theme/tokens";
import { useTheme } from "../src/theme/useTheme";
import { useT, useLanguage } from "../src/i18n";
import { errorMessage } from "../src/lib/api-error";
import {
  formatUzPhoneInput,
  isUzMobile,
  normalizePhone,
  prettyPhone,
} from "../src/lib/phone";
import { authApi } from "../src/features/auth/api/auth.api";
import { useAuthStore } from "../src/features/auth/store/auth.store";
import { queryClient } from "../src/lib/query-client";
import { IDENTITIES_KEY } from "../src/features/auth/hooks/useIdentities";
import { PROFILE_KEY } from "../src/features/profile/hooks/useProfile";

const RESEND_COOLDOWN = 60;

export default function LinkPhoneScreen() {
  const { text } = useTheme();
  const t = useT();
  const language = useLanguage();

  // null → still asking for the number; set → the code was sent to it.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const verify = useMutation({
    mutationFn: () => authApi.linkPhoneVerify(sentTo!, code),
    onSuccess: () => {
      // The session user is what `requirePhone` reads, so it has to know
      // before the caller retries — otherwise the gate sends them straight
      // back here.
      const { accessToken, user, setSession } = useAuthStore.getState();
      if (accessToken && user) {
        setSession(accessToken, { ...user, phoneNumber: sentTo });
      }
      void queryClient.invalidateQueries({ queryKey: IDENTITIES_KEY });
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });

      toast.successKey("auth.phoneLinked");
      router.back();
    },
    onError: () => setCode(""),
  });

  // Declared after `verify` so it can clear it: a code going out to a new
  // number has to take the old number's rejection with it.
  const request = useMutation({
    mutationFn: (to: string) => authApi.linkPhoneRequest(to, language),
    onSuccess: (_res, to) => {
      setSentTo(to);
      setCode("");
      setCooldown(RESEND_COOLDOWN);
      verify.reset();
    },
  });

  // Six digits in, nothing to wait for.
  useEffect(() => {
    if (code.length === 6 && !verify.isPending) verify.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const error = request.isError
    ? errorMessage(request.error)
    : verify.isError
      ? errorMessage(verify.error)
      : null;

  const valid = isUzMobile(phone);

  return (
    <Screen edges={HEADER_EDGES}>
      <View style={{ gap: spacing.xl, paddingTop: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={text.title}>{t("auth.linkPhoneTitle")}</Text>
          <Text style={text.caption}>
            {sentTo
              ? t("auth.linkPhoneSent", { phone: prettyPhone(sentTo) })
              : t("auth.linkPhoneWhy")}
          </Text>
        </View>

        {sentTo ? (
          <View style={{ gap: spacing.md }}>
            <OtpInput
              value={code}
              onChange={(next) => {
                setCode(next);
                // Typing is the retry; the last rejection stops applying the
                // moment the code being shown is no longer the rejected one.
                if (verify.isError) verify.reset();
              }}
              error={verify.isError}
            />

            <ErrorBanner message={error} />

            <Button
              title={t("common.confirm")}
              onPress={() => verify.mutate()}
              loading={verify.isPending}
              disabled={code.length !== 6}
            />

            <Button
              title={
                cooldown > 0
                  ? t("auth.otpResendIn", { seconds: cooldown })
                  : t("auth.otpResend")
              }
              variant="link"
              disabled={cooldown > 0 || request.isPending}
              onPress={() => request.mutate(sentTo)}
            />

            {/* A wrong number is the likeliest reason to be stuck here. */}
            <Button
              title={t("auth.linkPhoneChange")}
              variant="link"
              onPress={() => {
                setSentTo(null);
                setCode("");
                // Back to the number field with a clean slate — the banner
                // was about the number they are abandoning.
                verify.reset();
                request.reset();
              }}
            />
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
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
              value={phone}
              onChangeText={(v) => setPhone(formatUzPhoneInput(v))}
              onSubmitEditing={() =>
                valid && request.mutate(normalizePhone(phone))
              }
              error={
                phone.length >= 12 && !valid
                  ? t("validation.phoneInvalid")
                  : undefined
              }
            />

            <ErrorBanner message={error} />

            <Button
              title={t("auth.linkPhoneSend")}
              onPress={() => request.mutate(normalizePhone(phone))}
              loading={request.isPending}
              disabled={!valid}
            />
          </View>
        )}
      </View>
    </Screen>
  );
}
