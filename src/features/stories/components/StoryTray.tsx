import { memo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { resolveMediaUrl } from "@/src/lib/media-url";
import { STORY_BACKGROUNDS, type StoryGroup } from "../api/stories.api";

/**
 * Deliberately larger than Telegram's or Instagram's rings.
 *
 * Those trays sit above a feed people came for; this one sits at the top of a
 * screen whose job is to get somebody moving, and it is the only thing on it
 * that changes hour to hour. At 84pt a face is a face rather than a token,
 * and the photo behind it is readable.
 */
const AVATAR = 84;
const RING = 3;

interface Props {
  groups: StoryGroup[];
  /** Whether to offer the "add yours" tile — signed-in readers only. */
  canPost: boolean;
  onOpen: (index: number) => void;
  onCompose: () => void;
}

export const StoryTray = memo(function StoryTray({
  groups,
  canPost,
  onOpen,
  onCompose,
}: Props) {
  const { colors } = useTheme();
  const t = useT();

  // Nothing to show and nothing to add: the row would be an empty band.
  if (!groups.length && !canPost) return null;

  return (
    <FlatList
      data={groups}
      keyExtractor={(g) => g.author?.id ?? String(g.latestAt)}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -spacing.lg }}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
        // The rings cast a shadow and the unseen ones sit proud; without this
        // the row clips them.
        paddingVertical: spacing.xs,
      }}
      ListHeaderComponent={
        canPost ? (
          <Pressable
            onPress={onCompose}
            accessibilityRole="button"
            accessibilityLabel={t("stories.add")}
            style={({ pressed }) => ({
              alignItems: "center",
              gap: 6,
              width: AVATAR + RING * 2,
              marginRight: spacing.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: AVATAR + RING * 2,
                height: AVATAR + RING * 2,
                borderRadius: radii.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primarySoft,
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: colors.primaryBorder,
              }}
            >
              <Ionicons name="add" size={30} color={colors.primary} />
            </View>
            <Text
              style={{ ...type.caption, fontSize: 12, color: colors.textMuted }}
              numberOfLines={1}
            >
              {t("stories.add")}
            </Text>
          </Pressable>
        ) : null
      }
      renderItem={({ item, index }) => (
        <StoryRing group={item} onPress={() => onOpen(index)} />
      )}
    />
  );
});

/**
 * One person in the tray. The ring is the whole point: green means there is
 * something here you have not watched, grey means you have seen it all.
 */
const StoryRing = memo(function StoryRing({
  group,
  onPress,
}: {
  group: StoryGroup;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const t = useT();

  const cover = group.stories.find((s) => s.thumbUrl)?.thumbUrl ?? null;
  const first = group.stories[0];
  const background =
    STORY_BACKGROUNDS[first?.background ?? 0] ?? STORY_BACKGROUNDS[0];
  const name = group.isMine
    ? t("stories.mine")
    : (group.author?.name ?? t("chat.unknownUser"));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => ({
        alignItems: "center",
        gap: 6,
        width: AVATAR + RING * 2,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <View
        style={{
          width: AVATAR + RING * 2,
          height: AVATAR + RING * 2,
          borderRadius: radii.pill,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: RING,
          // Unseen is the loud state. Seen keeps a ring rather than losing it
          // entirely, so the row does not change shape as you watch.
          borderColor: group.hasUnseen ? colors.primary : colors.border,
        }}
      >
        <View
          style={{
            width: AVATAR - 4,
            height: AVATAR - 4,
            borderRadius: radii.pill,
            overflow: "hidden",
            backgroundColor: background[0],
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* The story's own cover, not the poster's avatar: what is IN the
              story is what decides whether it is worth opening. A text story
              has no cover, so it shows its colour and its first words. */}
          {cover ? (
            <Image
              source={{ uri: resolveMediaUrl(cover) }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          ) : (
            <Text
              style={{
                ...type.caption,
                fontSize: 11,
                fontWeight: "700",
                color: "#FFFFFF",
                textAlign: "center",
                paddingHorizontal: 6,
              }}
              numberOfLines={3}
            >
              {first?.body ?? ""}
            </Text>
          )}
        </View>

        {/* More than one, so the ring is worth a tap even when the cover is
            dull. */}
        {group.stories.length > 1 ? (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              right: 2,
              minWidth: 22,
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderRadius: radii.pill,
              backgroundColor: colors.primary,
              borderWidth: 2,
              borderColor: colors.bg,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                ...type.caption,
                fontSize: 10,
                fontWeight: "700",
                color: colors.onPrimary,
              }}
            >
              {group.stories.length}
            </Text>
          </View>
        ) : null}
      </View>

      <Text
        style={{
          ...type.caption,
          fontSize: 12,
          fontWeight: group.hasUnseen ? "700" : "500",
          color: group.hasUnseen ? colors.text : colors.textMuted,
        }}
        numberOfLines={1}
      >
        {name}
      </Text>
    </Pressable>
  );
});
