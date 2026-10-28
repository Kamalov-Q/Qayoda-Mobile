import { memo, type ReactNode } from "react";
import { View, Text, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, type } from "../../theme/tokens";
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
  required,
  error,
  children,
}: {
  title: string;
  /**
   * Red asterisk on the heading, exactly as TextField marks its own label.
   *
   * Not every required answer on a form is typed into a field. A tile grid
   * or a picker sheet has a Section heading and nothing else, so without
   * this the required ones looked optional.
   */
  required?: boolean;
  /**
   * Validation message under the group.
   *
   * Same reason: a SelectGrid has no label, no border and no error line of
   * its own, so a rule it failed had nowhere to say so and the form simply
   * refused to continue without explaining why.
   */
  error?: string;
  children: ReactNode;
}) {
  const { text, colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ ...text.label, marginLeft: spacing.xs }}>
        {title}
        {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
      </Text>
      {children}
      {error ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            marginLeft: spacing.xs,
          }}
        >
          <Ionicons name="alert-circle" size={14} color={colors.danger} />
          <Text style={{ ...type.caption, color: colors.danger, flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
});
