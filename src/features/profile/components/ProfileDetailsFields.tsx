import { memo, useMemo } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Section,
  TextField,
  SelectGrid,
  type SelectGridOption,
} from "@/src/components/ui";
import { spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { GENDERS, type Gender } from "../api/profile.api";
import {
  SOCIAL_ICONS,
  SOCIAL_PLACEHOLDERS,
  SOCIAL_PLATFORMS,
  type SocialLinks,
  type SocialPlatform,
} from "@/src/features/users/lib/social";
import { maskBirthDate } from "../lib/birth-date";

const GENDER_ICONS = {
  MALE: "man-outline",
  FEMALE: "woman-outline",
} as const satisfies Record<Gender, keyof typeof Ionicons.glyphMap>;

const GENDER_LABELS = {
  MALE: "profileInfo.genderMale",
  FEMALE: "profileInfo.genderFemale",
} as const;

interface Props {
  /** DD.MM.YYYY as typed — the parent converts on submit. */
  birthDate: string;
  onBirthDate: (value: string) => void;
  birthDateError?: string;
  /**
   * Registration demands a birth date; the edit screen takes a patch and
   * cannot, so the asterisk is the caller's to decide.
   */
  birthDateRequired?: boolean;
  gender: Gender | "";
  onGender: (value: Gender | "") => void;
  /** Omitted on registration: a bio is not something to ask for at sign-up. */
  bio?: string;
  onBio?: (value: string) => void;
  socials?: SocialLinks;
  onSocials?: (value: SocialLinks) => void;
}

/**
 * The parts of a profile that are about the person rather than the account.
 *
 * One component for both the registration screen and the edit screen: they
 * ask for the same things in the same order with the same validation, and
 * two copies would have drifted the first time a label changed.
 *
 * Only the required fields are marked, with a red asterisk; the optional
 * ones say nothing. Labelling four of five fields "optional" was more words
 * than it was guidance. A line at the foot still says who can see what.
 *
 * No address here any more. It was a region/district pair the server never
 * showed to anybody and never filtered on, and the profile already carries a
 * location card — a map of where you actually are, which is the question the
 * address was a worse answer to.
 */
export const ProfileDetailsFields = memo(function ProfileDetailsFields({
  birthDate,
  onBirthDate,
  birthDateError,
  birthDateRequired,
  gender,
  onGender,
  bio,
  onBio,
  socials,
  onSocials,
}: Props) {
  const { text, colors } = useTheme();
  const t = useT();

  // Typed with "" in the union so the grid can render nothing selected —
  // which is also how "prefer not to say" is expressed.
  const genderOptions = useMemo<SelectGridOption<Gender | "">[]>(
    () =>
      GENDERS.map((value) => ({
        value,
        label: t(GENDER_LABELS[value]),
        icon: GENDER_ICONS[value],
      })),
    [t],
  );

  const setSocial = (platform: SocialPlatform, value: string) =>
    onSocials?.({ ...socials, [platform]: value });

  return (
    <View style={{ gap: spacing.lg }}>
      <TextField
        label={t("profileInfo.birthDate")}
        required={birthDateRequired}
        placeholder={t("profileInfo.birthDatePlaceholder")}
        keyboardType="number-pad"
        value={birthDate}
        // Masked as they type: the dots are the one part of a date format
        // nobody should have to remember to enter.
        onChangeText={(v) => onBirthDate(maskBirthDate(v))}
        maxLength={10}
        error={birthDateError}
      />

      <Section
        title={t("profileInfo.gender")}
      >
        <SelectGrid<Gender | "">
          options={genderOptions}
          value={gender}
          // Tapping the chosen one again clears it: this is optional, and
          // without this there is no way back to "would rather not say".
          onChange={(v) => onGender(v === gender ? "" : v)}
        />
      </Section>

      {onBio ? (
        <TextField
          label={t("profileInfo.bio")}
          placeholder={t("profileInfo.bioPlaceholder")}
          value={bio ?? ""}
          onChangeText={onBio}
          multiline
          numberOfLines={4}
          maxLength={500}
        />
      ) : null}

      {onSocials ? (
        <Section
          title={t("profileInfo.socials")}
        >
          <View style={{ gap: spacing.sm }}>
            <Text style={text.caption}>{t("profileInfo.socialsHint")}</Text>
            {SOCIAL_PLATFORMS.map((platform) => (
              <View
                key={platform}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <Ionicons
                  name={SOCIAL_ICONS[platform]}
                  size={22}
                  color={colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <TextField
                    placeholder={SOCIAL_PLACEHOLDERS[platform]}
                    value={socials?.[platform] ?? ""}
                    onChangeText={(v) => setSocial(platform, v)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType={
                      platform === "whatsapp" ? "phone-pad" : "default"
                    }
                    maxLength={200}
                  />
                </View>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {/* Said once, where the asking happens. */}
      <Text style={text.caption}>{t("profileInfo.privacy")}</Text>
    </View>
  );
});
