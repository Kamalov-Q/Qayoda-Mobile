import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, weight } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { useAuthorVideos } from "../hooks/useVideoFeed";

/** Three across, like every reels grid, with a 9:16 cell. */
const COLUMNS = 3;

/**
 * Somebody's reels on their profile.
 *
 * Posters in a grid and no players at all: a profile is a page people scan,
 * and three autoplaying videos on it is three decoders for content nobody has
 * chosen yet. Tapping opens the reel full-screen.
 *
 * Renders nothing when there are none — an empty grid under a heading reads
 * as a feature that is broken rather than one the person has not used.
 */
export function AuthorVideosGrid({ userId }: { userId: string }) {
  const { colors, text } = useTheme();
  const t = useT();
  const { items } = useAuthorVideos(userId);

  if (!items.length) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={text.heading}>{t("videos.title")}</Text>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.xs,
        }}
      >
        {items.map((video) => (
          <Pressable
            key={video.id}
            onPress={() => router.push(`/videos/${video.id}`)}
            accessibilityRole="button"
            accessibilityLabel={video.caption ?? t("videos.title")}
            style={({ pressed }) => ({
              // Thirds of the row, minus the two gaps between them. Expressed
              // as a percentage so it follows whatever width the profile
              // screen's padding leaves.
              width: `${100 / COLUMNS}%`,
              flexBasis: `${100 / COLUMNS}%`,
              flexGrow: 0,
              flexShrink: 1,
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
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="videocam-outline"
                  size={18}
                  color={colors.textFaint}
                />
              </View>
            )}

            <View
              style={{
                position: "absolute",
                left: 5,
                bottom: 5,
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
              }}
              pointerEvents="none"
            >
              <Ionicons name="play" size={10} color="rgba(255,255,255,0.92)" />
              <Text
                style={{
                  ...text.caption,
                  fontSize: 10,
                  ...weight("600"),
                  color: "#FFFFFF",
                }}
              >
                {video.viewCount}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
