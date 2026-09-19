// app/intro.tsx — the first-launch story, told once. Four swipes: the brand,
// then what makes this app different, then straight into browsing. The flag persists, so a
// returning user never sees it again; there is deliberately no skip — four
// screens is the whole cost, the way banking apps do it.
import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  useWindowDimensions,
  type ViewToken,
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

  // FlatList throws if this callback changes identity between renders, so it
  // must be created once. useCallback with no deps does that without reading
  // a ref during render (which makes the React Compiler skip the screen).
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) setPage(first.index);
    },
    [],
  );

  const advance = () => {
    if (last) {
      setIntroSeen();
      router.replace("/(tabs)/home");
      return;
    }
    listRef.current?.scrollToIndex({ index: page + 1, animated: true });
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
        {/* The very first screen is exactly where the language choice
            belongs — everything after it reads in the right one. */}
        <LanguageSwitcher />
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.titleKey}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
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
