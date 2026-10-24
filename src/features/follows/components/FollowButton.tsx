import { memo } from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type, weight } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { requireAuth } from "@/src/features/auth/guest";
import { useFollowState, useToggleFollow } from "../hooks/useFollow";

/**
 * Follow / Following, as one button that knows which it is.
 *
 * Filled while they are not followed and outlined once they are — the
 * convention everywhere, and the one that keeps "Following" from looking
 * like a call to action. Hidden entirely on your own profile, where it would
 * be a button that can only ever refuse.
 */
export const FollowButton = memo(function FollowButton({
  userId,
  isSelf,
  size = "md",
}: {
  userId: string;
  isSelf?: boolean;
  /** `sm` for list rows, `md` for a profile header. */
  size?: "sm" | "md";
}) {
  const { colors } = useTheme();
  const t = useT();
  const { data } = useFollowState(isSelf ? undefined : userId);
  const toggle = useToggleFollow();

  if (isSelf) return null;

  const following = !!data?.following;
  const compact = size === "sm";

  return (
    <Pressable
      onPress={() =>
        requireAuth(() => toggle.mutate({ userId, next: !following }))
      }
      accessibilityRole="button"
      accessibilityLabel={t(following ? "follows.following" : "follows.follow")}
      accessibilityState={{ selected: following }}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingVertical: compact ? 6 : 9,
        paddingHorizontal: compact ? spacing.sm : spacing.lg,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: following ? colors.border : colors.primary,
        backgroundColor: following ? "transparent" : colors.primary,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {following ? (
        <Ionicons
          name="checkmark"
          size={compact ? 13 : 15}
          color={colors.text}
        />
      ) : null}
      <Text
        style={{
          ...(compact ? type.caption : type.body),
          ...weight("700"),
          color: following ? colors.text : colors.onPrimary,
        }}
      >
        {t(following ? "follows.following" : "follows.follow")}
      </Text>
    </Pressable>
  );
});
