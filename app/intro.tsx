// app/intro.tsx — the first-launch story, told once. Four swipes: the brand,
// then what makes this app different, then straight into browsing. The flag
// persists, so a returning user never sees it again.
//
// Skippable, deliberately. It used to insist on all four screens "the way
// banking apps do it", which is a cost paid by exactly the people least
// willing to pay it: someone who already knows what they came to do. Skip
// marks the intro seen, so it is a choice made once, not a nag.
import { memo, useRef, useState } from "react";
import { View, Text, FlatList, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { IntroArt, type IntroArtKey } from "../src/features/intro/IntroArt";
import {
  Screen,
  Button,
  BrandMark,
  LanguageSwitcher,
} from "../src/components/ui";
import { spacing, radii } from "../src/theme/tokens";
import { useTheme } from "../src/theme/useTheme";
import { useT, type TranslationKey } from "../src/i18n";
import { usePreferences } from "../src/lib/preferences";

// The brand poster — its own artwork carries the "GROWEN CITY" wordmark and
// tagline, so the slide under it only has to say welcome in the UI language.
const HERO = require("../assets/images/intro-hero.jpg");

type Slide = {
  titleKey: TranslationKey;
  textKey: TranslationKey;
} & ({ art: IntroArtKey; hero?: never } | { hero: number; art?: never });

const SLIDES: Slide[] = [
  { hero: HERO, titleKey: "intro.welcomeTitle", textKey: "intro.welcomeText" },
  { art: "map", titleKey: "intro.s1Title", textKey: "intro.s1Text" },
  { art: "post", titleKey: "intro.s2Title", textKey: "intro.s2Text" },
  { art: "chat", titleKey: "intro.s3Title", textKey: "intro.s3Text" },
];

/**
 * The pager is a Reanimated scroll view so the whole story moves on the UI
 * thread: the art parallaxes, the words settle and the dots stretch straight
 * from the scroll offset, without a render per frame.
 */
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Slide>);

export default function IntroScreen() {
  const [page, setPage] = useState(0);
  // The worklet's own copy, so it can tell a page change from a stray frame
  // without reading React state it is not allowed to see.
  const pageRef = useSharedValue(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const { width, height } = useWindowDimensions();
  // Square poster, as large as fits: never wider than the slide's padded
  // width, and capped by height so the title and text still fit on a small
  // phone (iPhone SE) under the header and above the button.
  const heroSize = Math.min(width - spacing.xl * 2, height * 0.42);
  const setIntroSeen = usePreferences((s) => s.setIntroSeen);
  const t = useT();

  const last = page === SLIDES.length - 1;

  /**
   * How far the pager has scrolled, in pixels, kept on the UI thread.
   *
   * Everything that moves with the swipe reads this directly, so the art,
   * the words and the dots all travel with the finger rather than snapping
   * when a JS state update lands a frame or two later.
   */
  const scrollX = useSharedValue(0);

  /**
   * `page` still exists, but only for the things that change ONCE per slide:
   * the button's label and whether "skip" is offered. It is set from the
   * worklet through runOnJS, and only when the rounded page actually
   * changes — so a full swipe costs one JS call, not one per frame.
   *
   * Derived from the offset rather than from onViewableItemsChanged, which
   * depends on cell measurements VirtualizedList does not reliably have on
   * web — that left the dots frozen on slide one.
   */
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
      const viewport = e.layoutMeasurement.width;
      if (!viewport) return;
      const next = Math.round(e.contentOffset.x / viewport);
      if (next !== pageRef.value) {
        pageRef.value = next;
        runOnJS(setPage)(next);
      }
    },
  });

  /** Mark the story told and go in. Shared by "skip" and the last slide. */
  const finish = () => {
    setIntroSeen();
    router.replace("/(tabs)/home");
  };

  const advance = () => {
    if (last) {
      finish();
      return;
    }
    // scrollToOffset, not scrollToIndex: the latter asks VirtualizedList
    // where an index lives, and without getItemLayout that answer comes from
    // measured frames which web does not reliably have. The slides are
    // exactly one viewport wide, so the offset is arithmetic.
    listRef.current?.scrollToOffset({
      offset: (page + 1) * width,
      animated: true,
    });
  };

  return (
    <Screen style={{ padding: 0 }} scroll={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
        }}
      >
        <BrandMark size={40} />
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
        >
          {/* The very first screen is exactly where the language choice
              belongs — everything after it reads in the right one. */}
          <LanguageSwitcher />
          {/* Hidden on the last slide: the button below already leaves, and
              two ways out side by side only makes the reader choose. */}
          {!last ? (
            <Button
              title={t("common.skip")}
              variant="link"
              size="sm"
              onPress={finish}
            />
          ) : null}
        </View>
      </View>

      <AnimatedFlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.titleKey}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        // 16 was the old budget for a JS handler. The handler is a worklet
        // now, so every frame is affordable and the motion is continuous.
        scrollEventThrottle={1}
        // Fixed-width slides, so the list never has to measure a cell to know
        // where it starts — which is what made paging fragile on web.
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <IntroSlide
            slide={item}
            index={index}
            width={width}
            heroSize={heroSize}
            scrollX={scrollX}
            active={page === index}
          />
        )}
      />

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        {/* Dots — where you are in the story. */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: spacing.sm,
          }}
        >
          {/* The dot does not jump a slide late any more: its width and
              colour are read straight off the scroll offset, so it stretches
              as the finger moves and is already the right shape when the
              page settles. */}
          {SLIDES.map((s, i) => (
            <Dot key={s.titleKey} index={i} width={width} scrollX={scrollX} />
          ))}
        </View>

        <Button
          title={last ? t("intro.start") : t("intro.next")}
          onPress={advance}
        />
      </View>
    </Screen>
  );
}

