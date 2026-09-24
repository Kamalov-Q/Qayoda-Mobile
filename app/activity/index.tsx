// "Your activity" — the hub. One row per thing you have left behind in the
// app, in the order you are most likely to want them back.
import { View, Text, Pressable } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, HEADER_EDGES } from "../../src/components/ui";
import { spacing, radii } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT, type TranslationKey } from "../../src/i18n";
import { useListingCounts } from "../../src/features/listings/hooks/useMyListings";

interface Row {
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
  href: Href;
  /** Rendered on the right, when the count is already known for free. */
  count?: number;
}

export default function ActivityScreen() {
  const { colors, text } = useTheme();
  const t = useT();
  // Saved is the one count the app already keeps; the others would each cost
  // a request to show a number nobody navigates by.
  const counts = useListingCounts();

  const rows: Row[] = [
    {
      icon: "bookmark-outline",
      labelKey: "activity.saved",
      hintKey: "activity.savedHint",
      href: "/(tabs)/saved",
      count: counts.data?.saved,
    },
    {
      icon: "heart-outline",
      labelKey: "activity.likes",
      hintKey: "activity.likesHint",
      href: "/activity/likes",
    },
    {
      icon: "chatbubble-outline",
      labelKey: "activity.comments",
      hintKey: "activity.commentsHint",
      href: "/activity/comments",
    },
    {
      icon: "star-outline",
      labelKey: "activity.reviews",
      hintKey: "activity.reviewsHint",
      href: "/activity/reviews",
    },
  ];

  return (
    <Screen edges={HEADER_EDGES}>
      <View style={{ gap: spacing.md, paddingVertical: spacing.md }}>
        <Text style={text.caption}>{t("activity.intro")}</Text>

        <View style={{ gap: spacing.sm }}>
          {rows.map((row) => (
            <Pressable
              key={String(row.href)}
              onPress={() => router.push(row.href)}
              accessibilityRole="button"
              accessibilityLabel={t(row.labelKey)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed
                  ? colors.surfaceRaised
                  : colors.surface,
              })}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: radii.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primarySoft,
                }}
              >
                <Ionicons name={row.icon} size={19} color={colors.primary} />
              </View>

              <View style={{ flex: 1, gap: 2 }}>
                <Text style={text.bodyStrong}>{t(row.labelKey)}</Text>
                <Text style={text.caption}>{t(row.hintKey)}</Text>
              </View>

              {row.count ? (
                <Text style={{ ...text.caption, color: colors.textMuted }}>
                  {row.count}
                </Text>
              ) : null}
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textFaint}
              />
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}
