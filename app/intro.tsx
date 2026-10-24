// app/intro.tsx — the first-launch story, told once. Four swipes: the brand,
// then what makes this app different, then straight into browsing. The flag
// persists, so a returning user never sees it again.
//
// Skippable, deliberately. It used to insist on all four screens "the way
// banking apps do it", which is a cost paid by exactly the people least
// willing to pay it: someone who already knows what they came to do. Skip
// marks the intro seen, so it is a choice made once, not a nag.
import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import Animated, { ZoomIn } from "react-native-reanimated";
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
} & (
  | { icon: keyof typeof Ionicons.glyphMap; hero?: never }
  | { hero: number; icon?: never }
);

const SLIDES: Slide[] = [
  { hero: HERO, titleKey: "intro.welcomeTitle", textKey: "intro.welcomeText" },
  { icon: "map-outline", titleKey: "intro.s1Title", textKey: "intro.s1Text" },
  {
    icon: "create-outline",
    titleKey: "intro.s2Title",
    textKey: "intro.s2Text",
  },
  {
    icon: "chatbubbles-outline",
    titleKey: "intro.s3Title",
    textKey: "intro.s3Text",
  },
];

export default function IntroScreen() {
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);
  const { width, height } = useWindowDimensions();
  // Square poster, as large as fits: never wider than the slide's padded
  // width, and capped by height so the title and text still fit on a small
  // phone (iPhone SE) under the header and above the button.
  const heroSize = Math.min(width - spacing.xl * 2, height * 0.42);
  const { colors, text } = useTheme();
  const setIntroSeen = usePreferences((s) => s.setIntroSeen);
  const t = useT();

  const last = page === SLIDES.length - 1;

  /**
   * Which slide is showing, from the scroll offset rather than from
   * onViewableItemsChanged.
   *
   * Viewability is driven by the cell measurements VirtualizedList collects
   * from onLayout, and on react-native-web those are unreliable enough that
   * the callback can simply never fire — leaving `page` pinned at 0, the
   * dots frozen on the first slide, and the button below re-targeting slide
   * 1 on every press. An offset divided by the viewport width is the same
   * answer with nothing to measure.
   *
   * layoutMeasurement rather than the `width` from useWindowDimensions: it is
   * the list's own width, so this stays correct if the list ever stops being
   * full-bleed, and it keeps the callback free of render-scoped deps.
   */
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const viewport = e.nativeEvent.layoutMeasurement.width;
    if (!viewport) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / viewport);
    setPage((current) => (current === next ? current : next));
  }, []);

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

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.titleKey}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        // Fixed-width slides, so the list never has to measure a cell to know
        // where it starts — which is what made paging fragile on web.
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item }) => (
          <View
            style={{
              width,
              alignItems: "center",
              justifyContent: "center",
              padding: spacing.xl,
              gap: spacing.lg,
            }}
          >
            {item.hero ? (
              // The first thing a new user sees — it settles in rather than
              // snapping on.
              <Animated.View entering={ZoomIn.duration(500)}>
                <Image
                  source={item.hero}
                  accessibilityLabel="Growen City"
                  style={{
                    width: heroSize,
                    height: heroSize,
                    borderRadius: radii.xl,
                  }}
                  contentFit="cover"
                />
              </Animated.View>
            ) : (
              <View
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: radii.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primarySoft,
                  borderWidth: 1,
                  borderColor: colors.primaryBorder,
                }}
              >
                <Ionicons name={item.icon} size={52} color={colors.primary} />
              </View>
            )}
            <Text style={{ ...text.display, textAlign: "center" }}>
              {t(item.titleKey)}
            </Text>
            <Text
              style={{
                ...text.body,
                color: colors.textMuted,
                textAlign: "center",
              }}
            >
              {t(item.textKey)}
            </Text>
          </View>
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
          {/* The active dot stretches and recolours as the page changes (a
              CSS transition), so the indicator travels with the swipe
              instead of jumping. */}
          {SLIDES.map((s, i) => (
            <Animated.View
              key={s.titleKey}
              style={{
                width: i === page ? 22 : 8,
                height: 8,
                borderRadius: radii.pill,
                backgroundColor: i === page ? colors.primary : colors.border,
                transitionProperty: ["width", "backgroundColor"],
                transitionDuration: 250,
                transitionTimingFunction: "ease-out",
              }}
            />
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
