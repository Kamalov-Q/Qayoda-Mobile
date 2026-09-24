// "How was it?" — the stars, an optional few words, one button. Same host
// pattern as ReportSheet and SelectSheet: kept mounted and driven by
// `visible`, so iOS never races a dismissal.
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/src/components/ui";
import { spacing, radii } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT, type TranslationKey } from "@/src/i18n";
import { StarPicker } from "./StarPicker";
import { REVIEW_MAX_LENGTH, type Review } from "../api/reviews.api";
import { useSubmitReview } from "../hooks/useReviews";

/** What each rating means, indexed by star - 1. Spelled out rather than
 *  built by interpolation so the keys stay greppable and type-checked. */
const SCALE_KEYS: readonly TranslationKey[] = [
  "reviews.scale1",
  "reviews.scale2",
  "reviews.scale3",
  "reviews.scale4",
  "reviews.scale5",
];

interface Props {
  listingId: string;
  visible: boolean;
  onClose: () => void;
  /** The reader's existing review — opens the sheet as an edit when present. */
  existing?: Review | null;
}

export function ReviewSheet({ listingId, visible, onClose, existing }: Props) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: colors.overlay,
        }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          style={{ position: "absolute", inset: 0 }}
          accessibilityElementsHidden
          importantForAccessibility="no"
          onPress={onClose}
        />

        {/* Remounted on every open, and whenever the saved review changes.
            That is what seeds the fields — the sheet stays mounted between
            opens, and an effect writing state on `visible` would both cascade
            a render and risk showing a review that has since been withdrawn. */}
        <ReviewForm
          key={
            visible
              ? `${existing?.id ?? "new"}:${existing?.updatedAt ?? ""}`
              : "closed"
          }
          listingId={listingId}
          existing={existing ?? null}
          onDone={onClose}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ReviewForm({
  listingId,
  existing,
  onDone,
}: {
  listingId: string;
  existing: Review | null;
  onDone: () => void;
}) {
  const { colors, text, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const submit = useSubmitReview(listingId);

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");

  const onSubmit = () =>
    submit.mutate(
      { rating, comment: comment.trim() || undefined, isEdit: !!existing },
      { onSuccess: onDone },
    );

  return (
    <View
      accessibilityViewIsModal
      style={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: radii.xxl,
        borderTopRightRadius: radii.xxl,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: insets.bottom + spacing.md,
        gap: spacing.md,
        ...shadow.card,
      }}
    >
      <View style={{ gap: 2 }}>
        <Text style={text.heading}>
          {t(existing ? "reviews.editTitle" : "reviews.writeTitle")}
        </Text>
        <Text style={text.caption}>{t("reviews.writeSubtitle")}</Text>
      </View>

      <StarPicker
        value={rating}
        onChange={setRating}
        disabled={submit.isPending}
      />

      {/* The chosen rating in words: five taps all look alike at a glance,
          and this is the confirmation that the right one landed. */}
      <Text
        style={{
          ...text.bodyStrong,
          textAlign: "center",
          color: rating ? colors.text : colors.textFaint,
        }}
      >
        {rating ? t(SCALE_KEYS[rating - 1]) : t("reviews.tapToRate")}
      </Text>

      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder={t("reviews.commentPlaceholder")}
        placeholderTextColor={colors.textFaint}
        multiline
        maxLength={REVIEW_MAX_LENGTH}
        editable={!submit.isPending}
        style={{
          ...text.body,
          minHeight: 96,
          textAlignVertical: "top",
          padding: spacing.md,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceRaised,
          color: colors.text,
        }}
      />

      <Button
        title={t(existing ? "reviews.saveEdit" : "reviews.submit")}
        onPress={onSubmit}
        disabled={rating < 1}
        loading={submit.isPending}
      />
    </View>
  );
}
