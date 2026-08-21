import { memo } from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { radii } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { resolveMediaUrl } from "../../lib/media-url";

interface Props {
  /** Full-size URL, thumb URL, or nothing — first non-null wins. */
  uri?: string | null;
  /** Falls back to initials, then to a person glyph. */
  name?: string | null;
  size?: number;
  /** Draws the green presence dot when true. Omit where presence is unknown. */
  online?: boolean;
}

/** At most two letters: three initials in a 40pt circle is a smudge. */
function initialsOf(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/**
 * One circular avatar for every place a person appears — inbox rows, the
 * thread header, their profile. The three used to draw their own circle, which
 * is why only one of them ever showed the photo.
 */
export const Avatar = memo(function Avatar({
  uri,
  name,
  size = 48,
  online,
}: Props) {
  const { colors } = useTheme();
  const source = resolveMediaUrl(uri);
  const initials = initialsOf(name);
  // The dot scales with the circle, but stops shrinking below a tappable-ish
  // 10pt or it reads as a rendering artefact.
  const dot = Math.max(10, Math.round(size * 0.27));

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.pill,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {source ? (
        <Image
          source={{ uri: source }}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: radii.pill,
          }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : initials ? (
        <Text
          style={{
            color: colors.onPrimary,
            fontWeight: "700",
            fontSize: Math.round(size * 0.38),
          }}
        >
          {initials}
        </Text>
      ) : (
        <Ionicons
          name="person"
          size={Math.round(size * 0.5)}
          color={colors.onPrimary}
        />
      )}

      {online ? (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: dot,
            height: dot,
            borderRadius: radii.pill,
            backgroundColor: colors.success,
            borderWidth: 2,
            borderColor: colors.bg,
          }}
        />
      ) : null}
    </View>
  );
});
