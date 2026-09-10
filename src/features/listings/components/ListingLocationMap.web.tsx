// Web fallback: react-native-maps has no web renderer, so the detail page
// shows the address card alone. The native apps get the real boundary map.
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

interface Props {
  coordinates: [number, number][][] | null | undefined;
  centroid?: [number, number] | null;
  address?: string | null;
}

export function ListingLocationMap({ coordinates, centroid, address }: Props) {
  const { colors, text } = useTheme();
  if (!coordinates?.[0]?.length && !centroid && !address) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Ionicons name="location" size={16} color={colors.primary} />
      <Text style={{ ...text.caption, flex: 1 }} numberOfLines={2}>
        {address ?? "—"}
      </Text>
    </View>
  );
}
