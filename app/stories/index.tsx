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
import { router, useIsFocused, useLocalSearchParams, Stack } from "expo-router";
import * as ExpoLinking from "expo-linking";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";
import { Avatar } from "../../src/components/ui";
import { ActionIcons } from "../../src/features/users/components/ActionIcons";
import { confirm } from "../../src/lib/alerts";
import { toast } from "../../src/components/ui/Toast";
import { requireAuth } from "../../src/features/auth/guest";
import { useChatTarget } from "../../src/features/chat/hooks/useChatTarget";
import { useRelativeDate } from "../../src/features/listings/utils/format";
import { useAuthStore } from "../../src/features/auth/store/auth.store";
import {
  useDeleteStory,
  useMarkStorySeen,
  useReactToStory,
  useStoryTray,
  useUserStories,
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
import {
  StoryMenuSheet,
  type StoryMenuItem,
} from "../../src/features/stories/components/StoryMenuSheet";
import { StoryForwardSheet } from "../../src/features/stories/components/StoryForwardSheet";
import { ReportStorySheet } from "../../src/features/stories/components/ReportStorySheet";
import { saveStoryMedia } from "../../src/features/stories/lib/save-story";

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

/**
 * Legible on anything.
 *
 * Every label over a story is white, which disappears outright on a light
 * one — a TEXT story on a white or pale background, or a photo of a sky.
 * A shadow costs nothing, needs no layout change and no gradient library,
 * and works whatever is behind it.
 */
const OVER_STORY = {
  textShadowColor: "rgba(0,0,0,0.85)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
} as const;

export default function StoriesScreen() {
  const { group, user, story } = useLocalSearchParams<{
    group?: string;
    user?: string;
    story?: string;
  }>();
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const relativeDate = useRelativeDate();

  const viewerId = useAuthStore((s) => s.user?.id);

  /**
   * Two ways in, so two sources.
   *
   * From the tray: everything anybody has up, grouped by poster. From a
   * profile: that one person's, which on your own profile includes the ones
   * that have run out — you can still watch back what you posted, which is
   * what an archive is for.
   */
  const fromProfile = !!user;
  const tray = useStoryTray();
  const mine = useUserStories(user, !!user && user === viewerId);
  const isLoading = fromProfile ? mine.isLoading : tray.isLoading;

  /**
   * Whose story this is.
   *
   * Decided from the story's own author id whenever the viewer is known,
   * rather than trusting the flag the list came with. The tray computes that
   * flag server-side from whoever the request authenticated as, so a tray
   * fetched before sign-in finished — or served from cache to a different
   * account — marks everything as somebody else's, which puts Report on your
   * own story and takes the bin off it.
   */
  const ownedByViewer = useCallback(
    (story: Story, fallback: boolean) =>
      viewerId ? story.authorId === viewerId : fallback,
    [viewerId],
  );

  const pages = useMemo<Page[]>(() => {
    if (fromProfile) {
      const author = tray.groups.find((g) => g.author?.id === user)?.author;
      return mine.items.map((s) => ({
        story: s,
        // The tray may not hold them (an expired story is in nobody's tray),
        // so the card is whatever it can supply and the header falls back to
        // the profile's own name.
        author: author ?? null,
        isMine: ownedByViewer(s, user === viewerId),
      }));
    }

    return tray.groups.flatMap((g) =>
      g.stories.map((s) => ({
        story: s,
        author: g.author,
        isMine: ownedByViewer(s, g.isMine),
      })),
    );
  }, [fromProfile, mine.items, tray.groups, user, viewerId, ownedByViewer]);

  /**
   * Where to open.
   *
   * Derived rather than stored: from a profile the link names a story, and
   * which page that is cannot be known until the pages have loaded. Once the
   * reader moves, `movedTo` takes over and this stops mattering — the tray
   * reorders itself as stories are seen, and following that mid-watch would
   * jump them.
   */
  const start = useMemo(() => {
    if (story) {
      const found = pages.findIndex((p) => p.story.id === story);
      return found >= 0 ? found : 0;
    }

    const groupIndex = Number(group ?? 0);
    if (!Number.isFinite(groupIndex) || groupIndex <= 0) return 0;

    let offset = 0;
    for (let i = 0; i < groupIndex && i < tray.groups.length; i++) {
      offset += tray.groups[i].stories.length;
    }
    return offset;
  }, [story, group, pages, tray.groups]);

  /** Null until the reader moves; after that it is the page they are on. */
  const [movedTo, setMovedTo] = useState<number | null>(null);
  const index = movedTo ?? start;
  /** The pager's real width, measured. 0 until the first layout. */
  const [pageWidth, setPageWidth] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewersFor, setViewersFor] = useState<string | null>(null);
  /** Which of the three overlays is up, if any — one at a time by design. */
  const [sheet, setSheet] = useState<"menu" | "forward" | "report" | null>(
    null,
  );
  /**
   * Sound, for videos.
   *
   * Off to begin with and remembered for the session rather than per story: a
   * reader who turned the sound on wants the next one audible too, and one
   * who left it off is probably somewhere they cannot have it.
   */
  const [muted, setMuted] = useState(true);
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

  // The list mounts before the pages arrive, so `initialScrollIndex` cannot
  // do this on its own — and moving the pager is an imperative act on a
  // widget, not a state change.
  useEffect(() => {
    if (movedTo === null && start > 0 && pageWidth > 0) {
      listRef.current?.scrollToOffset({
        offset: start * pageWidth,
        animated: false,
      });
    }
  }, [start, movedTo, pageWidth]);

  const [videoBuffering, setVideoBuffering] = useState(false);

  const current = pages[index];
  /** A story must not run on while the reader is reading a sheet over it or while video is buffering. */
  const isPaused =
    paused || !!viewersFor || !!sheet || !isFocused || videoBuffering;

  // What "message this person" means here — the same rule the profile uses,
  // so the button leads to the same thread from either place.
  const { target: chatTarget, openChat } = useChatTarget(current?.author?.id);

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
      if (!isFocused || sheet) return;
      if (next < 0) return;
      if (next >= pages.length) {
        close();
        return;
      }
      setMovedTo(next);
      setVideoBuffering(false);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    },
    [pages.length, close, isFocused, sheet],
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

  /**
   * What the ⋯ offers, which depends on the story: there is nothing to save
   * from a text story, and reporting your own makes no sense.
   */
  const menuItems = useMemo<StoryMenuItem[]>(() => {
    if (!current) return [];
    const mediaUrl = current.story.mediaUrl;
    const items: StoryMenuItem[] = [];

    if (mediaUrl) {
      items.push({
        key: "save",
        icon: "download-outline",
        label: t("stories.save"),
        onPress: () => {
          setSheet(null);
          // Fire and forget: saveStoryMedia reports both outcomes itself,
          // and the story should carry on playing meanwhile.
          void saveStoryMedia(mediaUrl);
        },
      });
    }

    items.push({
      key: "forward",
      icon: "arrow-redo-outline",
      label: t("stories.forward"),
      onPress: () => requireAuth(() => setSheet("forward")),
    });

    items.push({
      key: "copy",
      icon: "link-outline",
      label: t("stories.copyLink"),
      onPress: () => {
        setSheet(null);
        // The app's own scheme, the same link Share builds for a listing.
        // It opens the viewer straight on this story — and while the story
        // is up, anybody who has the app can follow it.
        void Clipboard.setStringAsync(
          ExpoLinking.createURL(`/stories`, {
            queryParams: { story: current.story.id },
          }),
        )
          .then(() => toast.successKey("stories.linkCopied"))
          // A clipboard that refuses is not worth an unhandled rejection.
          .catch(() => {});
      },
    });

    if (!current.isMine) {
      items.push({
        key: "report",
        icon: "flag-outline",
        label: t("stories.report"),
        destructive: true,
        onPress: () => requireAuth(() => setSheet("report")),
      });
    }

    return items;
  }, [current, t]);

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
        <Text style={{ ...type.body, color: "#FFFFFF", ...OVER_STORY }}>
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
            onMomentumScrollEnd={(e) => {
              setMovedTo(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
              setVideoBuffering(false);
            }}
            renderItem={({ item, index: i }) => (
              <View style={{ width: pageWidth }}>
                <StoryPlayer
                  story={item.story}
                  active={i === index}
                  paused={isPaused}
                  muted={muted}
                  onBufferingChange={(buffering) => {
                    if (i === index) {
                      setVideoBuffering(buffering);
                    }
                  }}
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

      {/* A scrim under the top chrome. The progress bars are hairline white
          rules, which a text shadow cannot help — they need something behind
          them. Three stacked bands fade out instead of ending on a hard
          edge, since there is no gradient library in the project.
          Non-interactive, so the tap areas underneath still work. */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", left: 0, right: 0, top: 0 }}
      >
        <View style={{ height: insets.top + 56, backgroundColor: "rgba(0,0,0,0.38)" }} />
        <View style={{ height: 22, backgroundColor: "rgba(0,0,0,0.22)" }} />
        <View style={{ height: 22, backgroundColor: "rgba(0,0,0,0.10)" }} />
      </View>

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
          paused={isPaused}
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
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{ ...type.bodyStrong, fontSize: 14, color: "#FFFFFF", ...OVER_STORY }}
                numberOfLines={1}
              >
                {current.isMine ? t("stories.mine") : authorName}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <Text
                  style={{
                    ...type.caption,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.9)",
                    ...OVER_STORY,
                  }}
                >
                  {relativeDate(current.story.createdAt)}
                </Text>
                {/* Message only. Calling somebody straight out of their
                    story is a bigger jump than a story invites, and the
                    button for it belongs on the profile this row opens —
                    where the number is also written out. */}
                {!current.isMine && chatTarget ? (
                  <ActionIcons
                    actions={[
                      {
                        key: "message",
                        icon: "chatbubble-ellipses",
                        label: t("userProfile.write"),
                        onPress: openChat,
                      },
                    ]}
                    tone="overlay"
                    size={30}
                  />
                ) : null}
              </View>
            </View>
          </Pressable>

          {/* Only a video has sound to manage, so only a video offers it. */}
          {current.story.type === "VIDEO" ? (
            <ChromeButton
              icon={muted ? "volume-mute" : "volume-high"}
              label={muted ? t("stories.muted") : t("stories.sound")}
              onPress={() => setMuted((m) => !m)}
            />
          ) : null}
          <ChromeButton
            icon="ellipsis-horizontal"
            label={t("stories.more")}
            onPress={() => setSheet("menu")}
          />
          {current.isMine ? (
            <ChromeButton icon="trash-outline" onPress={onDelete} />
          ) : null}
          <ChromeButton icon="close" onPress={close} />
        </View>
      </View>

      {/* The same scrim at the foot. The owner's bar is small white text and
          hairline icons over whatever the story happens to be — a shadow
          alone leaves it readable but faint on a pale one. */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
      >
        <View style={{ height: 24, backgroundColor: "rgba(0,0,0,0.10)" }} />
        <View style={{ height: 24, backgroundColor: "rgba(0,0,0,0.22)" }} />
        <View
          style={{
            height: insets.bottom + 120,
            backgroundColor: "rgba(0,0,0,0.38)",
          }}
        />
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
            <Ionicons
              name="eye-outline"
              size={17}
              color="#FFFFFF"
              style={OVER_STORY}
            />
            <Text
              style={{ ...type.bodyStrong, fontSize: 14, color: "#FFFFFF", ...OVER_STORY }}
            >
              {current.story.viewCount}
            </Text>
            {current.story.reactionCount > 0 ? (
              <>
                <Ionicons
                  name="heart"
                  size={15}
                  color="#FFFFFF"
                  style={{ marginLeft: spacing.sm, ...OVER_STORY }}
                />
                <Text
                  style={{ ...type.bodyStrong, fontSize: 14, color: "#FFFFFF", ...OVER_STORY }}
                >
                  {current.story.reactionCount}
                </Text>
              </>
            ) : null}
            <Text
              style={{
                ...type.caption,
                color: "#FFFFFF",
                marginLeft: spacing.xs,
                ...OVER_STORY,
              }}
            >
              {t("stories.seeViewers")}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color="#FFFFFF"
              style={OVER_STORY}
            />
          </Pressable>
        ) : (
          <View style={{ gap: spacing.sm }}>
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
                    requireAuth(() => {
                      const storyId = current.story.id;
                      const previous = myReactions[storyId];
                      // Lit before the request, not after it.
                      //
                      // This used to wait for the round trip, so a tap did
                      // nothing visible for as long as the network took —
                      // and because tapping the SAME emoji again removes it,
                      // the second "it didn't work" tap undid the first. The
                      // emoji appeared to need two or three presses when in
                      // fact every press was registering.
                      setMyReactions((m) => ({
                        ...m,
                        [storyId]: previous === emoji ? null : emoji,
                      }));

                      react.mutate(
                        { id: storyId, emoji },
                        {
                          // The server decides; this only corrects a guess
                          // that turned out wrong.
                          onSuccess: (result) =>
                            setMyReactions((m) => ({
                              ...m,
                              [storyId]: result.myReaction,
                            })),
                          onError: () =>
                            setMyReactions((m) => ({
                              ...m,
                              [storyId]: previous ?? null,
                            })),
                        },
                      );
                    })
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

      {sheet === "menu" ? (
        <StoryMenuSheet items={menuItems} onClose={() => setSheet(null)} />
      ) : null}

      {sheet === "forward" ? (
        <StoryForwardSheet
          story={current.story}
          onClose={() => setSheet(null)}
        />
      ) : null}

      <ReportStorySheet
        storyId={current.story.id}
        visible={sheet === "report"}
        onClose={() => setSheet(null)}
      />

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
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  /** For screen readers; close and delete read from their icon well enough. */
  label?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
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
