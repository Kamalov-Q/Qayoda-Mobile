// app/(tabs)/home.tsx
// Landing tab. The app used to open straight onto the Sotuv map — a screen
// that assumes you already know what the app is. This one says hello, points
// the two main journeys (browse, post), and carries the promo swiper. Promo
// copy is dummy until real campaigns exist.
import { useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  Pressable,
  FlatList,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Button,
  Card,
  Section,
  BrandMark,
  TAB_EDGES,
} from "../../src/components/ui";
import { spacing, radii, type } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT, type TranslationKey } from "../../src/i18n";
import { useAuthStore } from "../../src/features/auth/store/auth.store";

const ACTIONS = [
  {
    key: "browse",
    labelKey: "home.actionBrowse" as TranslationKey,
    icon: "map-outline",
    href: "/(tabs)/sotuv",
  },
  {
    key: "add",
    labelKey: "home.actionAdd" as TranslationKey,
    icon: "add-circle-outline",
    href: "/add",
  },
  {
    key: "saved",
    labelKey: "home.actionSaved" as TranslationKey,
    icon: "heart-outline",
    href: "/(tabs)/saved",
  },
] as const;

const ADS = [
  {
    key: "ad1",
    titleKey: "home.ad1Title" as TranslationKey,
    textKey: "home.ad1Text" as TranslationKey,
    icon: "gift-outline",
    tone: "primary",
  },
  {
    key: "ad2",
    titleKey: "home.ad2Title" as TranslationKey,
    textKey: "home.ad2Text" as TranslationKey,
    icon: "analytics-outline",
    tone: "success",
  },
  {
    key: "ad3",
    titleKey: "home.ad3Title" as TranslationKey,
    textKey: "home.ad3Text" as TranslationKey,
    icon: "call-outline",
    tone: "primary",
  },
] as const;

type Ad = (typeof ADS)[number];

/** ms a banner stays before the swiper advances on its own. */
const AD_ROTATE_MS = 5000;

const STEPS = [
  "home.step1",
  "home.step2",
  "home.step3",
] as const satisfies readonly TranslationKey[];

export default function HomeScreen() {
  const { colors, text } = useTheme();
  const t = useT();
  const name = useAuthStore((s) => s.user?.name);

  return (
    <Screen style={{ padding: 0 }} edges={TAB_EDGES}>
      <View
        style={{
          padding: spacing.lg,
          paddingTop: spacing.md,
          gap: spacing.xl,
        }}
      >
        {/* Greeting */}
        <View style={{ gap: spacing.sm }}>
          <BrandMark />
          <View style={{ gap: 2 }}>
            <Text style={text.display}>
              {name ? t("home.greetingName", { name }) : t("home.greeting")}
            </Text>
            <Text style={text.caption}>{t("home.tagline")}</Text>
          </View>
        </View>

        {/* Hero — the one thing a first-time user should do */}
        <Card
          style={{
            backgroundColor: colors.primarySoft,
            borderColor: colors.primaryBorder,
          }}
        >
          <View style={{ gap: spacing.md }}>
            <Ionicons name="location" size={28} color={colors.primary} />
            <View style={{ gap: spacing.xs }}>
              <Text style={text.heading}>{t("home.heroTitle")}</Text>
              <Text style={{ ...text.body, color: colors.textMuted }}>
                {t("home.heroSubtitle")}
              </Text>
            </View>
            <Button
              title={t("home.heroCta")}
              icon="map-outline"
              onPress={() => router.push("/(tabs)/sotuv")}
            />
          </View>
        </Card>

        {/* Quick actions */}
        <Section title={t("home.quickTitle")}>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {ACTIONS.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => router.push(action.href)}
                accessibilityRole="button"
                accessibilityLabel={t(action.labelKey)}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 86,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.xs,
                  padding: spacing.sm,
                  borderRadius: radii.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed
                    ? colors.surfaceRaised
                    : colors.surface,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <Ionicons
                  name={action.icon}
                  size={22}
                  color={colors.primary}
                />
                <Text
                  style={{ ...type.caption, color: colors.text, textAlign: "center" }}
                  numberOfLines={2}
                >
                  {t(action.labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* Promo swiper — one full-width banner at a time, auto-rotating */}
        <Section title={t("home.adsTitle")}>
          <PromoSwiper ads={ADS} />
        </Section>

        {/* How it works */}
        <Section title={t("home.howTitle")}>
          <Card flush>
            {STEPS.map((step, index) => (
              <View
                key={step}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.md,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radii.pill,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.primarySoft,
                    borderWidth: 1,
                    borderColor: colors.primaryBorder,
                  }}
                >
                  <Text style={{ ...type.caption, fontWeight: "700", color: colors.primary }}>
                    {index + 1}
                  </Text>
                </View>
                <Text style={{ ...text.body, flex: 1 }}>{t(step)}</Text>
              </View>
            ))}
          </Card>
        </Section>
      </View>
    </Screen>
  );
}

