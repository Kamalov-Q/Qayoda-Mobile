// src/features/users/components/MembershipBadge.tsx
// Which of two things this account is, said in one pill.
//
// TWO DIFFERENT BADGES LIVE ON A PROFILE, and they must not be confused:
//
//   VerifiedBadge   the scalloped seal. Earned by sending a passport, both
//                   sides, and a selfie holding it, reviewed by a person
//                   (app/verify-profile.tsx). It is a claim about identity.
//
//   MembershipBadge this. Earned by filling in the optional half of a
//                   profile — a photo, a surname, a date. It is a claim
//                   about completeness, nothing more.
//
// The seal outranks this pill, so where both apply the seal is what sits
// beside the name and this sits under it. Nothing here ever says
// "tasdiqlangan"; that word belongs to the document check.
import { memo } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type, weight } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";

interface Props {
  /** From `completeness(profile).complete`. */
  member: boolean;
  /** 13 beside a name, 12 on a card row. */
  size?: number;
}

export const MembershipBadge = memo(function MembershipBadge({
  member,
  size = 13,
}: Props) {
  const { colors } = useTheme();
  const t = useT();

  // A member reads as brand; a guest reads as neutral and says so quietly.
  // Guests are not being told off — most accounts start here, and the pill
  // is what makes the difference legible enough to be worth closing.
  const tint = member ? colors.primary : colors.textMuted;
  const fill = member ? colors.primarySoft : colors.surfaceRaised;
  const edge = member ? colors.primaryBorder : colors.border;

  return (
    <View
      accessibilityRole="text"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        alignSelf: "center",
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radii.pill,
        backgroundColor: fill,
        borderWidth: 1,
        borderColor: edge,
      }}
    >
      <Ionicons
        name={member ? "ribbon" : "person-outline"}
        size={size}
        color={tint}
      />
      <Text
        style={{
          ...type.caption,
          ...weight("700"),
          fontSize: size,
          color: tint,
        }}
      >
        {t(member ? "membership.member" : "membership.guest")}
      </Text>
    </View>
  );
});
