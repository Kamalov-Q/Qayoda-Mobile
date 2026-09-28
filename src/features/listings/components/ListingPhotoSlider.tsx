// The photo strip on a listing card: swipeable, auto-advancing, looping, with
// dots. One per card, and deliberately NOT in step with its neighbours.
import { memo, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  type LayoutChangeEvent,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "expo-router";
import { spacing, radii } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { resolveMediaUrl } from "../../../lib/media-url";

export interface SliderPhoto {
  thumbUrl?: string | null;
  url?: string | null;
}

interface Props {
  photos: SliderPhoto[];
  height: number;
  /** Tapping a photo opens the listing — the slider must not swallow it. */
  onPress: () => void;
  /** Off for a single photo, and for screens where motion would be noise. */
  autoPlay?: boolean;
  /** No arrows, and a smaller placeholder — grid width has no room for them. */
  compact?: boolean;
  /**
   * Whether a drag pages the photos.
   *
   * Off inside a horizontal rail: this is a paging ScrollView, and nested in
   * another one it wins every horizontal drag that starts on a photo — which
   * is most of the card — leaving the rail itself feeling stuck. The arrows
   * are taps, so they keep working either way.
   */
  swipeable?: boolean;
}

const BASE_INTERVAL = 4200;
/** More than this and the dots stop being countable; show a counter instead. */
const MAX_DOTS = 6;

export const ListingPhotoSlider = memo(function ListingPhotoSlider({
  photos,
  height,
  onPress,
  autoPlay = true,
  compact,
  swipeable = true,
}: Props) {
  const { colors } = useTheme();
  const scroller = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const isFocused = useIsFocused();

  /**
   * Every card gets its own rhythm.
   *
   * With one shared interval the whole feed flips at the same instant, which
   * reads as the screen glitching rather than as photos changing. A random
   * phase and a slightly random period keep them independent — and because
   * both are fixed per mount, a card does not change speed as you scroll.
   */
  // Lazy state, not a ref: the value is computed once on mount, which is
  // what a ref was reaching for, but reading a ref during render is not
  // allowed and `Math.random()` there is not pure either.
  const [phase] = useState(() => Math.random() * BASE_INTERVAL);
  const [period] = useState(() => BASE_INTERVAL + Math.random() * 1800);

  // Paused while a finger is on it: advancing under someone's thumb is the
  // fastest way to make a gallery feel possessed.
  const [dragging, setDragging] = useState(false);

  const count = photos.length;
  const canPlay = autoPlay && isFocused && !dragging && count > 1 && width > 0;

  useEffect(() => {
    if (!canPlay) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        setIndex((current) => {
          const next = current + 1;
          if (next >= count) {
            // Wrap without animation: animating back through every photo
            // reads as a rewind, not as a loop.
            scroller.current?.scrollTo({ x: 0, animated: false });
            return 0;
          }
          scroller.current?.scrollTo({ x: next * width, animated: true });
          return next;
        });
      }, period);
    }, phase);

    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [canPlay, count, width, period, phase]);

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  const step = (delta: number) => {
    const next = (index + delta + count) % count;
    setIndex(next);
    scroller.current?.scrollTo({ x: next * width, animated: true });
  };

  return (
    <View
      onLayout={onLayout}
      style={{ height, backgroundColor: colors.surfaceRaised }}
    >
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={swipeable && count > 1}
        onScrollBeginDrag={() => setDragging(true)}
        onScrollEndDrag={() => setDragging(false)}
        onMomentumScrollEnd={(e) => {
          if (!width) return;
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
      >
        {(count ? photos : [{}]).map((photo, i) => {
          const uri = resolveMediaUrl(photo.thumbUrl ?? photo.url);
          return (
            <Pressable key={i} onPress={onPress} style={{ width, height }}>
              {uri ? (
                <Image
                  source={{ uri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  transition={150}
                  cachePolicy="memory-disk"
                  // Only the visible photo and its neighbour are worth
                  // decoding eagerly on a feed of a hundred cards.
                  priority={i === 0 ? "normal" : "low"}
                />
              ) : (
                <View
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="image-outline"
                    size={compact ? 26 : 30}
                    color={colors.textFaint}
                  />
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Arrows only where there is room for them, and only on a card with
          something to move to. A thumb reaches the edges; a cursor does not. */}
      {count > 1 && !compact ? (
        <>
          <Arrow side="left" onPress={() => step(-1)} />
          <Arrow side="right" onPress={() => step(1)} />
        </>
      ) : null}

      {count > 1 ? (
        <View
          style={{
            position: "absolute",
            bottom: spacing.sm,
            alignSelf: "center",
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: radii.pill,
            backgroundColor: colors.imageScrim,
          }}
        >
          {count <= MAX_DOTS ? (
            photos.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === index ? 14 : 5,
                  height: 5,
                  borderRadius: radii.pill,
                  backgroundColor:
                    i === index ? "#FFFFFF" : "rgba(255,255,255,0.5)",
                }}
              />
            ))
          ) : (
            // Twelve dots is a smear; a counter is the honest version.
            <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "600" }}>
              {index + 1}/{count}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
});

function Arrow({
  side,
  onPress,
}: {
  side: "left" | "right";
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      style={({ pressed }) => ({
        position: "absolute",
        top: "50%",
        marginTop: -14,
        [side]: spacing.sm,
        width: 28,
        height: 28,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.imageScrim,
        opacity: pressed ? 0.7 : 0.85,
      })}
    >
      <Ionicons
        name={side === "left" ? "chevron-back" : "chevron-forward"}
        size={16}
        color="#FFFFFF"
      />
    </Pressable>
  );
}
