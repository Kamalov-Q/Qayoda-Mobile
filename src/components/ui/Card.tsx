import { memo, type ReactNode } from "react";
import { View, Text, type ViewStyle } from "react-native";
import { spacing, radii } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

interface Props {
  children: ReactNode;
  /** Optional section heading rendered above the card, outside its border. */
  title?: string;
  /** Drop the inner padding — for cards whose children run edge to edge. */
  flush?: boolean;
  style?: ViewStyle;
}

/** The standard surface container: one border radius and one elevation for
 *  every grouped block in the app, so cards stop drifting apart per screen. */
export const Card = memo(function Card({ children, title, flush, style }: Props) {
  const { colors, text, shadow } = useTheme();

  const card = (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radii.xl,
          borderWidth: 1,
          borderColor: colors.border,
          padding: flush ? 0 : spacing.md,
          overflow: "hidden",
          ...shadow.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!title) return card;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ ...text.label, marginLeft: spacing.xs }}>{title}</Text>
      {card}
    </View>
  );
});

/** Section wrapper for form and settings groups: a label plus its content,
 *  with the vertical rhythm set in one place instead of per screen. */
export const Section = memo(function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { text } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ ...text.label, marginLeft: spacing.xs }}>{title}</Text>
      {children}
    </View>
  );
});
