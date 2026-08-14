// app/add/index.tsx
import { useMemo, useRef, useState } from "react";
import { Text, View, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Screen,
  Button,
  TextField,
  Card,
  Section,
  SelectGrid,
  ErrorBanner,
  HEADER_EDGES,
  type SelectGridOption,
} from "../../src/components/ui";
import { spacing } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";
import { notify } from "../../src/lib/alerts";
import { errorMessage } from "../../src/lib/api-error";
import { useCreateListing } from "../../src/features/listings/hooks/useCreateListing";
import { useImageUpload } from "../../src/features/listings/hooks/useImageUpload";
import { ImagePickerGrid } from "../../src/features/listings/components/ImagePickerGrid";
import { PolygonPickerModal } from "../../src/features/map/PolygonPickerModal";
import { textToHtml } from "../../src/features/listings/utils/format";
import {
  MIN_POLYGON_POINTS,
  closeRing,
  formatAreaM2,
  polygonAreaM2,
} from "../../src/features/listings/utils/geo";
import {
  PropertyCategory,
  OfferPurpose,
} from "../../src/features/listings/api/listings.api";

// Icons do the recognising here: at a glance the grid is scanned by shape
// before the label is read, which matters most for the two categories whose
// names are near-synonyms in Uzbek ("Hovli" / "Dacha").
const CATEGORY_ICONS = {
  APARTMENT: "bed-outline",
  HOUSE: "home-outline",
  LAND: "map-outline",
  NON_RESIDENTIAL: "storefront-outline",
  BUILDING: "business-outline",
  DACHA: "leaf-outline",
} as const satisfies Record<PropertyCategory, keyof typeof Ionicons.glyphMap>;

const PURPOSE_ICONS = {
  SALE: "pricetag-outline",
  RENT_MONTHLY: "calendar-outline",
  RENT_DAILY: "today-outline",
} as const satisfies Record<OfferPurpose, keyof typeof Ionicons.glyphMap>;

// Order is deliberate: the two most common listings first.
const CATEGORIES = [
  "APARTMENT",
  "HOUSE",
  "LAND",
  "NON_RESIDENTIAL",
  "BUILDING",
  "DACHA",
] as const satisfies readonly PropertyCategory[];

const PURPOSES = [
  "SALE",
  "RENT_MONTHLY",
  "RENT_DAILY",
] as const satisfies readonly OfferPurpose[];

// Deliberately loose: numbers are written +998 90 123 45 67, 90-123-45-67 or
// as a bare local number depending on who is filling the form. It only has to
// catch a half-typed number, not enforce a format.
const PHONE = /^\+?[\d\s()-]{7,20}$/;

const DESCRIPTION_MAX = 2000;

// Rebuilt whenever the language changes: the messages are user-facing, and a
// schema frozen at module load would keep showing the language the app started
// in. Same pattern as the auth screens.
const makeSchema = (t: ReturnType<typeof useT>) =>
  z.object({
    title: z.string().trim().min(3, t("validation.minChars", { count: 3 })),
    rooms: z
      .string()
      .regex(/^\d*$/, t("validation.numbersOnly"))
      .optional(),
    areaM2: z
      .string()
      .regex(/^\d*\.?\d*$/, t("validation.numbersOnly"))
      .optional(),
    price: z
      .string()
      .regex(/^\d+$/, t("validation.priceRequired"))
      // "0" passes the digits test but is not a price.
      .refine((v) => Number(v) > 0, t("validation.priceRequired")),
    address: z.string().trim().optional(),
    phone: z
      .string()
      .trim()
      .refine((v) => !v || PHONE.test(v), t("validation.phoneInvalid"))
      .optional(),
    description: z
      .string()
      .trim()
      .max(DESCRIPTION_MAX, t("validation.maxChars", { count: DESCRIPTION_MAX }))
      .optional(),
  });

type FormData = z.infer<ReturnType<typeof makeSchema>>;

