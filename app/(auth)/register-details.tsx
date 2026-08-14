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
import { useRegister } from "../../src/features/auth/hooks/useAuth";

const makeSchema = (t: ReturnType<typeof useT>) =>
  z.object({
    name: z.string().min(2, t("validation.minChars", { count: 2 })),
    surname: z.string().min(2, t("validation.minChars", { count: 2 })),
    password: z
      .string()
      .min(3, t("validation.minChars", { count: 3 }))
      .max(32, t("validation.maxChars", { count: 32 }))
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, t("validation.passwordComplexity")),
  });

type FormData = z.infer<ReturnType<typeof makeSchema>>;

export default function RegisterDetailsScreen() {
  const registerMutation = useRegister();
  const surnameRef = useRef<TextInput>(null);
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
    defaultValues: { name: "", surname: "", password: "" },
  });

  const onSubmit = handleSubmit((d) => registerMutation.mutate(d));

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
            <Text style={text.display}>{t("auth.detailsTitle")}</Text>
            <Text style={text.caption}>{t("auth.detailsSubtitle")}</Text>
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t("auth.name")}
                placeholder={t("auth.namePlaceholder")}
                autoComplete="given-name"
                returnKeyType="next"
                onSubmitEditing={() => surnameRef.current?.focus()}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="surname"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                ref={surnameRef}
                label={t("auth.surname")}
                placeholder={t("auth.surnamePlaceholder")}
                autoComplete="family-name"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.surname?.message}
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
                placeholder={t("validation.minChars", { count: 3 })}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
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
            message={
              registerMutation.isError
                ? errorMessage(registerMutation.error)
                : null
            }
          />

          <Button
            title={t("auth.finish")}
            onPress={onSubmit}
            loading={registerMutation.isPending}
          />
        </View>
      </View>
    </Screen>
  );
}
