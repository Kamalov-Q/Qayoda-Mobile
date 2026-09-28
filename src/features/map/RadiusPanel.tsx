import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import { Button } from "../../components/ui";
import { formatRadius } from "./maps";
import { RadiusSlider, type RadiusStep } from "./RadiusSlider";

interface Props {
  radiusM: RadiusStep;
  onChangeRadius: (value: RadiusStep) => void;
  /** Commit the draft: the filter takes effect and the panel closes. */
  onApply: () => void;
  /** Drop the filter entirely. */
  onClear: () => void;
  /** Leave the draft uncommitted — the X. */
  onCancel: () => void;
  /** Whether a radius is already applied, so Clear is worth offering. */
  applied: boolean;
  /** Room to leave under the panel for whatever else floats over the map. */
  bottomOffset: number;
}

/**
 * The card that floats over the map while the search circle is being set:
 * how far, and a reminder that the centre is draggable.
 *
 * Nothing is queried until Apply. A slider that refiltered on every step would
 * fire a request per stop and redraw the whole map under the thumb — and the
 * radius is one of the few filters people deliberately overshoot and come
 * back from.
 */
export const RadiusPanel = memo(function RadiusPanel({
  radiusM,
  onChangeRadius,
  onApply,
  onClear,
  onCancel,
  applied,
  bottomOffset,
}: Props) {
  const { colors, text, shadow } = useTheme();
  const t = useT();

  const value =
    radiusM == null
      ? t("map.radiusAll")
      : formatRadius(radiusM, t("map.metres"), t("map.kilometres"));

  return (
    <View
      style={{
        position: "absolute",
        left: spacing.md,
        right: spacing.md,
        bottom: spacing.md + bottomOffset,
        padding: spacing.lg,
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadow.raised,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          {/* "Shu radiusda: 1,5 km" — the label and the live value on one
              line, the value in the accent so the thumb has something to
              answer to. */}
          <Text style={text.caption} numberOfLines={1}>
            {t("map.radiusWithin")}
          </Text>
          <Text
            style={{ ...type.heading, fontSize: 20, color: colors.primary }}
            accessibilityLiveRegion="polite"
          >
            {value}
          </Text>
        </View>
        <Pressable
          onPress={onCancel}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("map.radiusClose")}
          style={({ pressed }) => ({
            width: 32,
            height: 32,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surfaceRaised : "transparent",
          })}
        >
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <RadiusSlider
        value={radiusM}
        onChange={onChangeRadius}
        label={`${t("map.radiusWithin")}: ${value}`}
      />

      <Text style={text.caption}>{t("map.radiusHint")}</Text>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {applied ? (
          <View style={{ flex: 1 }}>
            <Button
              title={t("map.radiusClear")}
              variant="secondary"
              size="sm"
              onPress={onClear}
            />
          </View>
        ) : null}
        <View style={{ flex: applied ? 1.4 : 1 }}>
          <Button title={t("map.radiusApply")} size="sm" onPress={onApply} />
        </View>
      </View>
    </View>
  );
});
