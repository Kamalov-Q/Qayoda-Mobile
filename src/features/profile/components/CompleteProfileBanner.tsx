// src/features/profile/components/CompleteProfileBanner.tsx
// The standing reminder on your own profile, for an account that is still
// mostly empty.
//
// This is the PERSISTENT half of the pair. The sheet (CompleteProfileSheet)
// asks once, after sign-in, and never again — which is right for an
// interruption and wrong for a reminder. Somebody who said "later" and meant
// "not now" still needs a way back in, and a row on the screen they already
// visit is the cheapest one there is.
//
// Wording, deliberately: "incomplete", never "unverified". The verified seal
// is a passport check (app/verify-profile.tsx) and must not share language
// with a form anybody can fill in during an advert break.
import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { radii, spacing, type } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import {
  missingLabels,
  type Completeness,
} from "../lib/completeness";

interface Props {
  /** The whole result, so the banner can name what is still missing. */
  state: Completeness;
}

export const CompleteProfileBanner = memo(function CompleteProfileBanner({
  state,
}: Props) {
  const { colors } = useTheme();
  const t = useT();

  /**
   * Named, not counted.
   *
   * "Your profile is incomplete" leaves the reader to open the form and
   * compare it against their own memory. Listing the fields usually reveals
   * that the only thing between them and the badge is one photograph.
   */
  const missing = missingLabels(state)
    .map((key) => t(key))
    .join(", ");
  const ratio = state.ratio;

  // Grows from empty on mount, so the bar reads as progress rather than as
  // a static decoration that happens to be part-filled.
  const width = useDerivedValue(() =>
    withTiming(ratio, { duration: 520, easing: Easing.out(Easing.cubic) }),
  );
  const fill = useAnimatedStyle(() => ({
    width: `${Math.max(0.04, width.value) * 100}%`,
  }));

  return (
    <Pressable
      onPress={() => router.push("/profile/complete")}
      accessibilityRole="button"
      accessibilityLabel={t("completeProfile.bannerTitle")}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radii.lg,
        // The emblem's gold, not danger red: nothing is broken and nothing
        // is lost. It is an invitation with a reason attached, and gold is
        // already this app's colour for "worth your attention".
        backgroundColor: pressed ? colors.surfaceRaised : colors.goldSoft,
        borderWidth: 1,
        borderColor: colors.goldBorder,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radii.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.goldBorder,
        }}
      >
        <Ionicons name="person-circle-outline" size={24} color={colors.gold} />
      </View>

      <View style={{ flex: 1, gap: 5 }}>
        <Text style={{ ...type.bodyStrong, color: colors.text }}>
          {t("completeProfile.bannerTitle")}
        </Text>
        <Text style={{ ...type.caption, color: colors.textMuted }}>
          {missing
            ? t("completeProfile.bannerMissing", { fields: missing })
            : t("completeProfile.bannerText")}
        </Text>

        {/* How far along, so the ask is finite. "Fill in your profile" with
            no end in sight is a chore; a bar four-fifths across is a minute's
            work somebody can see the end of. */}
        <View
          style={{
            height: 5,
            marginTop: 2,
            borderRadius: radii.pill,
            backgroundColor: colors.border,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={[
              {
                height: "100%",
                borderRadius: radii.pill,
                backgroundColor: colors.gold,
              },
              fill,
            ]}
          />
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.gold} />
    </Pressable>
  );
});
