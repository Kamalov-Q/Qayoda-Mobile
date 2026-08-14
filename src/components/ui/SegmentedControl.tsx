import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { radii, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

interface Segment<T extends string> {
  value: T;
  label: string;
}

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
}: {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors, shadow } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surfaceRaised,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 4,
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
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 6,
              borderRadius: radii.pill,
              backgroundColor: active ? colors.primary : "transparent",
              ...(active ? shadow.control : null),
            }}
          >
            <Text
              style={{
                ...type.bodyStrong,
                fontSize: 14,
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
