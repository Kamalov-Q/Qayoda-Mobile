// app/listing/[id]/edit-images.tsx
// The route pushed from the detail screen is `/listing/[id]/edit-images`; this
// file used to be named `edit-image.tsx`, so that push landed on nothing.
import { Text, View, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  Screen,
  Button,
  EmptyState,
  HEADER_EDGES,
} from "../../../src/components/ui";
import { spacing } from "../../../src/theme/tokens";
import { useTheme } from "../../../src/theme/useTheme";
import { useT } from "../../../src/i18n";
import { notify } from "../../../src/lib/alerts";
import { useListing } from "../../../src/features/listings/hooks/useListing";
import { useImageUpload } from "../../../src/features/listings/hooks/useImageUpload";
import { useUpdateImages } from "../../../src/features/listings/hooks/useUpdateImages";
import { ImagePickerGrid } from "../../../src/features/listings/components/ImagePickerGrid";
import { UploadedImage } from "../../../src/lib/upload-client";
import { ListingImage } from "../../../src/features/listings/api/listings.api";

export default function EditImagesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: listing, isLoading, isError, refetch } = useListing(id);
  const { colors } = useTheme();
  const t = useT();

  if (isLoading) {
    return (
      <Screen centered edges={HEADER_EDGES}>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  // `isLoading || !listing` used to cover both cases, so a failed fetch left
  // the spinner turning forever.
  if (isError || !listing) {
    return (
      <Screen centered edges={HEADER_EDGES}>
        <EmptyState
          icon="alert-circle-outline"
          tone="danger"
          title={t(isError ? "listings.loadError" : "listings.notFound")}
          actionLabel={t("common.retry")}
          onAction={refetch}
        />
      </Screen>
    );
  }

  return (
    // Keyed on the listing so the form's initial state is rebuilt if the
    // cached listing is replaced under it.
    <EditImagesForm
      key={listing.id}
      listingId={listing.id}
      initial={listing.images}
    />
  );
}

function toUploaded(images: ListingImage[]): UploadedImage[] {
  return [...images]
    .sort(
      (a, b) =>
        Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position,
    )
    .map((img) => ({
      url: img.url,
      thumbUrl: img.thumbUrl,
      // Carried through so re-saving keeps the stored dimensions. Older rows
      // have none; toPayload() then omits the field instead of writing zeroes
      // back over them.
      width: img.width ?? 0,
      height: img.height ?? 0,
    }));
}

function EditImagesForm({
  listingId,
  initial,
}: {
  listingId: string;
  initial: ListingImage[];
}) {
  const {
    images,
    pickAndUpload,
    remove,
    retry,
    reorder,
    toPayload,
    isUploading,
  } = useImageUpload(toUploaded(initial));
  const update = useUpdateImages(listingId);
  const { text } = useTheme();
  const t = useT();

  const onSave = () => {
    const payload = toPayload();
    if (payload.length === 0) {
      notify("images.requiredTitle", "images.requiredMessage");
      return;
    }
    update.mutate(payload);
  };

  return (
    <Screen edges={HEADER_EDGES}>
      <View style={{ gap: spacing.lg }}>
        <Text style={text.title}>{t("listings.editImages")}</Text>

        <ImagePickerGrid
          images={images}
          onAdd={pickAndUpload}
          onRemove={remove}
          onRetry={retry}
          onReorder={reorder}
        />

        <Button
          title={isUploading ? t("images.uploading") : t("common.save")}
          onPress={onSave}
          loading={update.isPending}
          disabled={isUploading}
        />
      </View>
    </Screen>
  );
}
