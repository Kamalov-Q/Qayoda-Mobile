// app/intro.tsx — the first-launch story, told once. Four swipes: what makes
// this app different, then straight into browsing. The flag persists, so a
// returning user never sees it again; there is deliberately no skip — four
// screens is the whole cost, the way banking apps do it.
import { useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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

const SLIDES: {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: TranslationKey;
  textKey: TranslationKey;
}[] = [
  { icon: "map-outline", titleKey: "intro.s1Title", textKey: "intro.s1Text" },
  { icon: "create-outline", titleKey: "intro.s2Title", textKey: "intro.s2Text" },
  {
    icon: "chatbubbles-outline",
    titleKey: "intro.s3Title",
    textKey: "intro.s3Text",
  },
  { icon: "options-outline", titleKey: "intro.s4Title", textKey: "intro.s4Text" },
];

export default function IntroScreen() {
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);
  const { width } = useWindowDimensions();
  const { colors, text } = useTheme();
  const setIntroSeen = usePreferences((s) => s.setIntroSeen);
  const t = useT();

  const last = page === SLIDES.length - 1;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) setPage(first.index);
    },
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
        onViewableItemsChanged={onViewableItemsChanged.current}
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
          {SLIDES.map((s, i) => (
            <View
              key={s.titleKey}
              style={{
                width: i === page ? 22 : 8,
                height: 8,
                borderRadius: radii.pill,
                backgroundColor: i === page ? colors.primary : colors.border,
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
