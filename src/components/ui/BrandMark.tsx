import { memo } from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../theme/useTheme";

/**
 * Placeholder wordmark tile — swap the Text for an <Image> once there's a
 * real logo asset. Sized to read as a brand anchor above the auth headline.
 */
export const BrandMark = memo(function BrandMark({
  size = 56,
}: {
  size?: number;
}) {
  const { colors, shadow } = useTheme();

  return (
    <View
      style={{
        width: size,
        height: size,
        // Squircle rather than the old rounded square: closer to the corner
        // curvature of a real app icon at this size.
        borderRadius: size * 0.32,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        ...shadow.control,
      }}
    >
      <Text
        style={{
          color: colors.onPrimary,
          fontSize: size * 0.46,
          fontWeight: "800",
          letterSpacing: -1,
        }}
      >
        Q
      </Text>
    </View>
  );
});
