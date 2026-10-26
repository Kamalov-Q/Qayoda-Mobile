// Videos by caption — the "Videolar" segment of the home search.
//
// Posters in a three-across grid and no players at all, exactly as the
// profile's reel grid does it: a page of results is scanned, not watched,
// and three autoplaying decoders for clips nobody has chosen yet is the
// fastest way to make a search feel broken. Tapping opens the reel.
import { memo, useCallback } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "@/src/components/ui";
import { SearchLoading } from "./SearchStates";
import { radii, spacing, weight } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { useVideoSearch } from "@/src/features/videos/hooks/useVideoFeed";
import type { Video } from "@/src/features/videos/api/videos.api";

/** Three across, like every reels grid, with a 9:16 cell. */
const COLUMNS = 3;

/**
 * 1.2K, 4.1M — the way every explore grid prints a view count.
 *
 * Locale-independent on purpose: these are stamped over a photograph at
 * 11pt, where "1 234 567" does not fit and a thousands separator that
 * changes per language makes the column widths jump.
 */
function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k < 10 ? k.toFixed(1).replace(/\.0$/, "") : Math.round(k)}K`;
  }
  const m = n / 1_000_000;
  return `${m < 10 ? m.toFixed(1).replace(/\.0$/, "") : Math.round(m)}M`;
}

export function VideoResults({
  query,
  contentPaddingTop = 0,
}: {
  /** Already debounced by the field that collected it. */
  query: string;
  contentPaddingTop?: number;
}) {
  const { colors } = useTheme();
  const t = useT();
  const search = useVideoSearch(query);

  const open = useCallback((id: string) => {
    router.push(`/videos/${id}`);
  }, []);

  if (search.isLoading) {
    return <SearchLoading paddingTop={contentPaddingTop} />;
  }

  return (
    <FlatList
      data={search.items}
      keyExtractor={(v) => v.id}
      numColumns={COLUMNS}
      columnWrapperStyle={{ gap: spacing.xs }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingTop: contentPaddingTop + spacing.md,
        paddingBottom: spacing.xxl,
        gap: spacing.xs,
      }}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => <VideoTile video={item} onPress={open} />}
      onEndReached={() => {
        if (search.hasNextPage && !search.isFetchingNextPage) {
          void search.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        search.isFetchingNextPage ? (
          <ActivityIndicator
            style={{ padding: spacing.md }}
            color={colors.primary}
          />
        ) : undefined
      }
      ListEmptyComponent={
        <EmptyState
          icon={search.searching ? "search-outline" : "videocam-outline"}
          title={
            search.searching ? t("search.noVideos") : t("videos.empty")
          }
        />
      }
    />
  );
}


const VideoTile = memo(function VideoTile({
  video,
  onPress,
}: {
  video: Video;
  onPress: (id: string) => void;
}) {
  const { colors } = useTheme();
  const t = useT();

  return (
    <Pressable
      onPress={() => onPress(video.id)}
      accessibilityRole="link"
      accessibilityLabel={video.caption ?? t("videos.title")}
      style={({ pressed }) => ({
        // A THIRD of the row, fixed — not flex. With `flex` a last row
        // holding one or two results stretches them across the full width,
        // so the final tile of a search is three times the size of every
        // tile above it. maxWidth pins it; flexBasis does the dividing.
        flexBasis: `${100 / COLUMNS}%`,
        maxWidth: `${100 / COLUMNS}%`,
        flexGrow: 0,
        aspectRatio: 9 / 16,
        borderRadius: radii.md,
        overflow: "hidden",
        backgroundColor: colors.surfaceRaised,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {video.thumbUrl ? (
        <Image
          source={{ uri: video.thumbUrl }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="videocam-outline" size={22} color={colors.textFaint} />
        </View>
      )}

      {/* Views, bottom-left, the way every explore grid prints them: a wall
          of stills gives no other signal of which clip is worth a tap. */}
      <View
        style={{
          position: "absolute",
          left: 5,
          bottom: 5,
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
        }}
      >
        <Ionicons name="eye" size={11} color="#FFFFFF" />
        <Text style={{ fontSize: 11, color: "#FFFFFF", ...weight("600") }}>
          {compactCount(video.viewCount)}
        </Text>
      </View>

    </Pressable>
  );
});