/**
 * One slide, moving against the swipe.
 *
 * The art travels further than the words and fades sooner, which reads as
 * depth rather than as a sheet of content sliding by. Both are plain
 * transforms and opacities, so the compositor does the work.
 */
const IntroSlide = memo(function IntroSlide({
  slide,
  index,
  width,
  heroSize,
  scrollX,
  active,
}: {
  slide: Slide;
  index: number;
  width: number;
  heroSize: number;
  scrollX: SharedValue<number>;
  active: boolean;
}) {
  const { colors, text } = useTheme();
  const t = useT();

  /** -1 one slide to the left, 0 centred, 1 one slide to the right. */
  const artStyle = useAnimatedStyle(() => {
    const p = scrollX.value / width - index;
    return {
      opacity: interpolate(Math.abs(p), [0, 0.7], [1, 0], Extrapolation.CLAMP),
      transform: [
        // Lags the page by a third, so it drifts rather than rides along.
        { translateX: p * width * 0.33 },
        {
          scale: interpolate(
            Math.abs(p),
            [0, 1],
            [1, 0.82],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const copyStyle = useAnimatedStyle(() => {
    const p = scrollX.value / width - index;
    return {
      opacity: interpolate(Math.abs(p), [0, 0.5], [1, 0], Extrapolation.CLAMP),
      transform: [
        // Closer to the page than the art is — the near layer.
        { translateX: p * width * 0.12 },
        {
          translateY: interpolate(
            Math.abs(p),
            [0, 1],
            [0, 26],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  return (
    <View
      style={{
        width,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.xl,
        gap: spacing.lg,
      }}
    >
      <Animated.View style={artStyle}>
        {/* Narrowed on `art` rather than `hero`: the union is discriminated
            by which one is present, and TypeScript only follows that in the
            direction that proves `art` is there. */}
        {slide.art === undefined ? (
          <Image
            source={slide.hero}
            accessibilityLabel="Growen City"
            style={{
              width: heroSize,
              height: heroSize,
              borderRadius: radii.xl,
            }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: 148,
              height: 148,
              borderRadius: radii.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primarySoft,
              borderWidth: 1,
              borderColor: colors.primaryBorder,
            }}
          >
            <IntroArt
              art={slide.art}
              size={92}
              color={colors.primary}
              drawKey={index}
              active={active}
            />
          </View>
        )}
      </Animated.View>

      <Animated.View style={[{ gap: spacing.lg }, copyStyle]}>
        <Text style={{ ...text.display, textAlign: "center" }}>
          {t(slide.titleKey)}
        </Text>
        <Text
          style={{ ...text.body, color: colors.textMuted, textAlign: "center" }}
        >
          {t(slide.textKey)}
        </Text>
      </Animated.View>
    </View>
  );
});

/** One position marker, stretching into a pill as its slide arrives. */
const Dot = memo(function Dot({
  index,
  width,
  scrollX,
}: {
  index: number;
  width: number;
  scrollX: SharedValue<number>;
}) {
  const { colors } = useTheme();

  const style = useAnimatedStyle(() => {
    const d = Math.abs(scrollX.value / width - index);
    return {
      width: interpolate(d, [0, 1], [22, 8], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(
        Math.min(d, 1),
        [0, 1],
        [colors.primary, colors.border],
      ),
    };
  });

  return <Animated.View style={[{ height: 8, borderRadius: radii.pill }, style]} />;
});
