import { memo, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Section,
  SelectSheet,
  TextField,
  SelectGrid,
  type SelectGridOption,
  type Option,
} from "@/src/components/ui";
import { radii, sizing, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT, useLanguage } from "@/src/i18n";
import { GENDERS, type Gender } from "../api/profile.api";
import {
  SOCIAL_ICONS,
  SOCIAL_PLACEHOLDERS,
  SOCIAL_PLATFORMS,
  type SocialLinks,
  type SocialPlatform,
} from "@/src/features/users/lib/social";
import { maskBirthDate } from "../lib/birth-date";
import { findPlace, useRegions } from "../api/regions.api";

const GENDER_ICONS = {
  MALE: "man-outline",
  FEMALE: "woman-outline",
  OTHER: "person-outline",
} as const satisfies Record<Gender, keyof typeof Ionicons.glyphMap>;

const GENDER_LABELS = {
  MALE: "profileInfo.genderMale",
  FEMALE: "profileInfo.genderFemale",
  OTHER: "profileInfo.genderOther",
} as const;

interface Props {
  /** DD.MM.YYYY as typed — the parent converts on submit. */
  birthDate: string;
  onBirthDate: (value: string) => void;
  birthDateError?: string;
  gender: Gender | "";
  onGender: (value: Gender | "") => void;
  address: string;
  onAddress: (value: string) => void;
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
 * Age is the only required field. Everything else is explicitly marked
 * optional, and a line at the foot says who can see what — a form that asks
 * for an address without saying where it goes gets abandoned.
 */
export const ProfileDetailsFields = memo(function ProfileDetailsFields({
  birthDate,
  onBirthDate,
  birthDateError,
  gender,
  onGender,
  address,
  onAddress,
  bio,
  onBio,
  socials,
  onSocials,
}: Props) {
  const { text, colors } = useTheme();
  const t = useT();

  // Typed with "" in the union so the grid can render nothing selected:
  // the options themselves are only the three real answers.
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

  const { regions } = useRegions();
  const [open, setOpen] = useState<"region" | "district" | null>(null);
  const language = useLanguage();
  const label = (p: { uz: string; ru: string }) =>
    language === "ru" ? p.ru : p.uz;

  // Which region and district the stored code resolves to. The region select
  // is driven by this rather than by its own state, so reopening the form
  // shows the right thing without seeding anything.
  const { region, district } = useMemo(
    () => findPlace(regions, address),
    [regions, address],
  );

  const regionOptions = useMemo<Option<string>[]>(
    () => regions.map((r) => ({ value: r.code, label: label(r) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [regions, language],
  );

  const districtOptions = useMemo<Option<string>[]>(
    () =>
      (region?.districts ?? []).map((d) => ({
        value: d.code,
        label: label(d),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [region, language],
  );

  return (
    <View style={{ gap: spacing.lg }}>
      <TextField
        label={t("profileInfo.birthDate")}
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
        title={`${t("profileInfo.gender")} · ${t("profileInfo.optional")}`}
      >
        <SelectGrid<Gender | "">
          options={genderOptions}
          value={gender}
          // Tapping the chosen one again clears it: this is optional, and
          // without this there is no way back to "would rather not say".
          onChange={(v) => onGender(v === gender ? "" : v)}
        />
      </Section>

      {/* Chosen, not typed. Free text turned one place into a dozen
          spellings, none of which could be counted or filtered — and the
          server now validates the code, so a typed value would simply be
          refused. */}
      {/* Region, then district. Chosen rather than typed: free text turned
          one place into a dozen spellings, and the server now validates the
          code, so a typed value would simply be refused. */}
      <View style={{ gap: spacing.sm }}>
        <PlaceField
          label={`${t("profileInfo.address")} · ${t("profileInfo.optional")}`}
          value={region ? label(region) : null}
          placeholder={t("profileInfo.addressPlaceholder")}
          onPress={() => setOpen("region")}
        />

        {/* Only once a region is chosen — there is nothing to list before
            that, and an empty select reads as broken. */}
        {region ? (
          <PlaceField
            label={t("profileInfo.district")}
            value={district ? label(district) : null}
            placeholder={t("profileInfo.districtPlaceholder")}
            onPress={() => setOpen("district")}
          />
        ) : null}
      </View>

      <SelectSheet
        visible={open === "region"}
        title={t("profileInfo.address")}
        options={regionOptions}
        value={region?.code ?? ""}
        onSelect={(code) => {
          // Picking the same region again clears the whole answer; picking a
          // different one drops the district, which belonged to the old
          // region and would otherwise be a mismatched pair.
          onAddress(code === region?.code ? "" : code);
          setOpen(null);
        }}
        onClose={() => setOpen(null)}
      />

      <SelectSheet
        visible={open === "district"}
        title={t("profileInfo.district")}
        options={districtOptions}
        value={district?.code ?? ""}
        onSelect={(code) => {
          // Deselecting a district falls back to the region, not to nothing:
          // they said that much, and it should not be thrown away.
          onAddress(code === district?.code ? (region?.code ?? "") : code);
          setOpen(null);
        }}
        onClose={() => setOpen(null)}
      />

      {onBio ? (
        <TextField
          label={`${t("profileInfo.bio")} · ${t("profileInfo.optional")}`}
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
          title={`${t("profileInfo.socials")} · ${t("profileInfo.optional")}`}
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

/** A select rendered as a field: label above, current choice and a chevron. */
function PlaceField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
}) {
  const { colors, text } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ gap: spacing.xs, opacity: pressed ? 0.7 : 1 })}
    >
      <Text style={text.label}>{label}</Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          height: sizing.control,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceRaised,
        }}
      >
        <Ionicons name="location-outline" size={18} color={colors.textFaint} />
        <Text
          style={{
            ...text.body,
            flex: 1,
            color: value ? colors.text : colors.textFaint,
          }}
          numberOfLines={1}
        >
          {value ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textFaint} />
      </View>
    </Pressable>
  );
}
