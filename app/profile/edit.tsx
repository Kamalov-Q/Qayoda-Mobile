// app/profile/edit.tsx
import { useMemo, useRef, useState } from "react";
import {
  Text,
  View,
  Pressable,
  ActivityIndicator,
  type TextInputInstance,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { pickFromLibrary } from "../../src/lib/image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller, useController } from "react-hook-form";
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
import type {
  Profile,
  UpdateProfileInput,
} from "../../src/features/profile/api/profile.api";
import {
  useProfile,
  useUpdateProfile,
  useUploadAvatar,
  useRemoveAvatar,
} from "../../src/features/profile/hooks/useProfile";
import { ProfileDetailsFields } from "../../src/features/profile/components/ProfileDetailsFields";
import {
  MAX_AGE,
  MIN_AGE,
  ageFrom,
  fromIsoDate,
  toIsoDate,
} from "../../src/features/profile/lib/birth-date";
import {
  SOCIAL_PLATFORMS,
  normalizeSocial,
  type SocialLinks,
} from "../../src/features/users/lib/social";

/** Long edge the avatar is downscaled to before upload — the server re-crops
 *  and thumbnails it anyway, so shipping a full camera frame is pure waste. */
const AVATAR_EDGE = 1024;

const makeSchema = (t: ReturnType<typeof useT>) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(2, t("validation.minChars", { count: 2 }))
      // The server's own bound (UpdateProfileDto: 2–64).
      .max(64, t("validation.maxChars", { count: 64 })),
    surname: z
      .string()
      .trim()
      .min(2, t("validation.minChars", { count: 2 }))
      // The server's own bound (UpdateProfileDto: 2–64).
      .max(64, t("validation.maxChars", { count: 64 })),
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
    gender: z.enum(["MALE", "FEMALE"]).or(z.literal("")),
    bio: z.string().trim().max(500).optional(),
  });

type FormData = z.infer<ReturnType<typeof makeSchema>>;

/**
 * The screen waits; the form mounts already knowing the answers.
 *
 * This split is the fix for fields that would not seed. The form used to
 * mount empty and lean on react-hook-form's `values` prop to pour the
 * profile in once the query resolved — but `values` applies through
 * `_reset`, which notifies the form-state stream and NOT the value stream
 * that useWatch (and therefore Controller and useController, both built on
 * it) listen to. The reset landed in the form's internals and no field ever
 * heard about it, so the boxes stayed blank until a keystroke forced a
 * re-render.
 *
 * Mounting after the data arrives makes the stored values the
 * `defaultValues`, which fields read directly on registration. No reset, no
 * notification, nothing to miss.
 */
