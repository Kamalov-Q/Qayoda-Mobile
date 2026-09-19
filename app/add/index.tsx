// app/add/index.tsx
import { useMemo, useRef, useState } from "react";
import { Text, View, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { useForm, useWatch, Controller } from "react-hook-form";
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
import { router } from "expo-router";
import { useLocationPicker } from "../../src/features/map/locationPickerStore";
import { textToHtml } from "../../src/features/listings/utils/format";
import {
  CATEGORY_ICONS,
  PURPOSE_ICONS,
} from "../../src/features/listings/utils/icons";
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

// Limits mirror the server's CreateListingDto where it has one (title 160,
// address 500, floors up to 200), so a form that passes here is not bounced
// by the API. The rest are sanity bounds: wide enough for any real listing,
// tight enough to catch a missing or extra zero.
const TITLE_MAX = 160;
const ADDRESS_MAX = 500;
const DESCRIPTION_MAX = 2000;
const MAX_ROOMS = 50;
const MAX_FLOORS = 200;
const MAX_AREA_M2 = 10_000_000; // 1 000 ha — large farmland, nothing bigger
const PRICE_MAX_DIGITS = 13;

type Currency = "USD" | "UZS";
const CURRENCIES = ["USD", "UZS"] as const satisfies readonly Currency[];

/**
 * Plausible price per tab and currency. A sale price and a nightly rate differ
 * by four orders of magnitude, which is exactly why one shared bound could not
 * catch anything — "450" is a fine daily rent and an obvious typo for a flat.
 * UZS bounds sit at roughly 10 000 × the USD ones, below the market rate on
 * purpose so a cheap-but-real listing is never rejected.
 */
const PRICE_LIMITS: Record<OfferPurpose, Record<Currency, [number, number]>> = {
  SALE: { USD: [500, 100_000_000], UZS: [5_000_000, 1_000_000_000_000] },
  RENT_MONTHLY: { USD: [20, 1_000_000], UZS: [200_000, 10_000_000_000] },
  RENT_DAILY: { USD: [5, 50_000], UZS: [50_000, 500_000_000] },
};

const PRICE_PLACEHOLDERS: Record<OfferPurpose, Record<Currency, string>> = {
  SALE: { USD: "65000", UZS: "800000000" },
  RENT_MONTHLY: { USD: "500", UZS: "6000000" },
  RENT_DAILY: { USD: "40", UZS: "500000" },
};

/** 1250000 → "1 250 000", for the bounds quoted in error messages. */
const groupDigits = (n: number) =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/**
 * Digit count, not format: people write +998 90 123 45 67, 90-123-45-67 or a
 * bare local number. A local Uzbek number is 9 digits, the full one 12 (998 +
 * 9), and anything else international falls in 10–15.
 */
const phoneDigitsOk = (v: string) => {
  const digits = v.replace(/\D/g, "");
  if (digits.startsWith("998")) return digits.length === 12;
  return digits.length >= 9 && digits.length <= 15;
};

// Rebuilt whenever the language changes: the messages are user-facing, and a
// schema frozen at module load would keep showing the language the app started
// in. Same pattern as the auth screens.
const makeSchema = (t: ReturnType<typeof useT>) => {
  const digits = z.string().regex(/^\d*$/, t("validation.numbersOnly"));
  // An optional whole number within [min, max]; blank means "not given".
  const intInRange = (min: number, max: number) =>
    digits
      .refine(
        (v) => !v || (Number(v) >= min && Number(v) <= max),
        t("validation.range", { min, max: groupDigits(max) }),
      )
      .optional();

  return (
    z
      .object({
        // Tab and currency live in the form, not in component state, because
        // the price rule depends on both — a rule can only see form values.
        purpose: z.enum(PURPOSES),
        currency: z.enum(CURRENCIES),
        title: z
          .string()
          .trim()
          .min(3, t("validation.minChars", { count: 3 }))
          .max(TITLE_MAX, t("validation.maxChars", { count: TITLE_MAX })),
        rooms: intInRange(0, MAX_ROOMS),
        hasFloors: z.enum(FLOOR_CHOICES),
        floor: intInRange(1, MAX_FLOORS),
        totalFloors: intInRange(1, MAX_FLOORS),
        price: z.string().regex(/^\d+$/, t("validation.priceRequired")),
        address: z
          .string()
          .trim()
          .max(ADDRESS_MAX, t("validation.maxChars", { count: ADDRESS_MAX }))
          .optional(),
        areaM2: z
          .string()
          .regex(/^\d*\.?\d*$/, t("validation.numbersOnly"))
          .refine(
            (v) => !v || /^\d*\.?\d{0,2}$/.test(v),
            t("validation.decimalPlaces"),
          )
          .refine(
            (v) => !v || (Number(v) > 0 && Number(v) <= MAX_AREA_M2),
            t("validation.range", { min: 1, max: groupDigits(MAX_AREA_M2) }),
          )
          .optional(),
        phone: z
          .string()
          .trim()
          .refine(
            (v) => !v || (PHONE.test(v) && phoneDigitsOk(v)),
            t("validation.phoneInvalid"),
          )
          .optional(),
        description: z
          .string()
          .trim()
          .max(
            DESCRIPTION_MAX,
            t("validation.maxChars", { count: DESCRIPTION_MAX }),
          )
          .optional(),
      })
      // Cross-field rules, so they hang off the object rather than a field.
      .superRefine((v, ctx) => {
        // Price is only judged once it is a number at all — the field-level
        // regex already reports "enter a price" for anything else.
        if (/^\d+$/.test(v.price)) {
          const [min, max] = PRICE_LIMITS[v.purpose][v.currency];
          const price = Number(v.price);
          if (price < min || price > max) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["price"],
              message:
                price < min
                  ? t("validation.priceMin", { min: groupDigits(min) })
                  : t("validation.priceMax", { max: groupDigits(max) }),
            });
          }
        }

        // The category is not part of the form — it does not need to be,
        // because picking a category that cannot have floors forces
        // `hasFloors` back to "no", which switches every rule below off.
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
        // Catches the transposed pair — "9 of 4" — which the server rejects too.
        if (
          v.floor &&
          v.totalFloors &&
          Number(v.floor) > Number(v.totalFloors)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["floor"],
            message: t("validation.floorAboveTotal"),
          });
        }
      })
  );
};

