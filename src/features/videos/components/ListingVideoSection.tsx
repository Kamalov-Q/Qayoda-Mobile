import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, weight } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { requirePhone } from "@/src/features/auth/guest";
import { useListingVideos } from "../hooks/useVideoFeed";

/** Poster size. Portrait 9:16, because that is what the clips are shot in. */
const CARD_W = 112;
const CARD_H = 160;

/**
 * The film of this flat, on the listing page.
 *
 * Posters rather than a player: a listing page is already carrying a photo
 * carousel and a map, and a second video decoder on it would be the thing
 * that makes the screen stutter on a mid-range phone. Tapping opens the reel
 * full-screen, where exactly one player runs.
 *
 * With nothing to show, the section disappears — except for the owner, who
 * instead gets the offer to film it. A video is the single most persuasive
 * thing a seller can add to an advert, and this is the one place where they
 * are already thinking about this particular flat.
 */
export function ListingVideoSection({
  listingId,
  isOwner,
}: {
  listingId: string;
  isOwner?: boolean;
}) {
  const { colors, text } = useTheme();
  const t = useT();
  const { items, isLoading } = useListingVideos(listingId);

  if (isLoading) return null;

  if (!items.length) {
    if (!isOwner) return null;

    return (
      <View style={{ gap: spacing.sm }}>
        <Text style={text.heading}>{t("videos.listingVideo")}</Text>
        <Pressable
          onPress={() =>
            requirePhone(() =>
              router.push({
                pathname: "/videos/new",
                params: { listingId },
              }),
            )
          }
          accessibilityRole="button"
          accessibilityLabel={t("videos.add")}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: colors.border,
            backgroundColor: colors.surfaceRaised,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="videocam-outline" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...text.body, ...weight("600") }}>
              {t("videos.add")}
            </Text>
            <Text style={{ ...text.caption, color: colors.textFaint }}>
              {t("videos.linkListingHint")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={text.heading}>{t("videos.listingVideo")}</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {items.map((video) => (
          <Pressable
            key={video.id}
            onPress={() => router.push(`/videos/${video.id}`)}
            accessibilityRole="button"
            accessibilityLabel={video.caption ?? t("videos.listingVideo")}
            style={({ pressed }) => ({
              width: CARD_W,
              height: CARD_H,
              borderRadius: radii.lg,
              overflow: "hidden",
              backgroundColor: "#000000",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            {video.thumbUrl ? (
              <Image
                source={{ uri: video.thumbUrl }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : null}

            {/* The play glyph is the whole affordance: a still of a room is
                indistinguishable from the photos above it without one. */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
              pointerEvents="none"
            >
              <Ionicons
                name="play-circle"
                size={34}
                color="rgba(255,255,255,0.92)"
              />
            </View>

            <View
              style={{
                position: "absolute",
                left: 6,
                bottom: 6,
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
              }}
              pointerEvents="none"
            >
              <Ionicons name="eye" size={11} color="rgba(255,255,255,0.9)" />
              <Text
                style={{
                  ...text.caption,
                  fontSize: 11,
                  ...weight("600"),
                  color: "#FFFFFF",
                }}
              >
                {video.viewCount}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
