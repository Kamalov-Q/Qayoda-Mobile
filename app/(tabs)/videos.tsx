// app/(tabs)/videos.tsx
//
// The Videos tab: short-form video, the way every feed of it is drawn — one
// clip per screen, full bleed, swiped vertically, with the author and the
// caption over the bottom of the picture and the actions up the right edge.
//
// What makes this one a property app's reel feed rather than a generic one is
// the card above the caption: a video that points at a listing carries the
// way into that listing, and the feed ranks those slightly above the rest.
// See the server's VideosService for how far that "ranking" goes.
//
// The screen has two faces, and the chrome has to match whichever is showing.
// Over video it is white-on-glass and floats; over an empty or failed feed
// there is no video to float on, so the same row is laid out in flow in the
// theme's own colours. Drawn one way for both, white text ended up on a white
// background and the scope tabs sat on top of the empty state's icon.
import { useCallback, useState } from "react";
import { View, Text, RefreshControl, Pressable } from "react-native";
import { router, useIsFocused } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen, EmptyState, LoadingView } from "@/src/components/ui";
import { radii, spacing, type, weight } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { errorMessage } from "@/src/lib/api-error";
import { requirePhone } from "@/src/features/auth/guest";
import { ReelPager } from "@/src/features/videos/components/ReelPager";
import { useVideoFeed } from "@/src/features/videos/hooks/useVideoFeed";
import type { FeedScope } from "@/src/features/videos/api/videos.api";
import { useAuthStore } from "@/src/features/auth/store/auth.store";
import { useImmersiveStore } from "@/src/features/videos/store/immersive.store";

/** White on the picture, the theme's own ink on a page. */
const OVER_VIDEO = {
  ink: "#FFFFFF",
  inkMuted: "rgba(255,255,255,0.62)",
  fill: "rgba(0,0,0,0.42)",
  border: "rgba(255,255,255,0.24)",
} as const;

