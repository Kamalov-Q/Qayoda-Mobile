// app/profile/edit.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Text,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { pickFromLibrary } from "../../src/lib/image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Screen,
  Button,
  TextField,
  ErrorBanner,
  HEADER_EDGES,
} from "../../src/components/ui";
import { spacing, radii, type } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";
import { confirm } from "../../src/lib/alerts";
import { errorMessage } from "../../src/lib/api-error";
import { resolveMediaUrl } from "../../src/lib/media-url";
import {
  useProfile,
  useUpdateProfile,
  useUploadAvatar,
  useRemoveAvatar,
} from "../../src/features/profile/hooks/useProfile";
import { useAuthStore } from "../../src/features/auth/store/auth.store";
import { ProfileDetailsFields } from "../../src/features/profile/components/ProfileDetailsFields";
import {
  MAX_AGE,
  MIN_AGE,
  ageFrom,
  fromIsoDate,
  toIsoDate,
} from "../../src/features/profile/lib/birth-date";
import type { SocialLinks } from "../../src/features/users/lib/social";

/** Long edge the avatar is downscaled to before upload — the server re-crops
 *  and thumbnails it anyway, so shipping a full camera frame is pure waste. */
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
     * Optional here, unlike registration: this is a patch, and an account
     * that predates the field has nothing to resend. Still validated when
     * something IS typed — a half-finished date should not be saved.
     */
    birthDate: z
      .string()
      .trim()
      .refine(
        (v) => !v || toIsoDate(v) !== null,
        t("profileInfo.birthDateInvalid"),
      )
      .refine(
        (v) => {
          if (!v) return true;
          const age = ageFrom(toIsoDate(v));
          return age !== null && age >= MIN_AGE && age <= MAX_AGE;
        },
        t("profileInfo.ageRange", { min: MIN_AGE, max: MAX_AGE }),
      )
      .optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).or(z.literal("")),
    address: z.string().trim().max(255).optional(),
    bio: z.string().trim().max(500).optional(),
  });

type FormData = z.infer<ReturnType<typeof makeSchema>>;

