// app/onboarding.tsx — the one unskippable screen: a brand-new account that
// arrived without a full name (every phone sign-up; Telegram/Google when the
// provider carried none) fills in who they are before entering the app.
// Reached only via router.replace from establishSession, so there is no back
// stack to escape through, and no BackButton is offered.
import { useMemo, useRef, useState } from "react";
import { Text, TextInput, View, Pressable } from "react-native";
import { useForm, Controller, useController } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router, Redirect } from "expo-router";
import { pickFromLibrary } from "../src/lib/image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Button,
  TextField,
  ErrorBanner,
  LanguageSwitcher,
} from "../src/components/ui";
import { spacing, radii } from "../src/theme/tokens";
import { useTheme } from "../src/theme/useTheme";
import { useT } from "../src/i18n";
import { errorMessage } from "../src/lib/api-error";
import { useAuthStore } from "../src/features/auth/store/auth.store";
import { goHomeAfterAuth } from "../src/features/auth/hooks/useAuth";
import {
  useUpdateProfile,
  useUploadAvatar,
} from "../src/features/profile/hooks/useProfile";
import { resolveMediaUrl } from "../src/lib/media-url";
import { ProfileDetailsFields } from "../src/features/profile/components/ProfileDetailsFields";
import {
  MAX_AGE,
  MIN_AGE,
  ageFrom,
  toIsoDate,
} from "../src/features/profile/lib/birth-date";

/** Same downscale as the profile screen — the server re-crops anyway. */
const AVATAR_EDGE = 1024;

const makeSchema = (t: ReturnType<typeof useT>) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(2, t("validation.minChars", { count: 2 })),
    surname: z
      .string()
      .trim()
      .min(2, t("validation.minChars", { count: 2 })),
    /**
     * The one new field that is REQUIRED. Validated in two steps so the
     * message says which thing is wrong: a date that is not a date, versus a
     * date that would make somebody 4 or 140.
     */
    birthDate: z
      .string()
      .trim()
      .min(1, t("profileInfo.birthDateRequired"))
      .refine((v) => toIsoDate(v) !== null, t("profileInfo.birthDateInvalid"))
      .refine(
        (v) => {
          const age = ageFrom(toIsoDate(v));
          return age !== null && age >= MIN_AGE && age <= MAX_AGE;
        },
        t("profileInfo.ageRange", { min: MIN_AGE, max: MAX_AGE }),
      ),
    gender: z.enum(["MALE", "FEMALE"]).or(z.literal("")),
    address: z.string().trim().max(255).optional(),
  });

type FormData = z.infer<ReturnType<typeof makeSchema>>;

export default function OnboardingScreen() {
  const user = useAuthStore((s) => s.user);
  const update = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const surnameRef = useRef<TextInput>(null);
  const { colors, text } = useTheme();
  const t = useT();

  const schema = useMemo(() => makeSchema(t), [t]);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? "",
      surname: user?.surname ?? "",
      birthDate: "",
      gender: "",
      address: "",
    },
  });

  // Registered controllers rather than useWatch: these feed one presentational
  // component, and a useWatch subscription misses the reset that `values`
  // fires, which left the same fields blank on the edit screen until a
  // keystroke woke them up. useController is what Controller uses underneath.
  const birthDateField = useController({ control, name: "birthDate" }).field;
  const genderField = useController({ control, name: "gender" }).field;
  const addressField = useController({ control, name: "address" }).field;

  // Deep link / reload safety net: this screen means nothing without a session.
  if (!user) return <Redirect href="/(tabs)/home" />;

  const pickAvatar = async () => {
    const result = await pickFromLibrary({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled) return;
    setLocalAvatar(result.assets[0].uri);
    try {
      const rendered = await ImageManipulator.manipulate(result.assets[0].uri)
        .resize({ width: AVATAR_EDGE })
        .renderAsync();
      const saved = await rendered.saveAsync({
        compress: 0.85,
        format: SaveFormat.JPEG,
      });
      uploadAvatar.mutate(saved.uri);
    } catch {
      uploadAvatar.mutate(result.assets[0].uri);
    }
  };

  const onSubmit = handleSubmit((d) =>
    update.mutate(
      {
        name: d.name.trim(),
        surname: d.surname.trim(),
        // Validated above, so the conversion cannot fail here.
        birthDate: toIsoDate(d.birthDate)!,
        // Blank means "not saying" — sent as undefined rather than an empty
        // string, which the server would store as a value.
        gender: d.gender || undefined,
        address: d.address?.trim() || undefined,
      },
      {
        onSuccess: () => {
          // Phone accounts pick their password next; provider-only accounts
          // have no phone to log into, so they are done — via the intro if
          // this is their first login.
          if (user?.phoneNumber && !user.hasPassword) {
            router.replace("/set-password");
          } else {
            goHomeAfterAuth();
          }
        },
      },
    ),
  );

  // Telegram/Google may have delivered an avatar already; show whichever wins.
  const avatarUri =
    localAvatar ?? resolveMediaUrl(user.avatarUrl ?? null) ?? null;

  return (
    <Screen centered>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.md }}>
          <View style={{ alignItems: "flex-end" }}>
            <LanguageSwitcher />
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={text.display}>{t("auth.completeTitle")}</Text>
            <Text style={text.caption}>{t("auth.completeSubtitle")}</Text>
          </View>
        </View>

        {/* Avatar — optional, tap to pick. */}
        <Pressable
          onPress={pickAvatar}
          disabled={uploadAvatar.isPending}
          accessibilityRole="button"
          accessibilityLabel={t("profile.changePhoto")}
          style={({ pressed }) => ({
            alignSelf: "center",
            width: 88,
            height: 88,
            borderRadius: radii.pill,
            backgroundColor: colors.primarySoft,
            borderWidth: 1,
            borderColor: colors.primaryBorder,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            opacity: pressed || uploadAvatar.isPending ? 0.7 : 1,
          })}
        >
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : (
            <Ionicons name="camera-outline" size={30} color={colors.primary} />
          )}
        </Pressable>

        <View style={{ gap: spacing.md }}>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t("auth.name")}
                required
                placeholder={t("auth.namePlaceholder")}
                autoComplete="given-name"
                autoFocus
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
                required
                placeholder={t("auth.surnamePlaceholder")}
                autoComplete="family-name"
                returnKeyType="done"
                onSubmitEditing={onSubmit}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.surname?.message}
              />
            )}
          />

          {/* Who they are, beyond a name. Age is required here and only
              here — the edit screen takes a patch, so it cannot demand a
              field that older accounts never supplied. */}
          <ProfileDetailsFields
            birthDate={birthDateField.value}
            birthDateRequired
            onBirthDate={birthDateField.onChange}
            birthDateError={errors.birthDate?.message}
            gender={genderField.value}
            onGender={genderField.onChange}
            address={addressField.value ?? ""}
            onAddress={addressField.onChange}
          />

          {/* The number that signed them in, shown for confidence, not edited. */}
          {user.phoneNumber ? (
            <Text style={text.caption}>
              {t("auth.phone")}: {user.phoneNumber}
            </Text>
          ) : null}

          <ErrorBanner
            message={update.isError ? errorMessage(update.error) : null}
          />

          <Button
            title={t("auth.finish")}
            onPress={onSubmit}
            loading={update.isPending}
            disabled={uploadAvatar.isPending}
          />
        </View>
      </View>
    </Screen>
  );
}
