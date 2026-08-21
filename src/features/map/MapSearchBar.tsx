import { memo, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, sizing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";

interface Props {
  /** Fired on the keyboard's search key, never per keystroke. */
  onSubmit: (query: string) => void;
  loading: boolean;
  style?: ViewStyle;
}

/**
 * Address search for a map. Submit-driven rather than as-you-type: every
 * keystroke would be a geocoder request, and Expo's docs are explicit that
 * geocoding is expensive and rate-limited.
 *
 * Holds its own text — nothing above it needs the half-typed query, and the
 * screens using it already carry enough state.
 */
export const MapSearchBar = memo(function MapSearchBar({
  onSubmit,
  loading,
  style,
}: Props) {
  const { colors, shadow } = useTheme();
  const t = useT();
  const [query, setQuery] = useState("");

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          height: sizing.controlMd,
          paddingHorizontal: spacing.md,
          borderRadius: radii.pill,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadow.card,
        },
        style,
      ]}
    >
      <Ionicons name="search" size={18} color={colors.textMuted} />

      <TextInput
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => onSubmit(query)}
        placeholder={t("map.searchPlaceholder")}
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={t("map.search")}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        // Submitting keeps the keyboard up on Android otherwise, hiding the
        // half of the map the camera just moved to.
        blurOnSubmit
        style={{
          flex: 1,
          ...type.body,
          color: colors.text,
          // Android's TextInput carries built-in padding that makes it taller
          // than the pill it sits in.
          padding: 0,
        }}
      />

      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : query ? (
        <Pressable
          onPress={() => setQuery("")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("common.clear")}
        >
          <Ionicons name="close-circle" size={18} color={colors.textFaint} />
        </Pressable>
      ) : null}
    </View>
  );
});
