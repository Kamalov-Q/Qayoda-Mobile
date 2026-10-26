import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type } from "@/src/theme/tokens";
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
  const { colors } = useTheme();
  const t = useT();
  const { data } = useFollowState(userId);

  if (!data) return null;

  const open = (tab: "followers" | "following") =>
    router.push({ pathname: "/follows/[id]", params: { id: userId, tab } });

  return (
    // Contained, like the stats card below it.
    // These two numbers used to float loose above a bordered panel of three
    // other numbers, which made one profile look like two half-finished
    // designs stacked. Same shell, same rhythm — the difference between the
    // blocks is what they count, not how carefully they were drawn.
    <View
      style={{
        alignSelf: "stretch",
        borderRadius: radii.lg,
        backgroundColor: colors.surfaceRaised,
        paddingVertical: spacing.md,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "stretch" }}>
        <Count
          value={data.followerCount}
          label={t("follows.followers")}
          onPress={() => open("followers")}
        />
        {/* A hairline, as the stats card uses between its cells. */}
        <View style={{ width: 1, backgroundColor: colors.border }} />
        <Count
          value={data.followingCount}
          label={t("follows.followingTitle")}
          onPress={() => open("following")}
        />
      </View>

      {/* Worth saying, and only in this direction: that they follow you is a
          fact about them, where "you follow them" is already the button.
          Under the numbers, not wedged beside them — in Russian it is three
          words competing with two labels for one line, and the first label
          lost. */}
      {data.followsYou ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "center",
            gap: 5,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
            borderRadius: radii.pill,
            backgroundColor: colors.primarySoft,
            borderWidth: 1,
            borderColor: colors.primaryBorder,
          }}
        >
          <Ionicons name="arrow-down" size={11} color={colors.primary} />
          <Text style={{ ...type.caption, color: colors.primary }}>
            {t("follows.followsYou")}
          </Text>
        </View>
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
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.sm,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ ...type.bodyStrong, color: colors.text }}>{value}</Text>
      <Text
        style={{ ...type.caption, color: colors.textMuted, textAlign: "center" }}
      >
        {label}
      </Text>
    </Pressable>
  );
});
