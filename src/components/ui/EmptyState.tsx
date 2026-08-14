import { memo } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { Button } from "./Button";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Tints the icon medallion red — used for load failures. */
  tone?: "neutral" | "danger";
}

/** Replaces the bare centred caption the lists used to show. An empty list and
 *  a failed request look different enough that the user can tell them apart. */
export const EmptyState = memo(function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  tone = "neutral",
}: Props) {
  const { colors, text } = useTheme();
  const accent = tone === "danger" ? colors.danger : colors.primary;
  const wash = tone === "danger" ? colors.dangerSurface : colors.primarySoft;

  return (
    <View
      style={{
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xxl,
      }}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: radii.pill,
          backgroundColor: wash,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={34} color={accent} />
      </View>

      <View style={{ gap: spacing.xs, alignItems: "center" }}>
        <Text style={{ ...text.heading, textAlign: "center" }}>{title}</Text>
        {description ? (
          <Text style={{ ...text.caption, textAlign: "center" }}>
            {description}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          variant="secondary"
          onPress={onAction}
          style={{ minWidth: 180 }}
        />
      ) : null}
    </View>
  );
});
