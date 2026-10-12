import { memo, useMemo } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Avatar } from "@/src/components/ui";
import { radii } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { useStoryTray } from "../hooks/useStories";

interface Props {
  userId: string | null | undefined;
  uri: string | null | undefined;
  name: string | null | undefined;
  size: number;
  online?: boolean;
  /** Falls back to this when the person has nothing up. */
  onPress?: () => void;
}

const RING = 2.5;

/**
 * An avatar that knows whether its owner has a story up.
 *
 * The ring comes from the tray the app already holds, so this costs nothing
 * extra where the tray is warm and one request where it is not — no new
 * endpoint, and one source of truth for "who has something up right now".
 *
 * Unseen rings in the brand colour; watched and story-less alike ring in the
 * hairline grey — a ring that survives being watched stops meaning anything
 * by the second look, and one that appears from nothing changes the size of
 * the avatar it is around.
 */
export const StoryAvatar = memo(function StoryAvatar({
  userId,
  uri,
  name,
  size,
  online,
  onPress,
}: Props) {
  const { colors } = useTheme();
  const t = useT();
  const { groups } = useStoryTray();

  const group = useMemo(
    () => (userId ? groups.find((g) => g.author?.id === userId) : undefined),
    [groups, userId],
  );

  const avatar = (
    <Avatar
      uri={uri ?? null}
      name={name ?? undefined}
      size={size}
      online={online}
    />
  );

  const hasStory = !!group && !!userId;

  /**
   * The ring is always drawn, even with nothing behind it.
   *
   * It used to appear only for people who had a story up, which made the
   * avatar five points bigger and framed on one profile and bare on the
   * next — the same screen looking like two different designs depending on
   * whether the person had posted that day. Unseen rings in the brand
   * colour, everything else in the hairline the rest of the app uses.
   */
  return (
    <Pressable
      onPress={
        hasStory ? () => router.push(`/stories?user=${userId}`) : onPress
      }
      disabled={!hasStory && !onPress}
      accessibilityRole="button"
      accessibilityLabel={hasStory ? t("stories.title") : undefined}
      style={({ pressed }) => ({
        padding: RING,
        borderRadius: radii.pill,
        borderWidth: RING,
        borderColor: group?.hasUnseen ? colors.primary : colors.border,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View>{avatar}</View>
    </Pressable>
  );
});
