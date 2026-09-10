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
  SegmentedControl,
  Chip,
} from "../../src/components/ui";
import { spacing } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import * as Location from "expo-location";
import { useT } from "../../src/i18n";
import { useIsAuthed } from "../../src/features/auth/guest";
import { GuestPrompt } from "../../src/features/auth/components/GuestPrompt";
import { notify } from "../../src/lib/alerts";
import { errorMessage } from "../../src/lib/api-error";
import { useCreateListing } from "../../src/features/listings/hooks/useCreateListing";
import { useImageUpload } from "../../src/features/listings/hooks/useImageUpload";
import { ImagePickerGrid } from "../../src/features/listings/components/ImagePickerGrid";
import { PolygonPickerModal } from "../../src/features/map/PolygonPickerModal";
import { PinPickerModal } from "../../src/features/map/PinPickerModal";
import { textToHtml } from "../../src/features/listings/utils/format";
import {
  MIN_POLYGON_POINTS,
  closeRing,
  formatAreaM2,
  polygonAreaM2,
} from "../../src/features/listings/utils/geo";
import {
  LISTING_PROPERTY_KEYS,
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
  HOTEL: "bed-outline",
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
  "HOTEL",
] as const satisfies readonly PropertyCategory[];

const PURPOSES = [
  "SALE",
  "RENT_MONTHLY",
  "RENT_DAILY",
] as const satisfies readonly OfferPurpose[];

// Mirrors FLOOR_CAPABLE_CATEGORIES on the server, which rejects a floor sent
// for anything else. A house or a dacha IS the building, and land has no
// storeys at all — only a unit inside a stack, or the stack itself, can answer
// "which floor".
const FLOOR_CATEGORIES = [
  "APARTMENT",
  "BUILDING",
  "NON_RESIDENTIAL",
  "HOTEL",
] as const satisfies readonly PropertyCategory[];

const canHaveFloors = (category: PropertyCategory) =>
  (FLOOR_CATEGORIES as readonly PropertyCategory[]).includes(category);

// Being in a floor-capable category still does not mean the property has
// floors: a single-storey shop filed as BUILDING, or a ground-level house
// converted into an APARTMENT, has none to give. Asked rather than assumed,
// because a blank floor field is ambiguous between "no floors" and "skipped".
const FLOOR_CHOICES = ["yes", "no"] as const;
type FloorChoice = (typeof FLOOR_CHOICES)[number];

const FLOOR_CHOICE_ICONS = {
  yes: "layers-outline",
  no: "square-outline",
} as const satisfies Record<FloorChoice, keyof typeof Ionicons.glyphMap>;

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
    hasFloors: z.enum(FLOOR_CHOICES),
    floor: z.string().regex(/^\d*$/, t("validation.numbersOnly")).optional(),
    totalFloors: z
      .string()
      .regex(/^\d*$/, t("validation.numbersOnly"))
      .optional(),
    price: z
      .string()
      .regex(/^\d+$/, t("validation.priceRequired"))
      // "0" passes the digits test but is not a price.
      .refine((v) => Number(v) > 0, t("validation.priceRequired")),
    address: z.string().trim().optional(),
    areaM2: z
      .string()
      .regex(/^\d*\.?\d*$/, t("validation.numbersOnly"))
      .optional(),
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
  })
    // Cross-field rules, so they hang off the object rather than a field. The
    // category is not part of the form — it does not need to be, because
    // picking a category that cannot have floors forces `hasFloors` back to
    // "no", which switches every rule below off.
    .superRefine((v, ctx) => {
      if (v.hasFloors !== "yes") return;

      // Which floor you live on is always known; how tall the block is often
      // is not, so only the first is required once floors are declared.
      if (!v.floor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["floor"],
          message: t("validation.required"),
        });
      }
      if (v.totalFloors && Number(v.totalFloors) === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["totalFloors"],
          message: t("validation.positiveNumber"),
        });
      }
      // Catches the transposed pair — "9 of 4" — which the server rejects too.
      if (v.floor && v.totalFloors && Number(v.floor) > Number(v.totalFloors)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["floor"],
          message: t("validation.floorAboveTotal"),
        });
      }
    });

type FormData = z.infer<ReturnType<typeof makeSchema>>;

