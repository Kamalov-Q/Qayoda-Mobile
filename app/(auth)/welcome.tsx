// app/(auth)/welcome.tsx — sign-in in two screens, and only two.
//
// This one takes a number; the next takes the six digits from the SMS. That
// is the whole of it, for a new account and a returning one alike: no
// password to invent, no password to remember, no surname, no avatar.
// Everything else about a person is optional and lives on the profile
// screen, to be filled in by someone who has already seen what the app is
// for.
//
// There is deliberately no password branch any more. This screen used to ask
// POST /auth/phone/check whether the number belonged to an account that had
// set one, and show a password box if so — which meant the people who had
// been here longest got the slower, more forgettable door, and a "forgot
// password" flow existed to rescue them from it. A number that can receive
// an SMS is the whole credential; the accounts that still carry a password
// hash on the server sign in by code like everybody else.
//
// No name box either. It used to sit above the number, asked of everyone —
// but a returning user, which is almost everyone who ever sees this screen,
// has a name already and was being made to scroll past a field that would
// be thrown away. Only a BRAND NEW account owes us one, and only that
// account is asked: establishSession routes it to /onboarding when the
// verify call comes back isNew with no name. The question is now asked of
// exactly the people it applies to, after they are already signed in.
import { useMemo } from "react";
import { Text, View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router } from "expo-router";
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
import { useRequestOtp } from "../../src/features/auth/hooks/useAuth";

import {
  formatUzPhoneInput,
  isUzMobile,
  normalizePhone,
} from "../../src/lib/phone";

// Validation messages are user-facing, so the schema is rebuilt whenever the
// language changes rather than frozen at module load.
const makeSchema = (t: ReturnType<typeof useT>) =>
  z.object({
    phone: z.string().refine(isUzMobile, t("validation.phoneInvalid")),
  });

type FormData = z.infer<ReturnType<typeof makeSchema>>;

export default function WelcomeScreen() {
  const requestOtp = useRequestOtp();
  const { text, colors } = useTheme();
  const t = useT();

  const schema = useMemo(() => makeSchema(t), [t]);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    // prevents "uncontrolled to controlled" warning
    defaultValues: { phone: "" },
  });

  // One call, one outcome: the code is on its way and the next screen takes
  // it. Whether the number already has an account is the server's business
  // and nothing this screen has to branch on.
  const onContinue = ({ phone }: FormData) =>
    requestOtp.mutate({ phone: normalizePhone(phone) });

  const error = requestOtp.isError ? errorMessage(requestOtp.error) : null;

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
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <BackButton />
              <BrandMark />
            </View>
            <LanguageSwitcher />
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={text.display}>{t("auth.welcomeTitle")}</Text>
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
                textContentType="telephoneNumber"
                returnKeyType="go"
                maxLength={12} // "90 123 45 67"
                onSubmitEditing={() => void handleSubmit(onContinue)()}
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
            loading={requestOtp.isPending}
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <View
            style={{ flex: 1, height: 1, backgroundColor: colors.border }}
          />
          <Text style={text.caption}>{t("auth.orContinueWith")}</Text>
          <View
            style={{ flex: 1, height: 1, backgroundColor: colors.border }}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Button
            title={t("auth.continueWithTelegram")}
            variant="secondary"
            icon="paper-plane-outline"
            onPress={() => router.push("/telegram")}
            disabled={requestOtp.isPending}
          />
        </View>
      </View>
    </Screen>
  );
}