export default function EditProfileScreen() {
  const { data: profile, isError: loadFailed, error: loadError } = useProfile();
  // The session user seeds the form while /profile is still in flight — the
  // name and surname it holds are the same values, so nothing flashes empty.
  const sessionUser = useAuthStore((s) => s.user);
  const update = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();

  const surnameRef = useRef<TextInput>(null);
  const { text, colors } = useTheme();
  const t = useT();

  const schema = useMemo(() => makeSchema(t), [t]);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      surname: "",
      birthDate: "",
      gender: "",
      address: "",
      bio: "",
    },
    // Re-syncs whenever the query resolves (or a mutation writes fresh data),
    // so the form never shows stale values after a cold navigation here.
    values: profile
      ? {
          name: profile.name ?? "",
          surname: profile.surname ?? "",
          // Stored ISO, typed DD.MM.YYYY.
          birthDate: fromIsoDate(profile.birthDate),
          gender: profile.gender ?? "",
          address: profile.address ?? "",
          bio: profile.bio ?? "",
        }
      : sessionUser
        ? {
            // The session copy carries only the name; the rest arrives with
            // the profile a moment later and `values` re-syncs then.
            name: sessionUser.name ?? "",
            surname: sessionUser.surname ?? "",
            birthDate: "",
            gender: "" as const,
            address: "",
            bio: "",
          }
        : undefined,
  });

  const [birthDate, gender, address, bio] = useWatch({
    control,
    name: ["birthDate", "gender", "address", "bio"],
  }) as [
    string | undefined,
    FormData["gender"],
    string | undefined,
    string | undefined,
  ];

  /**
   * Social handles live outside the form.
   *
   * Six free-text fields that only ever travel together as one object, with
   * no validation beyond a length the field itself enforces — threading them
   * through the resolver would buy nothing and cost six more schema entries.
   * Seeded from the profile once it lands.
   */
  const [socials, setSocials] = useState<SocialLinks>({});
  const seeded = useRef(false);
  useEffect(() => {
    if (!profile || seeded.current) return;
    seeded.current = true;
    setSocials(profile.socialLinks ?? {});
  }, [profile]);

  const onSubmit = handleSubmit((d) =>
    update.mutate(
      {
        name: d.name.trim(),
        surname: d.surname.trim(),
        // A birth date is never cleared — there is no "I was not born".
        birthDate: d.birthDate
          ? (toIsoDate(d.birthDate) ?? undefined)
          : undefined,
        // Explicit null, not undefined: this form holds the whole truth, so
        // an empty field means the answer was taken back. Undefined would
        // leave the old value in place and the clear would look broken.
        gender: d.gender || null,
        address: d.address || null,
        bio: d.bio?.trim() || null,
        // Always sent, because the server replaces the set whole — that is
        // what makes clearing one possible.
        socialLinks: socials,
      },
      { onSuccess: () => router.back() },
    ),
  );

  const avatarBusy = uploadAvatar.isPending || removeAvatar.isPending;

  const pickAvatar = async () => {
    const result = await pickFromLibrary({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled) return;

    // Downscale + re-encode on device, same as listing photos: a modern phone
    // photo is 8–12 MB and the server caps avatars at 5 MB.
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
      // Unreadable file — fall back to the original and let the server decide.
      uploadAvatar.mutate(result.assets[0].uri);
    }
  };

  const onRemoveAvatar = () =>
    confirm({
      titleKey: "profile.removePhoto",
      messageKey: "profile.removePhotoConfirm",
      confirmKey: "common.delete",
      destructive: true,
      onConfirm: () => removeAvatar.mutate(),
    });

  const avatarUri = resolveMediaUrl(profile?.avatarThumbUrl);
  const initials = [
    profile?.name ?? sessionUser?.name,
    profile?.surname ?? sessionUser?.surname,
  ]
    .filter(Boolean)
    .map((s) => s![0]?.toUpperCase())
    .join("");

  return (
    <Screen edges={HEADER_EDGES}>
      <View style={{ gap: spacing.xl }}>
        {/* ---- Avatar ---------------------------------------------------- */}
        <View style={{ alignItems: "center", gap: spacing.md }}>
          <Pressable
            onPress={pickAvatar}
            disabled={avatarBusy}
            accessibilityRole="button"
            accessibilityLabel={t("profile.changePhoto")}
          >
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: radii.pill,
                backgroundColor: colors.primarySoft,
                borderWidth: 1,
                borderColor: colors.primaryBorder,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {avatarBusy ? (
                <ActivityIndicator color={colors.primary} />
              ) : avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : initials ? (
                <Text
                  style={{
                    ...type.display,
                    fontSize: 32,
                    color: colors.primary,
                  }}
                >
                  {initials}
                </Text>
              ) : (
                <Ionicons name="person" size={40} color={colors.primary} />
              )}
            </View>

            {/* Camera badge signals the circle is tappable. */}
            <View
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                width: 32,
                height: 32,
                borderRadius: radii.pill,
                backgroundColor: colors.primary,
                borderWidth: 2,
                borderColor: colors.bg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="camera" size={16} color={colors.onPrimary} />
            </View>
          </Pressable>

          {profile?.avatarThumbUrl ? (
            <Button
              title={t("profile.removePhoto")}
              variant="link"
              size="sm"
              onPress={onRemoveAvatar}
              disabled={avatarBusy}
            />
          ) : null}
        </View>

        {/* ---- Details --------------------------------------------------- */}
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
                returnKeyType="done"
                onSubmitEditing={onSubmit}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.surname?.message}
              />
            )}
          />
          {/* The same block the registration screen shows, plus the two
              things nobody should be asked for at sign-up: a bio and six
              social handles. */}
          <ProfileDetailsFields
            birthDate={birthDate ?? ""}
            onBirthDate={(v) =>
              setValue("birthDate", v, { shouldValidate: !!errors.birthDate })
            }
            birthDateError={errors.birthDate?.message}
            gender={gender}
            onGender={(v) => setValue("gender", v)}
            address={address ?? ""}
            onAddress={(v) => setValue("address", v)}
            bio={bio ?? ""}
            onBio={(v) => setValue("bio", v)}
            socials={socials}
            onSocials={setSocials}
          />

          {/* Phone and email are set by the sign-in method that verified
              them (SMS code, Google), so they render as context, not fields. */}
          <View style={{ gap: spacing.xs }}>
            <Text style={{ ...text.label, color: colors.textMuted }}>
              {t("profile.phone")}
            </Text>
            <Text style={text.body}>
              {profile?.phoneNumber ?? sessionUser?.phoneNumber ?? "—"}
            </Text>
            <Text style={text.caption}>{t("profile.contactHint")}</Text>
          </View>

          {/* A failed load matters here too: the save button stays disabled
              until the profile arrives, and a silent blank form reads as a
              frozen app. */}
          <ErrorBanner
            message={
              update.isError
                ? errorMessage(update.error)
                : loadFailed
                  ? errorMessage(loadError)
                  : null
            }
          />

          <Button
            title={t("common.save")}
            icon="checkmark-outline"
            onPress={onSubmit}
            loading={update.isPending}
            disabled={!profile}
          />
        </View>
      </View>
    </Screen>
  );
}
