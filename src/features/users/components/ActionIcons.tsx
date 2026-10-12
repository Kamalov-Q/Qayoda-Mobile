import { memo } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";

export interface ActionIcon {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** For screen readers, and the only description the icon gets. */
  label: string;
  onPress: () => void;
  /** Red rather than brand — blocking, and anything else you undo rarely. */
  destructive?: boolean;
}

interface Props {
  actions: ActionIcon[];
  /**
   * Where it is drawn. `surface` is a profile; `overlay` is over a photo or
   * a video, where the only colours that survive are white and a scrim.
   */
  tone?: "surface" | "overlay";
  /** Diameter. Smaller in the story header, where the chrome is tight. */
  size?: number;
}

/**
 * A row of round icon buttons under a name.
 *
 * One component so that what you can do about a person looks the same
 * wherever you meet them — a profile, a story, a seller on a listing —
 * instead of each screen growing its own buttons with its own wording. The
 * caller decides which actions apply; this decides how they look.
 */
export const ActionIcons = memo(function ActionIcons({
  actions,
  tone = "surface",
  size = 46,
}: Props) {
  const { colors } = useTheme();
  const overlay = tone === "overlay";

  if (!actions.length) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        gap: spacing.sm,
      }}
    >
      {actions.map((action) => {
        const accent = action.destructive ? colors.danger : colors.primary;

        return (
          <Pressable
            key={action.key}
            onPress={action.onPress}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => ({
              width: size,
              height: size,
              borderRadius: radii.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: overlay
                ? pressed
                  ? "rgba(0,0,0,0.55)"
                  : "rgba(0,0,0,0.35)"
                : pressed
                  ? accent
                  : `${accent}1A`,
              borderWidth: overlay ? 1 : 0,
              borderColor: "rgba(255,255,255,0.45)",
            })}
          >
            {({ pressed }) => (
              <Ionicons
                name={action.icon}
                size={Math.round(size * 0.45)}
                // On a surface the icon carries the colour until it is
                // pressed, when the fill takes over and the icon has to
                // invert to stay readable.
                color={overlay ? "#FFFFFF" : pressed ? "#FFFFFF" : accent}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
});
