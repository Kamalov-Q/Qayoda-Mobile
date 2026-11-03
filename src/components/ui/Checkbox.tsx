import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

/**
 * A checkbox with a label beside it.
 *
 * ── Why the whole row is the target and the box is not ─────────────────────
 *
 * The box is 22pt. Apple asks for 44 and Android for 48, and neither is a
 * suggestion on a control that gates signing in. So the Pressable wraps
 * everything and the box is just what it draws — the row is the target, and
 * it is as tall as its text.
 *
 * ── Why `children` rather than a `label` string ────────────────────────────
 *
 * The one place this is used has two links inside the sentence. A string
 * prop would have forced either three stacked components or a label that
 * renders markup, and both are worse than letting the caller pass the
 * sentence it wants.
 *
 * Links inside the row need `onStartShouldSetResponder` on their own text so
 * a tap on "oferta shartlari" opens the document instead of toggling the
 * box — see the caller.
 */
export function Checkbox({
  checked,
  onChange,
  children,
  accessibilityLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
  /** What the row says, flattened — the sentence has links in it. */
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        paddingVertical: spacing.xs,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: radii.sm,
          borderWidth: checked ? 0 : 1.5,
          borderColor: colors.border,
          backgroundColor: checked ? colors.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
          // The label's first line is ~20pt tall; 1pt down centres the box
          // against it rather than against the whole wrapped paragraph.
          marginTop: 1,
        }}
      >
        {checked ? (
          <Ionicons name="checkmark" size={15} color={colors.onPrimary} />
        ) : null}
      </View>

      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}