export default function VideosScreen() {
  const t = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const authed = useAuthStore((s) => s.status === "authenticated");
  // Which of the two feeds. Kept in state rather than in the route, because
  // switching back should land on the reel you left — which it does, since
  // the two are separate query caches.
  const [scope, setScope] = useState<FeedScope>("foryou");
  const feed = useVideoFeed(scope);
  // Set while a finger is held on a reel: this row is chrome over the
  // picture, and a hold is the request to see the picture.
  const immersive = useImmersiveStore((s) => s.immersive);

  const onEndReached = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  }, [feed]);

  const openMine = () => requirePhone(() => router.push("/videos/mine"));
  const openNew = () => requirePhone(() => router.push("/videos/new"));

  /**
   * The one row of chrome this screen has: the shelf, the two feeds, and the
   * way to post.
   *
   * One row rather than three separately positioned controls — that is what
   * guarantees the tabs cannot land on top of the button beside them, at any
   * text size or in any language.
   */
  const chrome = (onVideo: boolean) => {
    const ink = onVideo ? OVER_VIDEO.ink : colors.text;
    const inkMuted = onVideo ? OVER_VIDEO.inkMuted : colors.textFaint;
    const fill = onVideo ? OVER_VIDEO.fill : colors.surfaceRaised;
    const border = onVideo ? OVER_VIDEO.border : colors.border;
    // Over video it floats; over a page it takes its own row, because there
    // is nothing underneath worth seeing through it.
    const shadow = onVideo
      ? { textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 6 }
      : null;

    return (
      <View
        pointerEvents="box-none"
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingTop: insets.top + spacing.sm,
            paddingBottom: spacing.sm,
          },
          onVideo && {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2,
          },
          // Only over video. On a page there is nothing underneath worth
          // uncovering, and nothing to hold down in the first place.
          onVideo && immersive && { opacity: 0 },
        ]}
      >
        <Pressable
          onPress={openMine}
          accessibilityRole="button"
          accessibilityLabel={t("videos.mine")}
          hitSlop={8}
          style={({ pressed }) => ({
            padding: 7,
            borderRadius: radii.pill,
            backgroundColor: fill,
            borderWidth: 1,
            borderColor: border,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Ionicons name="albums-outline" size={17} color={ink} />
        </Pressable>

        {/* For you · Following, centred in whatever space the two buttons
            leave. Hand-drawn rather than the app's SegmentedControl: a
            segmented control is a themed box, and over a reel the two words
            have to read as a title, not as a widget. Only for signed-in
            viewers — a Following tab with nobody followed is a dead end. */}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            justifyContent: "center",
            gap: spacing.md,
          }}
        >
          {authed ? (
            (
              [
                ["foryou", t("follows.scopeForYou")],
                ["following", t("follows.scopeFollowing")],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setScope(value)}
                accessibilityRole="button"
                accessibilityState={{ selected: scope === value }}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text
                  style={{
                    ...type.body,
                    ...weight(scope === value ? "800" : "500"),
                    color: scope === value ? ink : inkMuted,
                    ...(shadow ?? {}),
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))
          ) : (
            /* A guest has nobody to follow, so the tabs would be one real
                 choice and one locked door. The screen says its own name
                 instead, which is also what keeps this row from reading as
                 two buttons floating either side of nothing. */
            <Text
              style={{
                ...type.body,
                ...weight("800"),
                color: ink,
                ...(shadow ?? {}),
              }}
            >
              {t("videos.title")}
            </Text>
          )}
        </View>

        <Pressable
          onPress={openNew}
          accessibilityRole="button"
          accessibilityLabel={t("videos.add")}
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingVertical: 7,
            paddingHorizontal: spacing.sm,
            borderRadius: radii.pill,
            backgroundColor: fill,
            borderWidth: 1,
            borderColor: onVideo ? border : colors.primaryBorder,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Ionicons
            name="add"
            size={17}
            color={onVideo ? ink : colors.primary}
          />
          <Text
            style={{
              ...type.caption,
              ...weight("700"),
              color: onVideo ? ink : colors.primary,
              ...(shadow ?? {}),
            }}
          >
            {t("videos.add")}
          </Text>
        </Pressable>
      </View>
    );
  };

  // Black, not the theme's background: this screen resolves into video either
  // way, and flashing a pale page first makes the feed look like it loaded
  // twice.
  if (feed.isLoading) {
    return (
      <Screen style={{ padding: 0 }} scroll={false} edges={[]}>
        <View style={{ flex: 1, backgroundColor: "#000000" }}>
          {chrome(true)}
          <LoadingView label={null} />
        </View>
      </Screen>
    );
  }

  if (feed.isError) {
    return (
      <Screen style={{ padding: 0 }} scroll={false} edges={[]}>
        {chrome(false)}
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            icon="cloud-offline-outline"
            tone="danger"
            title={t("listings.loadError")}
            description={feed.error ? errorMessage(feed.error) : undefined}
            actionLabel={t("common.retry")}
            onAction={feed.refetch}
          />
        </View>
      </Screen>
    );
  }

  if (!feed.items.length) {
    const following = scope === "following";
    return (
      <Screen style={{ padding: 0 }} scroll={false} edges={[]}>
        {chrome(false)}
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            icon={following ? "people-outline" : "videocam-outline"}
            title={following ? t("follows.feedEmpty") : t("videos.empty")}
            description={
              following ? t("follows.feedEmptyHint") : t("videos.emptyHint")
            }
            // The whole screen exists for this action, so it is not the
            // quiet way out that an empty state's button usually is.
            actionVariant="primary"
            // Nothing to post your way out of on the Following tab: what
            // fixes an empty one is following somebody, which happens on a
            // profile.
            actionLabel={following ? t("follows.scopeForYou") : t("videos.add")}
            onAction={following ? () => setScope("foryou") : openNew}
          />
        </View>
      </Screen>
    );
  }

  return (
    // No safe-area padding and no scroll of its own: the video runs to every
    // edge, and the overlay inside each page keeps its own clear of the notch.
    <Screen style={{ padding: 0 }} scroll={false} edges={[]}>
      {chrome(true)}

      <ReelPager
        videos={feed.items}
        focused={focused}
        onEndReached={onEndReached}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            onRefresh={feed.refetch}
            tintColor="#FFFFFF"
          />
        }
      />
    </Screen>
  );
}
