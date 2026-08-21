import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

interface Segment<T extends string> {
  value: T;
  label: string;
  /** Optional glyph before the label — the segment stays centred either way. */
  icon?: keyof typeof Ionicons.glyphMap;
}

type Size = "md" | "lg";

// "lg" is for a control that has to be found rather than merely used — a
// switch floating over content, where "md" reads as a caption.
const SIZES = {
  md: { track: 4, height: 40, font: 14, icon: 16 },
  lg: { track: 5, height: 46, font: 15, icon: 18 },
} as const satisfies Record<Size, Record<string, number>>;

/**
 * A real toggle, replacing the two side-by-side Buttons this used to be —
 * a filled button next to a ghost button reads as two competing CTAs rather
 * than one selected state.
 *
 * Only suitable for two or three SHORT labels: the track is divided evenly, so
 * anything longer truncates. Use ChipGroup for option sets with real words in
 * them.
 */
function SegmentedControlInner<T extends string>({
  segments,
  value,
  onChange,
  size = "md",
}: {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: Size;
}) {
  const { colors, shadow } = useTheme();
  const metrics = SIZES[size];

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surfaceRaised,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.border,
        padding: metrics.track,
        // Without this a label wider than its third of the track overflows the
        // rounded track instead of ellipsising inside it.
        overflow: "hidden",
      }}
    >
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <Pressable
            key={s.value}
            onPress={() => onChange(s.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              flexShrink: 1,
              minWidth: 0, // lets the label ellipsise rather than push the track wider
              height: metrics.height,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.xs,
              paddingHorizontal: 6,
              borderRadius: radii.pill,
              backgroundColor: active ? colors.primary : "transparent",
              ...(active ? shadow.control : null),
            }}
          >
            {s.icon ? (
              <Ionicons
                name={s.icon}
                size={metrics.icon}
                color={active ? colors.onPrimary : colors.textMuted}
              />
            ) : null}
            <Text
              style={{
                ...type.bodyStrong,
                fontSize: metrics.font,
                color: active ? colors.onPrimary : colors.textMuted,
              }}
              numberOfLines={1}
            >
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const SegmentedControl = memo(
  SegmentedControlInner,
) as typeof SegmentedControlInner;