export default function AddListingScreen() {
  const [category, setCategory] = useState<PropertyCategory>("APARTMENT");
  const [purpose, setPurpose] = useState<OfferPurpose>("SALE");
  const [drawing, setDrawing] = useState(false);
  const [polygon, setPolygon] = useState<[number, number][]>([]);

  // Only the title chains: number-pad keyboards have no "next" key, so the
  // numeric fields can't hand focus on anyway.
  const priceRef = useRef<TextInput>(null);

  const create = useCreateListing();
  const {
    images,
    pickAndUpload,
    remove,
    retry,
    makePrimary,
    toPayload,
    isUploading,
  } = useImageUpload();
  const { text } = useTheme();
  const t = useT();

  const schema = useMemo(() => makeSchema(t), [t]);
  const categoryOptions = useMemo<SelectGridOption<PropertyCategory>[]>(
    () =>
      CATEGORIES.map((value) => ({
        value,
        label: t(`categories.${value}`),
        icon: CATEGORY_ICONS[value],
      })),
    [t],
  );
  const purposeOptions = useMemo<SelectGridOption<OfferPurpose>[]>(
    () =>
      PURPOSES.map((value) => ({
        value,
        label: t(`purposes.${value}`),
        icon: PURPOSE_ICONS[value],
      })),
    [t],
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      rooms: "",
      areaM2: "",
      price: "",
      address: "",
      phone: "",
      description: "",
    },
  });

  const hasBoundary = polygon.length >= MIN_POLYGON_POINTS;

  const onSubmit = (d: FormData) => {
    if (!hasBoundary) {
      notify("add.missingBoundaryTitle", "add.missingBoundaryMessage");
      return;
    }
    // Guards a double submit while a photo is still in flight — the payload is
    // built from `images`, so an early send would drop the pending uploads.
    if (isUploading || create.isPending) return;

    const description = d.description?.trim();

    create.mutate({
      category,
      title: d.title.trim(),
      rooms: d.rooms ? Number(d.rooms) : undefined,
      areaM2: d.areaM2 ? Number(d.areaM2) : undefined,
      address: d.address?.trim() || undefined,
      contactPhone: d.phone?.trim() || undefined,
      descriptionHtml: description ? textToHtml(description) : undefined,
      coordinates: [closeRing(polygon)],
      offers: [{ purpose, price: Number(d.price), currency: "USD" }],
      images: toPayload(),
    });
  };

  return (
    <Screen edges={HEADER_EDGES}>
      <View style={{ gap: spacing.lg, paddingBottom: spacing.lg }}>
        <Section title={t("add.category")}>
          <SelectGrid
            options={categoryOptions}
            value={category}
            onChange={setCategory}
          />
        </Section>

        {/* Three purposes, so one even row of thirds. */}
        <Section title={t("add.purpose")}>
          <SelectGrid
            options={purposeOptions}
            value={purpose}
            onChange={setPurpose}
          />
        </Section>

        <Controller
          control={control}
          name="title"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t("add.listingTitle")}
              placeholder={t("add.listingTitlePlaceholder")}
              returnKeyType="next"
              onSubmitEditing={() => priceRef.current?.focus()}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.title?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="price"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              ref={priceRef}
              label={t("add.price")}
              placeholder={t("add.pricePlaceholder")}
              keyboardType="number-pad"
              suffix="$"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.price?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="rooms"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t("add.rooms")}
              placeholder={t("add.roomsPlaceholder")}
              keyboardType="number-pad"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.rooms?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="areaM2"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t("add.area")}
              placeholder={t("add.areaPlaceholder")}
              keyboardType="decimal-pad"
              suffix="m²"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.areaM2?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="address"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t("add.address")}
              placeholder={t("add.addressPlaceholder")}
              icon="location-outline"
              autoComplete="street-address"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.address?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t("add.phone")}
              placeholder={t("add.phonePlaceholder")}
              icon="call-outline"
              keyboardType="phone-pad"
              autoComplete="tel"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.phone?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t("add.description")}
              placeholder={t("add.descriptionPlaceholder")}
              multiline
              maxLength={DESCRIPTION_MAX}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.description?.message}
            />
          )}
        />

        <Section title={t("add.boundary")}>
          <Card>
            <View style={{ gap: spacing.md }}>
              <Text style={text.body}>
                {hasBoundary
                  ? t("add.boundarySummary", {
                      count: polygon.length,
                      area: formatAreaM2(polygonAreaM2(polygon)),
                    })
                  : t("add.noBoundary")}
              </Text>
              <Button
                title={t("add.drawOnMap")}
                icon="map-outline"
                variant="secondary"
                size="sm"
                onPress={() => setDrawing(true)}
              />
            </View>
          </Card>
        </Section>

        <ImagePickerGrid
          images={images}
          onAdd={pickAndUpload}
          onRemove={remove}
          onRetry={retry}
          onMakePrimary={makePrimary}
        />

        <ErrorBanner
          message={create.isError ? errorMessage(create.error) : null}
        />

        <Button
          title={isUploading ? t("images.uploading") : t("add.submit")}
          onPress={handleSubmit(onSubmit)}
          loading={create.isPending}
          disabled={isUploading}
        />
      </View>

      {/* Mounted only while open: the sheet seeds its draft ring from `initial`
          on mount, so a permanently mounted one would reopen holding the points
          from a cancelled session. */}
      {drawing ? (
        <PolygonPickerModal
          visible
          initial={polygon}
          onCancel={() => setDrawing(false)}
          onSave={(points) => {
            setPolygon(points);
            setDrawing(false);
          }}
        />
      ) : null}
    </Screen>
  );
}
