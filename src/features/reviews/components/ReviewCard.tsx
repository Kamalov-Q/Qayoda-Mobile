// One review: who, how many stars, when, and what they said. The reader's own
// review carries its edit and delete actions here rather than in a menu — it
// is one row among a handful, and hiding them costs a tap for no gain.
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/src/components/ui";
import { spacing, radii } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT, useLanguage } from "@/src/i18n";
import { Stars } from "./Stars";
import type { Review } from "../api/reviews.api";

interface Props {
  review: Review;
  /** True for the signed-in reader's own review. */
  own?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ReviewCard({ review, own, onEdit, onDelete }: Props) {
  const { colors, text } = useTheme();
  const language = useLanguage();
  const t = useT();

  const name =
    [review.author?.name, review.author?.surname].filter(Boolean).join(" ") ||
    t("chat.unknownUser");

  // An edited review says so: the date otherwise implies the text is as old
  // as the rating, which after an edit it is not.
  const edited = review.updatedAt !== review.createdAt;
  const stamp = new Date(edited ? review.updatedAt : review.createdAt);

  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: own ? colors.primaryBorder : colors.border,
        backgroundColor: own ? colors.primarySoft : colors.surface,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Avatar uri={review.author?.avatarThumbUrl} name={name} size={36} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={text.bodyStrong} numberOfLines={1}>
            {own ? t("reviews.you") : name}
          </Text>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
          >
            <Stars value={review.rating} size={13} />
            <Text style={text.caption}>
              {stamp.toLocaleDateString(language, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
              {edited ? ` · ${t("reviews.edited")}` : ""}
            </Text>
          </View>
        </View>
      </View>

      {review.comment ? (
        <Text style={text.body}>{review.comment}</Text>
      ) : null}

      {own ? (
        <View style={{ flexDirection: "row", gap: spacing.lg }}>
          <RowAction icon="create-outline" label={t("common.edit")} onPress={onEdit} />
          <RowAction
            icon="trash-outline"
            label={t("common.delete")}
            tone={colors.danger}
            onPress={onDelete}
          />
        </View>
      ) : null}
    </View>
  );
}

function RowAction({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: string;
  onPress?: () => void;
}) {
  const { colors, text } = useTheme();
  const color = tone ?? colors.primary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={15} color={color} />
      <Text style={{ ...text.caption, color, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
