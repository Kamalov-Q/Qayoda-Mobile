// The full-screen story viewer: one page per story, tap to move, hold to
// pause. Reached from the tray on Home, which hands it where to start.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";
import { Avatar } from "../../src/components/ui";
import { confirm } from "../../src/lib/alerts";
import { toast } from "../../src/components/ui/Toast";
import { requireAuth } from "../../src/features/auth/guest";
import { useRelativeDate } from "../../src/features/listings/utils/format";
import {
  useDeleteStory,
  useMarkStorySeen,
  useReactToStory,
  useStoryTray,
} from "../../src/features/stories/hooks/useStories";
import {
  STORY_REACTIONS,
  type Story,
  type StoryAuthor,
} from "../../src/features/stories/api/stories.api";
import {
  StoryPlayer,
  STILL_DURATION_MS,
} from "../../src/features/stories/components/StoryPlayer";
import { StoryProgress } from "../../src/features/stories/components/StoryProgress";
import { StoryViewersSheet } from "../../src/features/stories/components/StoryViewersSheet";

const { width: SCREEN_W } = Dimensions.get("window");

/** One flat page per story, so moving between authors is the same gesture as
 *  moving between their stories — which is what a reader expects. */
interface Page {
  story: Story;
  author: StoryAuthor | null;
  isMine: boolean;
}

