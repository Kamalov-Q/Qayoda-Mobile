import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { spacing, type } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { useFollowState } from "../hooks/useFollow";

/**
 * "128 followers · 12 following", both tappable.
 *
 * Numbers that open the list they count, because a follower count nobody can
 * look behind is a number with nothing to check it against — and on a
 * marketplace, who an agency's followers are is useful information.
 */
export const FollowCounts = memo(function FollowCounts({
  userId,
}: {
  userId: string;
}) {
  const { colors, text } = useTheme();
  const t = useT();
  const { data } = useFollowState(userId);

  if (!data) return null;

  const open = (tab: "followers" | "following") =>
    router.push({ pathname: "/follows/[id]", params: { id: userId, tab } });

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}
    >
      <Count
        value={data.followerCount}
        label={t("follows.followers")}
        onPress={() => open("followers")}
      />
      <Count
        value={data.followingCount}
        label={t("follows.followingTitle")}
        onPress={() => open("following")}
      />

      {/* Worth saying, and only in this direction: that they follow you is a
          fact about them, where "you follow them" is already the button. */}
      {data.followsYou ? (
        <Text style={{ ...text.caption, color: colors.textMuted }}>
          {t("follows.followsYou")}
        </Text>
      ) : null}
    </View>
  );
});

const Count = memo(function Count({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      hitSlop={6}
      style={({ pressed }) => ({
        alignItems: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ ...type.bodyStrong, color: colors.text }}>{value}</Text>
      <Text style={{ ...type.caption, color: colors.textMuted }}>{label}</Text>
    </Pressable>
  );
});
