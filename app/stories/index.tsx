// The full-screen story viewer: one page per story, tap to move, hold to
// pause. Reached from the tray on Home, which hands it where to start.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { router, useIsFocused, useLocalSearchParams, Stack } from "expo-router";
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
import { useChatTarget } from "../../src/features/chat/hooks/useChatTarget";
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

/**
 * A fallback only. The pager measures itself — a page width taken from
 * `Dimensions` at module load can disagree with what the view is actually
 * given (a different window, a rotation, a resized surface), and when it does
 * the pages stop lining up with their snap points and two stories show at
 * once, half of each.
 */
const FALLBACK_W = Dimensions.get("window").width;

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
  /** The pager's real width, measured. 0 until the first layout. */
  const [pageWidth, setPageWidth] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewersFor, setViewersFor] = useState<string | null>(null);
  /**
   * Whether this screen is the one on top.
   *
   * Tapping the author pushes their profile over this one, which stays
   * mounted — so without this the story kept advancing behind it, the video
   * kept playing, and when the last one ended it called router.back() and
   * closed the profile the reader had just opened.
   */
  const isFocused = useIsFocused();
  /**
   * What you reacted with, per story.
   *
   * Kept here because the viewer builds its pages from the tray, which does
   * not carry your own reaction — so without this a tap sent the emoji to
   * the server and changed nothing on screen, which reads exactly like a
   * button that does not work.
   */
  const [myReactions, setMyReactions] = useState<Record<string, string | null>>(
    {},
  );
  const listRef = useRef<FlatList<Page>>(null);

  const markSeen = useMarkStorySeen();
  const react = useReactToStory();
  const remove = useDeleteStory();

  const current = pages[index];

  // The two things you do about a person, wherever you meet them in this
  // app — the same rule the profile uses for what "message" means.
  const {
    target: chatTarget,
    openChat,
    phone,
  } = useChatTarget(current?.author?.id);

  // Recording a view is what turns the ring grey, so it happens on arrival
  // rather than on finishing — a story you opened is a story you saw.
  const seenRef = useRef(new Set<string>());
  useEffect(() => {
    const id = current?.story.id;
    // Your own stories count too — a story you posted and watched reading
    // "0 views" reads as broken rather than as tactful.
    if (!id || seenRef.current.has(id)) return;
    seenRef.current.add(id);
    markSeen.mutate(id);
    // `markSeen` is a stable mutation object; listing it would re-fire this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.story.id]);

  const close = useCallback(() => router.back(), []);

  const go = useCallback(
    (next: number) => {
      // Nothing moves while something else is on top — least of all the
      // dismissal at the end.
      if (!isFocused) return;
      if (next < 0) return;
      if (next >= pages.length) {
        close();
        return;
      }
      setIndex(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    },
    [pages.length, close, isFocused],
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
      <View
        style={{ flex: 1, backgroundColor: "#000", justifyContent: "center" }}
      >
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

      {/* Rendered only once the width is known, so `getItemLayout`, the page
          width and `initialScrollIndex` cannot disagree with each other. */}
      <View
        style={{ flex: 1 }}
        onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
      >
        {pageWidth > 0 ? (
          <FlatList
            ref={listRef}
            data={pages}
            keyExtractor={(p) => p.story.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(start, pages.length - 1)}
            getItemLayout={(_, i) => ({
              length: pageWidth,
              offset: pageWidth * i,
              index: i,
            })}
            // A tap that interrupts the previous animation can otherwise
            // leave the list resting between two pages.
            disableIntervalMomentum
            decelerationRate="fast"
            onScrollToIndexFailed={({ index: target }) => {
              listRef.current?.scrollToOffset({
                offset: target * pageWidth,
                animated: false,
              });
            }}
            onMomentumScrollEnd={(e) =>
              setIndex(Math.round(e.nativeEvent.contentOffset.x / pageWidth))
            }
            renderItem={({ item, index: i }) => (
              <View style={{ width: pageWidth }}>
                <StoryPlayer
                  story={item.story}
                  active={i === index}
                  paused={paused || !!viewersFor || !isFocused}
                />
              </View>
            )}
          />
        ) : null}
      </View>

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
          width: (pageWidth || FALLBACK_W) / 3,
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
          width: ((pageWidth || FALLBACK_W) * 2) / 3,
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
          paused={paused || !!viewersFor || !isFocused}
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
            <Text
              style={{ ...type.bodyStrong, fontSize: 14, color: "#0F172A" }}
            >
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
            {/* Named, not just numbered: a bare "3" beside an eye does not
                look like something to press, and this is the only way to the
                list of who watched. */}
            <Ionicons name="eye-outline" size={17} color="#FFFFFF" />
            <Text
              style={{ ...type.bodyStrong, fontSize: 14, color: "#FFFFFF" }}
            >
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
            <Text
              style={{
                ...type.caption,
                color: "rgba(255,255,255,0.85)",
                marginLeft: spacing.xs,
              }}
            >
              {t("stories.seeViewers")}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color="rgba(255,255,255,0.85)"
            />
          </Pressable>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {/* Reach the poster without leaving the story — the same pair the
                profile offers, because a story is often the thing that makes
                somebody want to ask. */}
            {chatTarget || phone ? (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: spacing.sm,
                }}
              >
                {phone ? (
                  <StoryAction
                    icon="call-outline"
                    label={t("userProfile.call")}
                    // Swallowed: a device with no dialer would otherwise take
                    // the screen down on a tap.
                    onPress={() =>
                      Linking.openURL(
                        `tel:${phone.replace(/[^\d+]/g, "")}`,
                      ).catch(() => {})
                    }
                  />
                ) : null}
                {chatTarget ? (
                  <StoryAction
                    icon="chatbubble-ellipses-outline"
                    label={t("userProfile.write")}
                    onPress={openChat}
                  />
                ) : null}
              </View>
            ) : null}

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
                      react.mutate(
                        { id: current.story.id, emoji },
                        {
                          onSuccess: (result) =>
                            setMyReactions((m) => ({
                              ...m,
                              [current.story.id]: result.myReaction,
                            })),
                        },
                      ),
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t("stories.reactions")}
                  accessibilityState={{
                    selected: myReactions[current.story.id] === emoji,
                  }}
                  style={({ pressed }) => ({
                    width: 44,
                    height: 44,
                    borderRadius: radii.pill,
                    alignItems: "center",
                    justifyContent: "center",
                    // The one you chose stays lit, so the tap has an answer.
                    backgroundColor:
                      myReactions[current.story.id] === emoji
                        ? colors.primary
                        : "rgba(0,0,0,0.35)",
                    transform: [
                      {
                        scale:
                          pressed || myReactions[current.story.id] === emoji
                            ? 1.18
                            : 1,
                      },
                    ],
                  })}
                >
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
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

/** A labelled action at the foot of a story — call, or write. */
function StoryAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.lg,
        height: 40,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.5)",
        backgroundColor: pressed ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.35)",
      })}
    >
      <Ionicons name={icon} size={16} color="#FFFFFF" />
      <Text style={{ ...type.bodyStrong, fontSize: 14, color: "#FFFFFF" }}>
        {label}
      </Text>
    </Pressable>
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
