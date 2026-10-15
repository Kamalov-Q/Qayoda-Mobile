import { memo, useMemo } from "react";
import { Linking, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import {
  SOCIAL_COLORS,
  SOCIAL_ICONS,
  SOCIAL_PLATFORMS,
  socialUrl,
  type SocialLinks,
} from "../lib/social";

interface Props {
  links: SocialLinks | null | undefined;
  size?: number;
}

/**
 * The accounts someone advertises, as a row of their own icons.
 *
 * Platform colours rather than the app's green: these are other people's
 * marks and they are recognised by colour before shape. Renders nothing at
 * all when there is nothing to show — an empty band of grey circles says
 * less than no band.
 */
export const SocialRow = memo(function SocialRow({ links, size = 40 }: Props) {
  const { colors } = useTheme();

  // Fixed order, not object order: whatever the server happens to return
  // first should not reshuffle somebody's profile between loads.
  const shown = useMemo(
    () =>
      SOCIAL_PLATFORMS.flatMap((platform) => {
        const value = links?.[platform];
        if (!value) return [];
        const url = socialUrl(platform, value);
        return url ? [{ platform, url }] : [];
      }),
    [links],
  );

  if (!shown.length) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: spacing.sm,
      }}
    >
      {shown.map(({ platform, url }) => (
        <Pressable
          key={platform}
          // Swallowed: a handle that resolves to nothing openable should not
          // take the screen down with it.
          onPress={() => void Linking.openURL(url).catch(() => {})}
          accessibilityRole="link"
          accessibilityLabel={platform}
          style={({ pressed }) => ({
            width: size,
            height: size,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
          })}
        >
          <Ionicons
            name={SOCIAL_ICONS[platform]}
            size={Math.round(size * 0.52)}
            // Black marks (TikTok, X, Threads) would vanish on a dark
            // surface, so those follow the text colour instead.
            color={
              SOCIAL_COLORS[platform] === "#000000"
                ? colors.text
                : SOCIAL_COLORS[platform]
            }
          />
        </Pressable>
      ))}
    </View>
  );
});
