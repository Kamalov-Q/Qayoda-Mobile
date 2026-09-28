import { memo } from "react";
import { Text, View } from "react-native";
import { spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import { formatRadius } from "./maps";
import { RadiusSlider, type RadiusStep } from "./RadiusSlider";

interface Props {
  value: RadiusStep;
  onChange: (value: RadiusStep) => void;
  /** Whether a circle already exists, which decides what the hint says. */
  hasCenter: boolean;
}

/**
 * The radius as a row inside the funnel sheet, beside price and address.
 *
 * The map has its own panel for this — with a draggable centre — but the
 * sheet is where people go looking for filters, and one that only existed on
 * the map still counted towards the badge on the funnel button. A filter you
 * can see the effect of but cannot find is worse than one that is missing.
 *
 * The distance is all that is set here. Where the circle sits is a thing you
 * point at, not a thing you type, so the centre stays on the map — this
 * starts it at whatever the camera is looking at and says so.
 */
export const RadiusFilterRow = memo(function RadiusFilterRow({
  value,
  onChange,
  hasCenter,
}: Props) {
  const { colors, text } = useTheme();
  const t = useT();

  const label =
    value == null
      ? t("map.radiusAll")
      : formatRadius(value, t("map.metres"), t("map.kilometres"));

  return (
    <View style={{ gap: spacing.sm }}>
      <Text
        style={{
          ...type.heading,
          color: value == null ? colors.text : colors.primary,
        }}
        accessibilityLiveRegion="polite"
      >
        {label}
      </Text>

      <RadiusSlider
        value={value}
        onChange={onChange}
        label={`${t("map.radiusWithin")}: ${label}`}
      />

      <Text style={text.caption}>
        {hasCenter ? t("map.radiusHint") : t("map.radiusFromHere")}
      </Text>
    </View>
  );
});
