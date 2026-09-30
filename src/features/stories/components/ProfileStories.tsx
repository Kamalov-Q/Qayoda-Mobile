import { memo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { resolveMediaUrl } from "@/src/lib/media-url";
import { STORY_BACKGROUNDS } from "../api/stories.api";
import { useUserStories } from "../hooks/useStories";
import { StoryViewersSheet } from "./StoryViewersSheet";

const TILE_W = 84;
const TILE_H = 120;

interface Props {
  userId: string;
  /** Your own profile, which is the only place the archive appears. */
  isMe: boolean;
}

/**
 * The strip of stories on a profile.
 *
 * On your own it includes the ones that have run out, dimmed and marked —
 * Telegram's archive. On anybody else's it is only what is still up, because
 * what a person put out for a day is not something strangers read back later.
 *
 * Renders nothing when there are none: an empty band on a profile says less
 * than no band at all.
 */
export const ProfileStories = memo(function ProfileStories({
  userId,
  isMe,
}: Props) {
  const { text } = useTheme();
  const t = useT();
  const { items } = useUserStories(userId, isMe);
  const [viewersFor, setViewersFor] = useState<string | null>(null);

  if (!items.length) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ ...text.label, marginLeft: spacing.xs }}>
        {isMe ? t("stories.archiveTitle") : t("stories.title")}
      </Text>

      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -spacing.lg }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          gap: spacing.sm,
        }}
        renderItem={({ item }) => {
          const palette =
            STORY_BACKGROUNDS[item.background] ?? STORY_BACKGROUNDS[0];

          return (
            <Pressable
              /**
               * On your own profile a tile opens WHO WATCHED IT, which is the
               * question a poster has about a story they already know the
               * contents of — and the only way to reach that list for one
               * that has run out. On anybody else's it plays the story.
               */
              onPress={() =>
                isMe
                  ? setViewersFor(item.id)
                  : item.expired
                    ? undefined
                    : router.push("/stories")
              }
              disabled={!isMe && item.expired}
              accessibilityRole="button"
              style={({ pressed }) => ({
                width: TILE_W,
                height: TILE_H,
                borderRadius: radii.lg,
                overflow: "hidden",
                backgroundColor: palette[1],
                opacity: item.expired ? 0.45 : pressed ? 0.8 : 1,
              })}
            >
              {item.thumbUrl ? (
                <Image
                  source={{ uri: resolveMediaUrl(item.thumbUrl) }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    padding: spacing.xs,
                  }}
                >
                  <Text
                    style={{
                      ...type.caption,
                      fontSize: 10,
                      fontWeight: "700",
                      color: "#FFFFFF",
                      textAlign: "center",
                    }}
                    numberOfLines={5}
                  >
                    {item.body ?? ""}
                  </Text>
                </View>
              )}

              {/* Said rather than only dimmed: "why can I not tap this" is a
                  worse question than one word answering it. */}
              {item.expired && !isMe ? (
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    paddingVertical: 3,
                    backgroundColor: "rgba(0,0,0,0.55)",
                  }}
                >
                  <Ionicons name="time-outline" size={10} color="#FFFFFF" />
                  <Text
                    style={{
                      ...type.caption,
                      fontSize: 9,
                      color: "#FFFFFF",
                    }}
                  >
                    {t("stories.expired")}
                  </Text>
                </View>
              ) : null}

              {/* How it is doing, on the tile. On your own profile this is
                  also the affordance: a number you can tap to see the names
                  behind it. */}
              <View
                style={{
                  position: "absolute",
                  right: 5,
                  top: 5,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                  paddingHorizontal: 5,
                  paddingVertical: 2,
                  borderRadius: radii.pill,
                  backgroundColor: "rgba(0,0,0,0.5)",
                }}
              >
                <Ionicons name="eye" size={9} color="#FFFFFF" />
                <Text
                  style={{ ...type.caption, fontSize: 9, color: "#FFFFFF" }}
                >
                  {item.viewCount}
                </Text>
                {item.reactionCount > 0 ? (
                  <>
                    <Ionicons name="heart" size={9} color="#FFFFFF" />
                    <Text
                      style={{ ...type.caption, fontSize: 9, color: "#FFFFFF" }}
                    >
                      {item.reactionCount}
                    </Text>
                  </>
                ) : null}
              </View>

              {item.expired && isMe ? (
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    paddingVertical: 3,
                    backgroundColor: "rgba(0,0,0,0.55)",
                  }}
                >
                  <Ionicons name="time-outline" size={10} color="#FFFFFF" />
                  <Text
                    style={{ ...type.caption, fontSize: 9, color: "#FFFFFF" }}
                  >
                    {t("stories.expired")}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />

      {isMe ? (
        <Text style={{ ...text.caption, marginLeft: spacing.xs }}>
          {t("stories.archiveHint")}
        </Text>
      ) : null}

      {viewersFor ? (
        <StoryViewersSheet
          storyId={viewersFor}
          visible
          onClose={() => setViewersFor(null)}
          onOpenProfile={(id) => {
            setViewersFor(null);
            router.push(`/profile/${id}`);
          }}
        />
      ) : null}
    </View>
  );
});
