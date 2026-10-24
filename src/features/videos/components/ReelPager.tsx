import { useCallback, useState } from "react";
import {
  View,
  FlatList,
  type LayoutChangeEvent,
  type RefreshControlProps,
  type ViewToken,
} from "react-native";
import { ReelPage } from "./ReelPage";
import { ReportVideoSheet } from "./ReportVideoSheet";
import { VideoCommentsSheet } from "./VideoCommentsSheet";
import { useAuthStore } from "@/src/features/auth/store/auth.store";
import { requirePhone } from "@/src/features/auth/guest";
import { useVideoViews } from "../hooks/useVideoViews";
import { useShareVideo, useToggleVideoLike } from "../hooks/useVideoActions";
import type { Video } from "../api/videos.api";

/**
 * How far either side of the active page a clip is handed to a player.
 *
 * One. The next reel is loaded and paused so the swipe into it is instant;
 * the one after that is a poster and nothing else. Two would double the data
 * a browsing session costs for a video most people never reach.
 */
const PRELOAD = 1;

interface Props {
  videos: Video[];
  /** Whether this screen is the one on top. Nothing plays when it is not. */
  focused: boolean;
  /** Where to start — the share-link screen opens on a specific reel. */
  initialIndex?: number;
  onEndReached?: () => void;
  ListFooterComponent?: React.ReactElement | null;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

/**
 * The vertical pager: one reel per screen, swiped like every short-form feed.
 *
 * Shared by the Videos tab and the single-video screen a shared link opens,
 * so both get the same player rules, the same gestures and the same view
 * counting — the alternative was two pagers that drift apart.
 */
export function ReelPager({
  videos,
  focused,
  initialIndex = 0,
  onEndReached,
  ListFooterComponent,
  refreshControl,
}: Props) {
  /**
   * A page is exactly as tall as the area the list is given.
   *
   * Measured rather than worked out from the window: the tab bar is laid out
   * in flow, so the window's height is not this screen's, and getting it
   * wrong by that much makes every snap drift further down the feed until a
   * sliver of the next clip is permanently showing.
   */
  const [pageHeight, setPageHeight] = useState(0);
  const onLayout = (e: LayoutChangeEvent) =>
    setPageHeight(e.nativeEvent.layout.height);

  const [index, setIndex] = useState(initialIndex);
  // One switch for the whole feed, the way short-form video does it: muting
  // one clip mutes the next, because the reason you muted is still true.
  const [muted, setMuted] = useState(true);

  const { record } = useVideoViews();
  const { toggle } = useToggleVideoLike();
  const share = useShareVideo();

  const viewerId = useAuthStore((s) => s.user?.id);
  // Which reel the report sheet is open for. Null means closed — kept here
  // rather than inside the page so the sheet survives the list recycling the
  // row underneath it.
  const [reporting, setReporting] = useState<Video | null>(null);
  /**
   * Which reel the comments sheet is open for.
   *
   * Here rather than inside the page, for the same reason the report sheet
   * is: one sheet for the whole pager, surviving the list recycling the row
   * underneath it — and the video keeps playing behind it, which is the
   * whole point of a sheet over a screen.
   */
  const [commenting, setCommenting] = useState<Video | null>(null);

  // FlatList throws if this callback changes identity between renders, so it
  // must be created once. useCallback with no deps does that without reading
  // a ref during render — the same way the intro pager does it.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) setIndex(first.index);
    },
    [],
  );

  const onComment = useCallback((video: Video) => setCommenting(video), []);

  const toggleSound = useCallback(() => setMuted((m) => !m), []);

  const onReport = useCallback(
    (video: Video) => requirePhone(() => setReporting(video)),
    [],
  );

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      {pageHeight > 0 ? (
        <FlatList
          data={videos}
          keyExtractor={(v) => v.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={pageHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          initialScrollIndex={initialIndex}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          // Every page is exactly one screen tall, so the list never has to
          // measure anything — which is also what makes initialScrollIndex
          // land in the right place on the first frame.
          getItemLayout={(_, i) => ({
            length: pageHeight,
            offset: pageHeight * i,
            index: i,
          })}
          // Three pages mounted is already three native views; anything
          // further out can wait until it is nearly on screen.
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={1}
          removeClippedSubviews
          onEndReached={onEndReached}
          onEndReachedThreshold={1.5}
          ListFooterComponent={ListFooterComponent}
          refreshControl={refreshControl}
          renderItem={({ item, index: i }) => (
            <ReelPage
              video={item}
              height={pageHeight}
              // Exactly one player may run: the page the pager settled on,
              // and only while this screen is the one in front.
              active={i === index && focused}
              near={Math.abs(i - index) <= PRELOAD}
              muted={muted}
              onToggleSound={toggleSound}
              onLike={toggle}
              onComment={onComment}
              onShare={share}
              onReport={item.authorId === viewerId ? undefined : onReport}
              onWatched={record}
            />
          )}
        />
      ) : null}

      <VideoCommentsSheet
        video={commenting}
        visible={!!commenting}
        onClose={() => setCommenting(null)}
      />

      <ReportVideoSheet
        videoId={reporting?.id ?? ""}
        visible={!!reporting}
        onClose={() => setReporting(null)}
      />
    </View>
  );
}