type FormData = z.infer<ReturnType<typeof makeSchema>>;

export default function AddListingScreen() {
  // Gated at the screen, not at every entry point: however a guest gets here
  // (home quick action, tab, deep link), they meet the same prompt.
  const authed = useIsAuthed();

  const [category, setCategory] = useState<PropertyCategory>("APARTMENT");
  // POLYGON = drawn boundary (precise, derives area); PIN = one dropped point
  // (honest for an apartment in a block). Exactly one ships with the listing.
  const [locMode, setLocMode] = useState<"POLYGON" | "PIN">("POLYGON");
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [properties, setProperties] = useState<string[]>([]);
  // Each tab keeps its own price draft: a sale price carried into the daily
  // tab would be wrong by four orders of magnitude, but retyping it after a
  // peek at another tab would be worse.
  const priceDrafts = useRef<Partial<Record<OfferPurpose, string>>>({});
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
  const purposeTabs = useMemo(
    () =>
      PURPOSES.map((value) => ({
        value,
        label: t(`add.tabs.${value}`),
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
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      purpose: "SALE",
      currency: "USD",
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

  // useWatch, not watch(): the React Compiler can't memoise around watch()
  // and skips the whole component when it sees it.
  const purpose = useWatch({ control, name: "purpose" });
  const offerCurrency = useWatch({ control, name: "currency" });

  const switchPurpose = (next: OfferPurpose) => {
    if (next === purpose) return;
    priceDrafts.current[purpose] = getValues("price");
    setValue("purpose", next);
    setValue("price", priceDrafts.current[next] ?? "");
    // The old tab's verdict says nothing about the new tab's price.
    clearErrors("price");
  };

  const changeCurrency = (next: Currency) => {
    setValue("currency", next);
    // The same digits mean something else in the other currency, so a typed
    // price is re-judged at once — "500" is a fine dollar rent and far too
    // low in so'm.
    if (getValues("price")) void trigger("price");
  };

  const pricePeriod =
    purpose === "RENT_MONTHLY"
      ? ` / ${t("add.perMonth")}`
      : purpose === "RENT_DAILY"
        ? ` / ${t("add.perDay")}`
        : "";

  const showFloors = canHaveFloors(category);
  const floorsDeclared = useWatch({ control, name: "hasFloors" }) === "yes";

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
  // The last address this form filled in by itself. A value still equal to it
  // is the map's suggestion, not the owner's words — so a new location may
  // replace it, where a typed address must survive.
  const autoAddress = useRef<string | null>(null);

  const fillAddressAt = async (longitude: number, latitude: number) => {
    const current = getValues("address")?.trim();
    // Suggest, never overwrite: a typed address survives map edits.
    if (current && current !== autoAddress.current) return;
    // A suggestion for the previous location is now wrong. Clear it first, so
    // a geocoder miss leaves an empty field rather than the old place's name.
    if (current) setValue("address", "");
    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      const line = [place?.street ?? place?.name, place?.district, place?.city]
        .filter(Boolean)
        .join(", ");
      if (line) {
        autoAddress.current = line;
        setValue("address", line, { shouldValidate: true });
      }
    } catch {
      // Offline or geocoder refused — the field just stays empty.
    }
  };

  // The last area this form filled in from a boundary — same idea as
  // autoAddress: equal to it means "the map's figure", which a newer boundary
  // may replace; anything else was typed by the owner and is left alone.
  const autoArea = useRef<string | null>(null);

  const fillAreaFrom = (points: [number, number][]) => {
    if (points.length < MIN_POLYGON_POINTS) return;
    const current = getValues("areaM2") ?? "";
    if (current && current !== autoArea.current) return;
    const measured = String(Math.round(polygonAreaM2(points)));
    autoArea.current = measured;
    setValue("areaM2", measured, { shouldValidate: true });
  };

  const fillAddressFrom = (points: [number, number][]) => {
    if (points.length < MIN_POLYGON_POINTS) return;
    const latitude = points.reduce((a, p) => a + p[1], 0) / points.length;
    const longitude = points.reduce((a, p) => a + p[0], 0) / points.length;
    return fillAddressAt(longitude, latitude);
  };

  // The pickers are their own screens (app/add/pin, app/add/draw) — see
  // PinPicker for why they stopped being Modals. They can't take props, so the
  // starting value and the save handling are parked in a store first.
  //
  // A listing has exactly one location — a boundary OR a pin — so saving one
  // clears the other. Only the current mode was ever submitted, but keeping
  // both meant flipping the toggle back showed a stale location as if it
  // were still chosen. Flipping the toggle alone clears nothing: that is a
  // look, not a decision, and a drawn boundary is too much work to lose to
  // a stray tap.
  const openPicker = useLocationPicker((st) => st.open);
  const openPin = () => {
    openPicker({
      kind: "pin",
      initial: pin,
      onSave: (p) => {
        setPin(p);
        setPolygon([]);
        // The boundary's measurement described the shape just discarded; a
        // figure the owner typed themselves is theirs and stays.
        if (getValues("areaM2") === autoArea.current) {
          setValue("areaM2", "");
          clearErrors("areaM2");
        }
        autoArea.current = null;
        void fillAddressAt(p[0], p[1]);
      },
    });
    router.push("/add/pin");
  };
  const openDraw = () => {
    openPicker({
      kind: "polygon",
      initial: polygon,
      onSave: (points) => {
        setPolygon(points);
        setPin(null);
        fillAreaFrom(points);
        void fillAddressFrom(points);
      },
    });
    router.push("/add/draw");
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
        : { point: pin! }),
      // Sent in both modes. With a boundary it overrides the server's own
      // measurement (it is the pre-filled figure unless the owner changed
      // it); left blank, the server measures the boundary itself.
      ...(d.areaM2 ? { areaM2: Number(d.areaM2) } : {}),
      offers: [
        { purpose: d.purpose, price: Number(d.price), currency: d.currency },
      ],
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
        {/* The tab decides what the price means, so it comes before anything
            else is typed — and switching it only swaps the price, never the
            rest of the form. */}
        <View style={{ gap: spacing.sm }}>
          <SegmentedControl
            size="lg"
            segments={purposeTabs}
            value={purpose}
            onChange={switchPurpose}
          />
          {/* Keyed on the tab: each switch re-runs the fade, which is what
              tells the eye the price rules below just changed. */}
          <Animated.View key={purpose} entering={FadeIn.duration(220)}>
            <Text style={text.caption}>{t(`add.tabHints.${purpose}`)}</Text>
          </Animated.View>
        </View>

        <Section title={t("add.category")}>
          <SelectGrid
            options={categoryOptions}
            value={category}
            onChange={changeCategory}
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
              maxLength={TITLE_MAX}
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
          onChange={changeCurrency}
        />
        <Controller
          control={control}
          name="price"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              ref={priceRef}
              label={t(`add.priceLabels.${purpose}`)}
              placeholder={PRICE_PLACEHOLDERS[purpose][offerCurrency]}
              keyboardType="number-pad"
              maxLength={PRICE_MAX_DIGITS}
              suffix={
                (offerCurrency === "USD" ? "$" : t("listings.som")) +
                pricePeriod
              }
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
        {/* One editable field in both modes. A drawn boundary pre-fills it
            (see openDraw) but an outline is an estimate — walls, shared
            land — so the owner can always correct it; the hint keeps the
            measured figure in view for comparison. A pin knows nothing about
            size, so there the owner types it from scratch. */}
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
              hint={
                locMode === "POLYGON" && hasBoundary
                  ? t("add.areaFromBoundary", {
                      area: Math.round(polygonAreaM2(polygon)),
                    })
                  : undefined
              }
            />
          )}
        />
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
              maxLength={ADDRESS_MAX}
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
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.sm,
            }}
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
                {t(
                  locMode === "POLYGON"
                    ? "add.locationPolygon"
                    : "add.locationPin",
                )}
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
                onPress={locMode === "POLYGON" ? openDraw : openPin}
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
    </Screen>
  );
}
