// One reel on its own, which is where a shared link lands.
//
// The same pager as the tab, with one item in it: a link that opened a
// different player — or worse, a web page — would be the one place in the app
// where video behaves differently from everywhere else.
import { View, Pressable } from "react-native";
import { router, Stack, useIsFocused, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Screen, EmptyState, LoadingView } from "@/src/components/ui";
import { radii, spacing } from "@/src/theme/tokens";
import { useT } from "@/src/i18n";
import { errorMessage } from "@/src/lib/api-error";
import { ReelPager } from "@/src/features/videos/components/ReelPager";
import { useVideo } from "@/src/features/videos/hooks/useVideoFeed";

export default function VideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const focused = useIsFocused();
  const { data: video, isLoading, isError, error, refetch } = useVideo(id);

  if (isLoading) {
    return (
      <Screen style={{ padding: 0 }} scroll={false} edges={[]}>
        <LoadingView label={null} />
        <BackButton />
      </Screen>
    );
  }

  if (isError || !video) {
    return (
      <Screen scroll={false}>
        <Stack.Screen options={{ title: t("videos.title") }} />
        <EmptyState
          icon="videocam-off-outline"
          tone="danger"
          title={t("videos.unavailable")}
          description={error ? errorMessage(error) : undefined}
          actionLabel={t("common.retry")}
          onAction={refetch}
        />
      </Screen>
    );
  }

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={[]}>
      {/* The header is hidden: a title bar over a full-bleed video is a
          stripe across somebody's flat. The way out is the chevron below
          instead, drawn over the picture. */}
      <Stack.Screen options={{ headerShown: false }} />
      <ReelPager videos={[video]} focused={focused} />
      <BackButton />
    </Screen>
  );
}

/**
 * The way out, over the video.
 *
 * This screen used to rely on the platform's own back gesture, which is only
 * half true: Android has no edge swipe here, and the screen is reached from
 * "my videos" as often as from a shared link — so for most of the people
 * arriving, there was no way back at all.
 *
 * Top LEFT, clear of the action rail and the caption, both of which live at
 * the bottom. Dark glass rather than a surface colour, because what is behind
 * it is somebody's video and not the app's background.
 */
function BackButton() {
  const insets = useSafeAreaInsets();
  const t = useT();

  return (
    <View
      style={{
        position: "absolute",
        left: spacing.md,
        top: insets.top + spacing.sm,
      }}
    >
      <Pressable
        // A share link can land here with nothing behind it, so going back
        // falls through to the feed rather than doing nothing at all.
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/(tabs)/videos")
        }
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: radii.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.45)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.22)",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