/**
 * Paged banner swiper: one card fills the row, snaps per card, auto-advances
 * every AD_ROTATE_MS and pauses while the user's finger is down. Dots carry
 * the position. No carousel library — FlatList paging covers all of it.
 */
function PromoSwiper({ ads }: { ads: readonly Ad[] }) {
  const { width } = useWindowDimensions();
  const { colors, text } = useTheme();
  const t = useT();

  const listRef = useRef<FlatList<Ad>>(null);
  const [index, setIndex] = useState(0);
  const interacting = useRef(false);

  // Screen width minus the page padding — the next card peeks in the gap.
  const cardWidth = width - spacing.lg * 2;
  const snap = cardWidth + spacing.sm;

  useEffect(() => {
    if (ads.length < 2) return;
    const timer = setInterval(() => {
      if (interacting.current) return;
      setIndex((current) => {
        const next = (current + 1) % ads.length;
        listRef.current?.scrollToOffset({
          offset: next * snap,
          animated: true,
        });
        return next;
      });
    }, AD_ROTATE_MS);
    return () => clearInterval(timer);
  }, [ads.length, snap]);

  const washes = {
    primary: {
      background: colors.primarySoft,
      border: colors.primaryBorder,
      accent: colors.primary,
    },
    success: {
      background: colors.successSurface,
      border: colors.successBorder,
      accent: colors.success,
    },
  } as const;

  return (
    <View style={{ gap: spacing.sm }}>
      <FlatList
        ref={listRef}
        data={ads}
        keyExtractor={(ad) => ad.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        // Snaps to card+gap rather than pagingEnabled, which assumes pages
        // exactly as wide as the viewport and drifts with the side padding.
        snapToInterval={snap}
        decelerationRate="fast"
        // Bleeds to the screen edges while the first card stays aligned with
        // the rest of the content.
        style={{ marginHorizontal: -spacing.lg }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          gap: spacing.sm,
        }}
        getItemLayout={(_, i) => ({
          length: snap,
          offset: snap * i,
          index: i,
        })}
        onScrollBeginDrag={() => {
          interacting.current = true;
        }}
        onMomentumScrollEnd={(e) => {
          interacting.current = false;
          const page = Math.round(e.nativeEvent.contentOffset.x / snap);
          setIndex(Math.min(ads.length - 1, Math.max(0, page)));
        }}
        renderItem={({ item: ad }) => {
          const wash = washes[ad.tone];
          return (
            <Pressable
              onPress={() => router.push("/(tabs)/sotuv")}
              accessibilityRole="button"
              accessibilityLabel={t(ad.titleKey)}
              style={({ pressed }) => ({
                width: cardWidth,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radii.xl,
                borderWidth: 1,
                borderColor: wash.border,
                backgroundColor: wash.background,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              })}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: radii.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: wash.border,
                }}
              >
                <Ionicons name={ad.icon} size={22} color={wash.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={text.bodyStrong}>{t(ad.titleKey)}</Text>
                <Text
                  style={{ ...type.caption, color: colors.textMuted }}
                  numberOfLines={3}
                >
                  {t(ad.textKey)}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textFaint}
              />
            </Pressable>
          );
        }}
      />

      {/* Position dots — the active one stretches, the rest stay small. */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: spacing.xs,
        }}
      >
        {ads.map((ad, i) => (
          <View
            key={ad.key}
            style={{
              width: i === index ? 18 : 6,
              height: 6,
              borderRadius: radii.pill,
              backgroundColor: i === index ? colors.primary : colors.borderStrong,
            }}
          />
        ))}
      </View>
    </View>
  );
}