export default function StoriesScreen() {
  const { group } = useLocalSearchParams<{ group?: string }>();
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const relativeDate = useRelativeDate();

  const { groups, isLoading } = useStoryTray();

  const pages = useMemo<Page[]>(
    () =>
      groups.flatMap((g) =>
        g.stories.map((story) => ({
          story,
          author: g.author,
          isMine: g.isMine,
        })),
      ),
    [groups],
  );

  // Where the tray asked us to start. Read once: the tray reorders itself as
  // stories are seen, and following that mid-watch would jump the reader.
  const [start] = useState(() => {
    const index = Number(group ?? 0);
    if (!Number.isFinite(index) || index <= 0) return 0;
    let offset = 0;
    for (let i = 0; i < index && i < groups.length; i++) {
      offset += groups[i].stories.length;
    }
    return offset;
  });

  const [index, setIndex] = useState(start);
  const [paused, setPaused] = useState(false);
  const [viewersFor, setViewersFor] = useState<string | null>(null);
  const listRef = useRef<FlatList<Page>>(null);

  const markSeen = useMarkStorySeen();
  const react = useReactToStory();
  const remove = useDeleteStory();

  const current = pages[index];

  // Recording a view is what turns the ring grey, so it happens on arrival
  // rather than on finishing — a story you opened is a story you saw.
  const seenRef = useRef(new Set<string>());
  useEffect(() => {
    const id = current?.story.id;
    if (!id || current?.isMine || seenRef.current.has(id)) return;
    seenRef.current.add(id);
    markSeen.mutate(id);
    // `markSeen` is a stable mutation object; listing it would re-fire this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.story.id, current?.isMine]);

  const close = useCallback(() => router.back(), []);

  const go = useCallback(
    (next: number) => {
      if (next < 0) return;
      if (next >= pages.length) {
        close();
        return;
      }
      setIndex(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    },
    [pages.length, close],
  );

  const openProfile = useCallback((userId: string) => {
    router.push(`/profile/${userId}`);
  }, []);

  const onDelete = useCallback(() => {
    if (!current) return;
    confirm({
      titleKey: "stories.deleteTitle",
      messageKey: "stories.deleteMessage",
      confirmKey: "common.delete",
      destructive: true,
      onConfirm: () => {
        remove.mutate(current.story.id, {
          onSuccess: () => {
            toast.successKey("stories.deleted");
            close();
          },
        });
      },
    });
  }, [current, remove, close]);

  if (isLoading && !pages.length) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center" }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  if (!current) {
    // Everything expired while the tray was on screen, or the link was stale.
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.md,
        }}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="time-outline" size={32} color="rgba(255,255,255,0.6)" />
        <Text style={{ ...type.body, color: "#FFFFFF" }}>
          {t("stories.emptyTitle")}
        </Text>
        <Pressable onPress={close} hitSlop={12}>
          <Text style={{ ...type.bodyStrong, color: colors.primary }}>
            {t("common.close")}
          </Text>
        </Pressable>
      </View>
    );
  }

  const authorName =
    [current.author?.name, current.author?.surname].filter(Boolean).join(" ") ||
    t("chat.unknownUser");
  const durationMs =
    current.story.type === "VIDEO" && current.story.durationSec
      ? current.story.durationSec * 1000
      : STILL_DURATION_MS;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(p) => p.story.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={start}
        getItemLayout={(_, i) => ({
          length: SCREEN_W,
          offset: SCREEN_W * i,
          index: i,
        })}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
        }
        renderItem={({ item, index: i }) => (
          <View style={{ width: SCREEN_W }}>
            <StoryPlayer
              story={item.story}
              active={i === index}
              paused={paused || !!viewersFor}
            />
          </View>
        )}
      />

      {/* The tap areas, over the story and under the chrome: a third on the
          left goes back, the rest forward, and a press held anywhere pauses
          so a caption can be read. */}
      <Pressable
        onPress={() => go(index - 1)}
        onLongPress={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        delayLongPress={180}
        style={{
          position: "absolute",
          left: 0,
          top: insets.top + 60,
          bottom: 120,
          width: SCREEN_W / 3,
        }}
      />
      <Pressable
        onPress={() => go(index + 1)}
        onLongPress={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        delayLongPress={180}
        style={{
          position: "absolute",
          right: 0,
          top: insets.top + 60,
          bottom: 120,
          width: (SCREEN_W * 2) / 3,
        }}
      />

      {/* Chrome. Everything below sits above the tap areas, so a button is a
          button rather than a way to skip a story by accident. */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: insets.top + spacing.sm,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
        }}
      >
        <StoryProgress
          count={pages.length}
          index={index}
          durationMs={durationMs}
          paused={paused || !!viewersFor}
          onDone={() => go(index + 1)}
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          {/* The poster, and a way to their profile — the reason a story is
              worth watching is usually who posted it. */}
          <Pressable
            onPress={() => current.author && openProfile(current.author.id)}
            disabled={!current.author}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              flex: 1,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Avatar
              uri={current.author?.avatarThumbUrl ?? null}
              name={current.author?.name}
              size={34}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{ ...type.bodyStrong, fontSize: 14, color: "#FFFFFF" }}
                numberOfLines={1}
              >
                {current.isMine ? t("stories.mine") : authorName}
              </Text>
              <Text
                style={{
                  ...type.caption,
                  fontSize: 11,
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                {relativeDate(current.story.createdAt)}
              </Text>
            </View>
          </Pressable>

          {current.isMine ? (
            <ChromeButton icon="trash-outline" onPress={onDelete} />
          ) : null}
          <ChromeButton icon="close" onPress={close} />
        </View>
      </View>

      {/* The foot: where a story sends you, how it is doing, and how to
          answer it. */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: insets.bottom + spacing.md,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
        }}
      >
        {current.story.listingId ? (
          <Pressable
            onPress={() => router.push(`/listing/${current.story.listingId}`)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.xs,
              alignSelf: "center",
              paddingHorizontal: spacing.lg,
              paddingVertical: 10,
              borderRadius: radii.pill,
              backgroundColor: pressed
                ? "rgba(255,255,255,0.75)"
                : "rgba(255,255,255,0.92)",
            })}
          >
            <Ionicons name="home" size={16} color="#0F172A" />
            <Text style={{ ...type.bodyStrong, fontSize: 14, color: "#0F172A" }}>
              {t("stories.openListing")}
            </Text>
            <Ionicons name="chevron-forward" size={15} color="#0F172A" />
          </Pressable>
        ) : null}

        {current.isMine ? (
          <Pressable
            onPress={() => setViewersFor(current.story.id)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.xs,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="eye-outline" size={17} color="#FFFFFF" />
            <Text style={{ ...type.bodyStrong, fontSize: 14, color: "#FFFFFF" }}>
              {current.story.viewCount}
            </Text>
            {current.story.reactionCount > 0 ? (
              <>
                <Ionicons
                  name="heart"
                  size={15}
                  color="rgba(255,255,255,0.9)"
                  style={{ marginLeft: spacing.sm }}
                />
                <Text
                  style={{ ...type.bodyStrong, fontSize: 14, color: "#FFFFFF" }}
                >
                  {current.story.reactionCount}
                </Text>
              </>
            ) : null}
          </Pressable>
        ) : (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: spacing.xs,
            }}
          >
            {STORY_REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() =>
                  requireAuth(() =>
                    react.mutate({ id: current.story.id, emoji }),
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={t("stories.reactions")}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: radii.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,0,0,0.35)",
                  transform: [{ scale: pressed ? 1.2 : 1 }],
                })}
              >
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {viewersFor ? (
        <StoryViewersSheet
          storyId={viewersFor}
          visible
          onClose={() => setViewersFor(null)}
          onOpenProfile={(id) => {
            setViewersFor(null);
            openProfile(id);
          }}
        />
      ) : null}
    </View>
  );
}

/** A round control over a photo — white on a scrim, so it reads on anything. */
function ChromeButton({
  icon,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.3)",
      })}
    >
      <Ionicons name={icon} size={19} color="#FFFFFF" />
    </Pressable>
  );
}
