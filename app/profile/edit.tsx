// app/profile/edit.tsx
import { useMemo, useRef } from "react";
import { Text, View, TextInput, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
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

/** Long edge the avatar is downscaled to before upload — the server re-crops
 *  and thumbnails it anyway, so shipping a full camera frame is pure waste. */
const AVATAR_EDGE = 1024;

/** Strips the separators people type; the backend does the same before its
 *  +998XXXXXXXXX check, so validating the stripped form matches its rule. */
const normalizePhone = (v: string) => v.replace(/[\s()-]/g, "");
const PHONE = /^\+998\d{9}$/;

const makeSchema = (t: ReturnType<typeof useT>) =>
  z.object({
    name: z.string().trim().min(2, t("validation.minChars", { count: 2 })),
    surname: z.string().trim().min(2, t("validation.minChars", { count: 2 })),
    phoneNumber: z
      .string()
      .refine(
        (v) => !normalizePhone(v) || PHONE.test(normalizePhone(v)),
        t("validation.phoneInvalid"),
      ),
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
  const phoneRef = useRef<TextInput>(null);
  const { text, colors } = useTheme();
  const t = useT();

  const schema = useMemo(() => makeSchema(t), [t]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", surname: "", phoneNumber: "" },
    // Re-syncs whenever the query resolves (or a mutation writes fresh data),
    // so the form never shows stale values after a cold navigation here.
    values: profile
      ? {
          name: profile.name ?? "",
          surname: profile.surname ?? "",
          phoneNumber: profile.phoneNumber ?? "",
        }
      : sessionUser
        ? { name: sessionUser.name, surname: sessionUser.surname, phoneNumber: "" }
        : undefined,
  });

  const onSubmit = handleSubmit((d) =>
    update.mutate(
      {
        name: d.name.trim(),
        surname: d.surname.trim(),
        // null clears the number server-side; an empty string would fail the
        // DTO's format check.
        phoneNumber: normalizePhone(d.phoneNumber) || null,
      },
      { onSuccess: () => router.back() },
    ),
  );

  const avatarBusy = uploadAvatar.isPending || removeAvatar.isPending;

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
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
                  style={{ ...type.display, fontSize: 32, color: colors.primary }}
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
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.surname?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="phoneNumber"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                ref={phoneRef}
                label={t("profile.phone")}
                placeholder={t("add.phonePlaceholder")}
                icon="call-outline"
                keyboardType="phone-pad"
                autoComplete="tel"
                returnKeyType="done"
                onSubmitEditing={onSubmit}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.phoneNumber?.message}
              />
            )}
          />

          {/* The email is fixed server-side (it is the account identity), so
              it renders as context rather than a field. */}
          <Text style={text.caption}>
            {profile?.email ?? sessionUser?.email}
          </Text>

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