export default function AddListingScreen() {
  // Gated at the screen, not at every entry point: however a guest gets here
  // (home quick action, tab, deep link), they meet the same prompt.
  const authed = useIsAuthed();

  const [category, setCategory] = useState<PropertyCategory>("APARTMENT");
  const [purpose, setPurpose] = useState<OfferPurpose>("SALE");
  const [drawing, setDrawing] = useState(false);
  // POLYGON = drawn boundary (precise, derives area); PIN = one dropped point
  // (honest for an apartment in a block). Exactly one ships with the listing.
  const [locMode, setLocMode] = useState<"POLYGON" | "PIN">("POLYGON");
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [pinPicking, setPinPicking] = useState(false);
  const [properties, setProperties] = useState<string[]>([]);
  const [offerCurrency, setOfferCurrency] = useState<"USD" | "UZS">("USD");
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
    reorder,
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
  const floorOptions = useMemo<SelectGridOption<FloorChoice>[]>(
    () =>
      FLOOR_CHOICES.map((value) => ({
        value,
        label: value === "yes" ? t("add.hasFloors") : t("add.noFloors"),
        icon: FLOOR_CHOICE_ICONS[value],
      })),
    [t],
  );

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      rooms: "",
      price: "",
      // The default category is APARTMENT, and an apartment in a block is the
      // common case here — so the two fields start open rather than behind a
      // tap, and only the one nobody has to look up is required.
      hasFloors: "yes",
      floor: "",
      totalFloors: "",
      address: "",
      areaM2: "",
      phone: "",
      description: "",
    },
  });

  const showFloors = canHaveFloors(category);
  const floorsDeclared = watch("hasFloors") === "yes";

  const resetFloorFields = () => {
    setValue("floor", "");
    setValue("totalFloors", "");
    clearErrors(["floor", "totalFloors"]);
  };

  /**
   * Keeps the answer and the category in step. Moving to a category with no
   * floors does not just hide the fields — it clears them, so a floor typed
   * for an apartment cannot ride along in the payload after the listing has
   * been refiled as land (which the server would reject anyway).
   */
  const changeCategory = (next: PropertyCategory) => {
    setCategory(next);
    if (canHaveFloors(next) === showFloors) return;
    setValue("hasFloors", canHaveFloors(next) ? "yes" : "no");
    resetFloorFields();
  };

  const hasBoundary = polygon.length >= MIN_POLYGON_POINTS;
  const hasLocation = locMode === "POLYGON" ? hasBoundary : pin !== null;

  /**
   * The address comes from the map, not the keyboard: reverse-geocode the
   * boundary's centre whenever it is (re)drawn. Best effort — a geocoder
   * miss just leaves the field blank, and the server stores whatever came.
   */
  const fillAddressAt = async (longitude: number, latitude: number) => {
    try {
      // Suggest, never overwrite: a typed address survives map edits.
      if (getValues("address")?.trim()) return;
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const line = [place?.street ?? place?.name, place?.district, place?.city]
        .filter(Boolean)
        .join(", ");
      if (line) setValue("address", line, { shouldValidate: true });
    } catch {
      // Offline or geocoder refused — the field just stays empty.
    }
  };

  const fillAddressFrom = (points: [number, number][]) => {
    if (points.length < MIN_POLYGON_POINTS) return;
    const latitude = points.reduce((a, p) => a + p[1], 0) / points.length;
    const longitude = points.reduce((a, p) => a + p[0], 0) / points.length;
    return fillAddressAt(longitude, latitude);
  };

  const onSubmit = (d: FormData) => {
    if (!hasLocation) {
      notify("add.missingLocationTitle", "add.missingLocationMessage");
      return;
    }
    // A listing with no photo is a listing nobody opens, so the API's optional
    // images are required here. Checked against the payload rather than the
    // tiles: a tile that failed to upload has nothing to send.
    if (toPayload().length === 0) {
      notify("images.requiredTitle", "images.requiredMessage");
      return;
    }
    // Guards a double submit while a photo is still in flight — the payload is
    // built from `images`, so an early send would drop the pending uploads.
    if (isUploading || create.isPending) return;

    const description = d.description?.trim();
    const sendFloors = showFloors && d.hasFloors === "yes";

    create.mutate({
      category,
      title: d.title.trim(),
      rooms: d.rooms ? Number(d.rooms) : undefined,
      // Both stay off the payload unless the category can carry them AND the
      // owner said it does — the server rejects a floor on anything else.
      floor: sendFloors && d.floor ? Number(d.floor) : undefined,
      totalFloors:
        sendFloors && d.totalFloors ? Number(d.totalFloors) : undefined,
      address: d.address?.trim() || undefined,
      ...(properties.length ? { properties } : {}),
      contactPhone: d.phone?.trim() || undefined,
      descriptionHtml: description ? textToHtml(description) : undefined,
      ...(locMode === "POLYGON"
        ? { coordinates: [closeRing(polygon)] }
        : {
            point: pin!,
            // A pin has no boundary to measure, so the typed m² is the only
            // source; the server refuses it on polygon listings anyway.
            ...(d.areaM2 ? { areaM2: Number(d.areaM2) } : {}),
          }),
      offers: [{ purpose, price: Number(d.price), currency: offerCurrency }],
      images: toPayload(),
    });
  };

  if (!authed) {
    return (
      <Screen centered>
        <GuestPrompt subtitle={t("auth.guestAddSubtitle")} />
      </Screen>
    );
  }
  return (
    <Screen edges={HEADER_EDGES}>
      <View style={{ gap: spacing.lg, paddingBottom: spacing.lg }}>
        <Section title={t("add.category")}>
          <SelectGrid
            options={categoryOptions}
            value={category}
            onChange={changeCategory}
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
        {/* The seller quotes in whichever currency they think in; viewers see
            it converted to their own preference either way. */}
        <SegmentedControl
          segments={[
            { value: "USD", label: "USD" },
            { value: "UZS", label: "UZS" },
          ]}
          value={offerCurrency}
          onChange={setOfferCurrency}
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
              suffix={offerCurrency === "USD" ? "$" : t("listings.som")}
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
        {/* Two sources, one field: a boundary measures itself (read-only),
            a pin knows nothing about size, so the owner types it. */}
        {locMode === "POLYGON" ? (
          <TextField
            label={t("add.area")}
            placeholder="—"
            suffix="m²"
            editable={false}
            value={hasBoundary ? String(Math.round(polygonAreaM2(polygon))) : ""}
            hint={t("add.areaAuto")}
          />
        ) : (
          <Controller
            control={control}
            name="areaM2"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t("add.area")}
                placeholder={t("add.areaPlaceholder")}
                suffix="m²"
                keyboardType="decimal-pad"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.areaM2?.message}
              />
            )}
          />
        )}
        {showFloors ? (
          <Section title={t("add.floors")}>
            <View style={{ gap: spacing.md }}>
              <Controller
                control={control}
                name="hasFloors"
                render={({ field: { value, onChange } }) => (
                  <SelectGrid
                    options={floorOptions}
                    value={value}
                    columns={2}
                    onChange={(next) => {
                      onChange(next);
                      // Answering "no" drops whatever was typed: leaving the
                      // numbers behind a hidden branch is how a stale floor
                      // reaches the server.
                      if (next === "no") resetFloorFields();
                    }}
                  />
                )}
              />

              {/* Paired on one row: both hold one or two digits, and "4 of 9"
                  is how the pair is read back on the listing page. Aligned to
                  the top so an error under one does not stretch the other. */}
              {floorsDeclared ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: spacing.md,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Controller
                      control={control}
                      name="floor"
                      render={({ field: { value, onChange, onBlur } }) => (
                        <TextField
                          label={t("add.floor")}
                          placeholder={t("add.floorPlaceholder")}
                          keyboardType="number-pad"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          error={errors.floor?.message}
                        />
                      )}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Controller
                      control={control}
                      name="totalFloors"
                      render={({ field: { value, onChange, onBlur } }) => (
                        <TextField
                          label={t("add.totalFloors")}
                          placeholder={t("add.totalFloorsPlaceholder")}
                          keyboardType="number-pad"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          error={errors.totalFloors?.message}
                        />
                      )}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          </Section>
        ) : null}

        {/* Seeded by the map when a boundary/pin lands, but the owner has
            the last word — geocoders miss half the mahallas here. */}
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

        <Section title={t("add.propertiesTitle")}>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
          >
            {LISTING_PROPERTY_KEYS.map((key) => (
              <Chip
                key={key}
                label={t(`props.${key}`)}
                selected={properties.includes(key)}
                onPress={() =>
                  setProperties((current) =>
                    current.includes(key)
                      ? current.filter((k) => k !== key)
                      : [...current, key],
                  )
                }
              />
            ))}
          </View>
        </Section>

        <Section title={t("add.location")}>
          <Card>
            <View style={{ gap: spacing.md }}>
              {/* Icons only — the Russian labels truncated both segments;
                  the summary line right below says the same in words. */}
              <SegmentedControl
                segments={[
                  { value: "POLYGON", icon: "analytics-outline" },
                  { value: "PIN", icon: "pin-outline" },
                ]}
                value={locMode}
                onChange={setLocMode}
              />
              <Text style={text.caption}>
                {t(locMode === "POLYGON" ? "add.locationPolygon" : "add.locationPin")}
              </Text>
              <Text style={text.body}>
                {locMode === "POLYGON"
                  ? hasBoundary
                    ? t("add.boundarySummary", {
                        count: polygon.length,
                        area: formatAreaM2(polygonAreaM2(polygon)),
                      })
                    : t("add.noBoundary")
                  : pin
                    ? t("add.pinSet")
                    : t("add.noPin")}
              </Text>
              <Button
                title={
                  locMode === "POLYGON" ? t("add.drawOnMap") : t("add.dropPin")
                }
                icon={locMode === "POLYGON" ? "map-outline" : "pin-outline"}
                variant="secondary"
                size="sm"
                onPress={() =>
                  locMode === "POLYGON" ? setDrawing(true) : setPinPicking(true)
                }
              />
            </View>
          </Card>
        </Section>

        <ImagePickerGrid
          images={images}
          onAdd={pickAndUpload}
          onRemove={remove}
          onRetry={retry}
          onReorder={reorder}
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
      {pinPicking ? (
        <PinPickerModal
          visible
          initial={pin}
          onCancel={() => setPinPicking(false)}
          onSave={(p) => {
            setPin(p);
            void fillAddressAt(p[0], p[1]);
            setPinPicking(false);
          }}
        />
      ) : null}

      {drawing ? (
        <PolygonPickerModal
          visible
          initial={polygon}
          onCancel={() => setDrawing(false)}
          onSave={(points) => {
            setPolygon(points);
            void fillAddressFrom(points);
            setDrawing(false);
          }}
        />
      ) : null}
    </Screen>
  );
}
