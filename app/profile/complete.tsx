// app/profile/complete.tsx — the optional half of a profile, asked once.
//
// Everything here ALREADY exists on the edit screen. This is not a second
// source of truth: it is the same fields, the same mutation, and the same
// shared ProfileDetailsFields component, arranged as three short steps
// instead of one long scroll — because a fresh account facing a full edit
// form abandons it, and three screens of two questions do not read as work.
//
// Deliberately NOT called verification. `isVerifiedRealtor` is earned with a
// passport and a selfie reviewed by a person (app/verify-profile.tsx). A
// self-serve form must not share that word; see lib/completeness.ts.
//
// Leaving early is free. Every step saves what it has, so a person who
// stops after the photo keeps the photo.
import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import Animated, {
  FadeInRight,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import {
  Screen,
  Button,
  TextField,
  HEADER_EDGES,
  LoadingView,
} from "../../src/components/ui";
import { pickFromLibrary } from "../../src/lib/image-picker";
import { radii, spacing, type } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT, type TranslationKey } from "../../src/i18n";
import { resolveMediaUrl } from "../../src/lib/media-url";
import {
  useProfile,
  useUpdateProfile,
  useUploadAvatar,
} from "../../src/features/profile/hooks/useProfile";
import { ProfileDetailsFields } from "../../src/features/profile/components/ProfileDetailsFields";
import {
  fromIsoDate,
  toIsoDate,
} from "../../src/features/profile/lib/birth-date";
import type { Gender } from "../../src/features/profile/api/profile.api";

/** Long edge the avatar is downscaled to — same as the edit screen. */
const AVATAR_EDGE = 1024;

const STEPS: { key: string; titleKey: TranslationKey }[] = [
  { key: "identity", titleKey: "completeProfile.stepIdentity" },
  { key: "about", titleKey: "completeProfile.stepAbout" },
  { key: "reach", titleKey: "completeProfile.stepReach" },
];

export default function CompleteProfileScreen() {
  const { colors, text } = useTheme();
  const t = useT();
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();

  const [step, setStep] = useState(0);
  const [surname, setSurname] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [bio, setBio] = useState("");
  const [seeded, setSeeded] = useState(false);

  // Seeded once from the server copy, so re-entering the flow does not blank
  // what the person already filled in.
  if (profile && !seeded) {
    setSeeded(true);
    setSurname(profile.surname ?? "");
    setGender(profile.gender ?? "");
    setBirthDate(fromIsoDate(profile.birthDate));
    setBio(profile.bio ?? "");
  }

  const progress = (step + 1) / STEPS.length;
  const barWidth = useDerivedValue(() =>
    withTiming(progress, { duration: 320, easing: Easing.out(Easing.cubic) }),
  );
  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%`,
  }));

  const pickAvatar = async () => {
    const result = await pickFromLibrary({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled) return;
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

  /**
   * Saves whatever this step collected, then moves on.
   *
   * Per step rather than once at the end: somebody who gives up on step two
   * should keep step one. The avatar saves itself on pick, so it is already
   * safe by the time this runs.
   */
  const advance = () => {
    const patch =
      step === 0
        ? { surname: surname.trim() || undefined }
        : step === 1
          ? {
              gender: gender || null,
              birthDate: toIsoDate(birthDate) ?? undefined,
            }
          : { bio: bio.trim() || null };

    update.mutate(patch, {
      onSettled: () => {
        if (step < STEPS.length - 1) setStep(step + 1);
        else router.back();
      },
    });
  };

  if (isLoading || !profile) {
    return (
      <Screen scroll={false} edges={HEADER_EDGES}>
        <LoadingView />
      </Screen>
    );
  }

  const avatarUri = resolveMediaUrl(profile.avatarThumbUrl);
  const last = step === STEPS.length - 1;

  return (
    <Screen edges={HEADER_EDGES}>
      <View style={{ gap: spacing.xl }}>
        {/* The bar is the whole navigation aid: a step counter would say the
            same thing in more words. */}
        <View style={{ gap: spacing.sm }}>
          <View
            style={{
              height: 6,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceRaised,
              overflow: "hidden",
            }}
          >
            <Animated.View
              style={[
                { height: "100%", borderRadius: radii.pill, backgroundColor: colors.primary },
                barStyle,
              ]}
            />
          </View>
          <Text style={{ ...text.caption, color: colors.textMuted }}>
            {t(STEPS[step].titleKey)}
          </Text>
        </View>

        {/* Keyed on the step so each one arrives rather than swapping. */}
        <Animated.View
          key={STEPS[step].key}
          entering={FadeInRight.duration(260)}
          style={{ gap: spacing.lg }}
        >
          {step === 0 ? (
            <View style={{ gap: spacing.xl }}>
              <View style={{ alignItems: "center", gap: spacing.md }}>
                <Pressable
                  onPress={pickAvatar}
                  disabled={uploadAvatar.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={t("completeProfile.photoHint")}
                >
                  <View
                    style={{
                      width: 108,
                      height: 108,
                      borderRadius: radii.pill,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.primarySoft,
                      borderWidth: 1,
                      borderColor: colors.primaryBorder,
                      overflow: "hidden",
                    }}
                  >
                    {uploadAvatar.isPending ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : avatarUri ? (
                      <Image
                        source={{ uri: avatarUri }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    ) : (
                      <Ionicons
                        name="camera-outline"
                        size={36}
                        color={colors.primary}
                      />
                    )}
                  </View>
                </Pressable>
                <Text style={{ ...text.caption, color: colors.textMuted }}>
                  {t("completeProfile.photoHint")}
                </Text>
              </View>

              <TextField
                label={t("auth.surname")}
                placeholder={t("auth.surnamePlaceholder")}
                value={surname}
                onChangeText={setSurname}
                autoCapitalize="words"
                maxLength={60}
              />
            </View>
          ) : step === 1 ? (
            // The shared component, so this flow and the edit screen cannot
            // drift apart on validation or wording.
            <ProfileDetailsFields
              birthDate={birthDate}
              onBirthDate={setBirthDate}
              gender={gender}
              onGender={setGender}
            />
          ) : (
            <TextField
              label={t("profileInfo.bio")}
              placeholder={t("profileInfo.bioPlaceholder")}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={5}
              maxLength={500}
            />
          )}
        </Animated.View>

        <View style={{ gap: spacing.xs }}>
          <Button
            title={t(last ? "completeProfile.finish" : "completeProfile.next")}
            icon={last ? undefined : "arrow-forward"}
            loading={update.isPending}
            onPress={advance}
          />
          {/* Out at any point, keeping whatever is already saved. */}
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => ({
              alignSelf: "center",
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ ...type.body, color: colors.textMuted }}>
              {t("completeProfile.skip")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