export default function EditProfileScreen() {
  const { data: profile, isError, error } = useProfile();
  const { colors } = useTheme();

  if (!profile) {
    return (
      <Screen edges={HEADER_EDGES}>
        {isError ? (
          <ErrorBanner message={errorMessage(error)} />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </Screen>
    );
  }

  return <EditProfileForm profile={profile} />;
}

function EditProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();

  const surnameRef = useRef<TextInputInstance>(null);
  const { text, colors } = useTheme();
  const t = useT();

  const schema = useMemo(() => makeSchema(t), [t]);

  const {
    control,
    handleSubmit,
    formState: { errors, dirtyFields },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    // Read once, at mount, from data that is already here.
    defaultValues: {
      name: profile.name ?? "",
      surname: profile.surname ?? "",
      // Stored ISO, typed DD.MM.YYYY.
      birthDate: fromIsoDate(profile.birthDate),
      gender: profile.gender ?? "",
      bio: profile.bio ?? "",
    },
  });

  /**
   * Registered controllers, NOT useWatch.
   *
   * `values` resets the form once the profile query lands, and a useWatch
   * subscription set up during that first render does not see it — the
   * fields stayed empty until any keystroke forced a re-render, while
   * name/surname (on Controller) were right immediately. useController is
   * what Controller uses underneath, so these now behave like those two.
   */
  const birthDateField = useController({ control, name: "birthDate" }).field;
  const genderField = useController({ control, name: "gender" }).field;
  const bioField = useController({ control, name: "bio" }).field;

  /**
   * Social handles live outside the form.
   *
   * Six free-text fields that only ever travel together as one object, with
   * no validation beyond a length the field itself enforces — threading them
   * through the resolver would buy nothing and cost six more schema entries.
   * Seeded from the profile once it lands.
   */
  // Seeded at mount for the same reason as the form above — the profile is
  // already here, so there is nothing to wait for and no effect to write.
  const [socials, setSocials] = useState<SocialLinks>(
    () => profile.socialLinks ?? {},
  );

  /**
   * Only what was actually edited.
   *
   * This used to send every field on every save, turning an empty box into
   * an explicit null. That made the form destructive: any save made before
   * it had seeded itself from the profile DELETED the gender and the
   * bio that were already stored — and because a wiped profile then loads
   * empty, the next save wiped it again. Social handles escaped only because
   * they are seeded from their own effect.
   *
   * A PATCH already means "leave out what should not change", so a field the
   * user never touched is simply omitted. Clearing still works: emptying a
   * box makes it dirty, and a dirty empty box sends null.
   */
  const onSubmit = handleSubmit((d) => {
    const payload: UpdateProfileInput = {};

    if (dirtyFields.name) payload.name = d.name.trim();
    if (dirtyFields.surname) payload.surname = d.surname.trim();
    // A birth date is never cleared — there is no "I was not born".
    if (dirtyFields.birthDate && d.birthDate) {
      payload.birthDate = toIsoDate(d.birthDate) ?? undefined;
    }
    if (dirtyFields.gender) payload.gender = d.gender || null;
    if (dirtyFields.bio) payload.bio = d.bio?.trim() || null;

    // Outside the form, so dirtiness is decided by comparing with what the
    // profile holds. Sent whole or not at all — the server replaces the set,
    // which is what makes removing one handle possible.
    //
    // Both sides are normalised first: stored as a bare handle, so "@me",
    // "me" and "instagram.com/me" are one account rather than three, and
    // re-saving a profile written before this does not look like an edit.
    const saved = profile.socialLinks ?? {};
    const cleaned: SocialLinks = {};
    for (const platform of SOCIAL_PLATFORMS) {
      const handle = normalizeSocial(platform, socials[platform] ?? "");
      if (handle) cleaned[platform] = handle;
    }
    const socialsChanged = SOCIAL_PLATFORMS.some(
      (platform) =>
        normalizeSocial(platform, saved[platform] ?? "") !==
        (cleaned[platform] ?? ""),
    );
    if (socialsChanged) payload.socialLinks = cleaned;

    // Nothing to say: a save that changed nothing should not cost a request.
    if (Object.keys(payload).length === 0) {
      router.back();
      return;
    }

    update.mutate(payload, { onSuccess: () => router.back() });
  });

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

  const avatarUri = resolveMediaUrl(profile.avatarThumbUrl);
  const initials = [profile.name, profile.surname]
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

          {profile.avatarThumbUrl ? (
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
                required
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
                required
                placeholder={t("auth.surnamePlaceholder")}
                autoComplete="family-name"
                returnKeyType="done"
                onSubmitEditing={() => void onSubmit()}
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
            birthDate={birthDateField.value ?? ""}
            onBirthDate={birthDateField.onChange}
            birthDateError={errors.birthDate?.message}
            gender={genderField.value}
            onGender={genderField.onChange}
            bio={bioField.value ?? ""}
            onBio={bioField.onChange}
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
              {profile.phoneNumber ?? "—"}
            </Text>
            <Text style={text.caption}>{t("profile.contactHint")}</Text>
          </View>

          {/* Only the save error now — a failed LOAD is shown by the gate
              above, which never lets this form mount without data. */}
          <ErrorBanner
            message={update.isError ? errorMessage(update.error) : null}
          />

          <Button
            title={t("common.save")}
            icon="checkmark-outline"
            onPress={onSubmit}
            loading={update.isPending}
          />
        </View>
      </View>
    </Screen>
  );
}
