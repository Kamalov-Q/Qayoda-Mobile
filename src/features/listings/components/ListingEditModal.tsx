import { useMemo, useState } from "react";
import { formatUzPhoneInput, isUzMobile, normalizePhone } from "@/src/lib/phone";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  SlideInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import {
  useForm,
  useWatch,
  Controller,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
  Card,
  TextField,
  Section,
  SelectGrid,
  type SelectGridOption,
  SegmentedControl,
  SelectSheet,
  Chip,
  type Option,
} from "@/src/components/ui";
import { spacing, radii, sizing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT, type TranslationKey } from "@/src/i18n";
import {
  Listing,
  PropertyCategory,
  OfferPurpose,
  RepairType,
} from "../api/listings.api";
import { useCategories } from "../hooks/useCategories";
import { useAmenities } from "../hooks/useAmenities";
import { useUpdateListing } from "../hooks/useUpdateListing";
import { useImageUpload } from "../hooks/useImageUpload";
import { ImagePickerGrid } from "./ImagePickerGrid";
import { PolygonPicker } from "@/src/features/map/PolygonPicker";
import { PinPicker } from "@/src/features/map/PinPicker";
import {
  MIN_POLYGON_POINTS,
  closeRing,
  formatAreaM2,
  polygonAreaM2,
} from "../utils/geo";
import { decimalInput, onlyDigits, textToHtml } from "../utils/format";
import { toast } from "@/src/components/ui/Toast";
import { PURPOSE_ICONS } from "../utils/icons";

/**
 * The stored ring, ready for the editor.
 *
 * GeoJSON closes a polygon by repeating its first point last; the editor
 * keeps the ring open while drawing and closes it again on save. Seeding
 * without dropping that repeat puts two vertices on the same spot, and the
 * owner has to find and delete one before the shape behaves.
 */
function openRing(ring: [number, number][]): [number, number][] {
  if (ring.length < 2) return [...ring];

  const first = ring[0];
  const last = ring[ring.length - 1];
  const closed = first[0] === last[0] && first[1] === last[1];

  return closed ? ring.slice(0, -1) : [...ring];
}

const PURPOSES = [
  "SALE",
  "RENT_MONTHLY",
  "RENT_DAILY",
] as const satisfies readonly OfferPurpose[];

const SELLER_TYPES = ["OWNER", "REALTOR"] as const;
type SellerType = (typeof SELLER_TYPES)[number];

const SELLER_TYPE_ICONS = {
  OWNER: "person-outline",
  REALTOR: "briefcase-outline",
} as const satisfies Record<SellerType, keyof typeof Ionicons.glyphMap>;

const SELLER_TYPE_LABELS = {
  OWNER: "add.sellerTypeOwner",
  REALTOR: "add.sellerTypeRealtor",
} as const satisfies Record<SellerType, TranslationKey>;

const BUILDING_TYPES = ["NEW", "SECONDARY"] as const;
type BuildingType = (typeof BUILDING_TYPES)[number];

const BUILDING_TYPE_ICONS = {
  NEW: "business-outline",
  SECONDARY: "home-outline",
} as const satisfies Record<BuildingType, keyof typeof Ionicons.glyphMap>;

const BUILDING_TYPE_LABELS = {
  NEW: "add.buildingTypeNew",
  SECONDARY: "add.buildingTypeSecondary",
} as const satisfies Record<BuildingType, TranslationKey>;

const REPAIR_TYPES = [
  "NEEDS_REPAIR",
  "AVERAGE",
  "COSMETIC",
  "EURO",
  "DESIGNER",
  "CAPITAL",
] as const satisfies readonly RepairType[];

const REPAIR_LABELS = {
  NEEDS_REPAIR: "add.repairNeeds",
  AVERAGE: "add.repairAverage",
  COSMETIC: "add.repairCosmetic",
  EURO: "add.repairEuro",
  DESIGNER: "add.repairDesigner",
  CAPITAL: "add.repairCapital",
} as const satisfies Record<RepairType, TranslationKey>;

const FLOOR_CHOICES = ["yes", "no"] as const;
type FloorChoice = (typeof FLOOR_CHOICES)[number];

const FLOOR_CHOICE_ICONS = {
  yes: "layers-outline",
  no: "square-outline",
} as const satisfies Record<FloorChoice, keyof typeof Ionicons.glyphMap>;

const TITLE_MAX = 160;
const ADDRESS_MAX = 500;
const DESCRIPTION_MAX = 2000;
const MAX_ROOMS = 50;
const MAX_FLOORS = 200;
const MAX_AREA_M2 = 10_000_000;
const PRICE_MAX_DIGITS = 13;

type Currency = "USD" | "UZS";
const CURRENCIES = ["USD", "UZS"] as const satisfies readonly Currency[];

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

const groupDigits = (n: number) =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const makeSchema = (t: ReturnType<typeof useT>) => {
  const digits = z.string().regex(/^\d*$/, t("validation.numbersOnly"));
  const intInRange = (min: number, max: number) =>
    digits
      .refine(
        (v) => !v || (Number(v) >= min && Number(v) <= max),
        t("validation.range", { min, max: groupDigits(max) }),
      )
      .optional();

  return z
    .object({
      purpose: z.enum(PURPOSES),
      currency: z.enum(CURRENCIES),
      title: z
        .string()
        .trim()
        .min(3, t("validation.minChars", { count: 3 }))
        .max(TITLE_MAX, t("validation.maxChars", { count: TITLE_MAX })),
      rooms: intInRange(0, MAX_ROOMS),
      sellerType: z.enum(SELLER_TYPES).or(z.literal("")),
      buildingType: z.enum(BUILDING_TYPES).or(z.literal("")),
      repairType: z.enum(REPAIR_TYPES).or(z.literal("")),
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
        .refine((v) => !v || isUzMobile(v), t("validation.phoneInvalid"))
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
    .superRefine((v, ctx) => {
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

      if (v.hasFloors !== "yes") return;

      if (!v.floor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["floor"],
          message: t("validation.required"),
        });
      }
      if (v.floor && v.totalFloors && Number(v.floor) > Number(v.totalFloors)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["floor"],
          message: t("validation.floorAboveTotal"),
        });
      }
    });
};

type FormData = z.infer<ReturnType<typeof makeSchema>>;

interface ListingEditModalProps {
  listing: Listing;
  visible: boolean;
  onClose: () => void;
}

interface ListingEditContentProps {
  listing: Listing;
  onClose: () => void;
}

function ListingEditContent({ listing, onClose }: ListingEditContentProps) {
  const { colors, text, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const reduceMotion = useReducedMotion();

  const updateMutation = useUpdateListing(listing.id);

  const {
    categories,
    nameOf,
    iconOf,
    hasFloors: canHaveFloors,
    hasBuildingType: canHaveBuildingType,
    hasRepairType: canHaveRepairType,
    isLoading: categoriesLoading,
  } = useCategories();

  const { amenities, nameOf: amenityName } = useAmenities();

  /**
   * The location, as the post form shapes it: a boundary OR a pin, never
   * both. A listing drawn as a parcel reopens on POLYGON with its ring; one
   * dropped as a pin reopens on PIN with its point.
   *
   * The stored ring is closed (last point repeats the first) and the editor
   * works on an open one, so the seed drops that repeat — otherwise every
   * reopen would add a vertex sitting exactly on another.
   */
  const [locMode, setLocMode] = useState<"POLYGON" | "PIN">(
    listing.geom ? "POLYGON" : "PIN",
  );
  const [polygon, setPolygon] = useState<[number, number][]>(() =>
    openRing(listing.geom?.coordinates?.[0] ?? []),
  );
  const [pin, setPin] = useState<[number, number] | null>(
    listing.centroid?.coordinates ?? null,
  );
  /**
   * Which picker is over the form, if any.
   *
   * Rendered inside this modal rather than pushed as a route: the post form
   * navigates to /add/draw, but a full-screen Modal sits above the navigator,
   * so a pushed screen would open behind it — and dismissing this modal to
   * get out of the way would take the half-filled form with it.
   */
  const [picker, setPicker] = useState<"polygon" | "pin" | null>(null);

  /**
   * Photos, seeded with the ones already on the listing so the grid opens
   * showing them. Tiles start as `existing`: they are already uploaded, and
   * removing one only drops it from the list sent back.
   */
  const {
    images,
    pickAndUpload,
    remove: removeImage,
    retry: retryImage,
    reorder: reorderImages,
    toPayload: imagePayload,
    isUploading,
  } = useImageUpload(
    listing.images.map((img) => ({
      url: img.url,
      thumbUrl: img.thumbUrl,
      width: img.width ?? 0,
      height: img.height ?? 0,
    })),
  );

  const [category, setCategory] = useState<PropertyCategory>(listing.category);
  const [properties, setProperties] = useState<string[]>(
    listing.properties ?? [],
  );
  const [repairOpen, setRepairOpen] = useState(false);

  const primaryOffer = listing.offers?.[0];
  const initialPurpose = primaryOffer?.purpose ?? "SALE";
  const initialCurrency = (primaryOffer?.currency as Currency) ?? "USD";
  const initialPrice = primaryOffer?.price
    ? String(Math.round(Number(primaryOffer.price)))
    : "";

  const schema = useMemo(() => makeSchema(t), [t]);

  const {
    control,
    handleSubmit,
    setValue,
    clearErrors,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      purpose: initialPurpose,
      currency: initialCurrency,
      title: listing.title ?? "",
      rooms: listing.rooms != null ? String(listing.rooms) : "",
      sellerType: listing.sellerType ?? "",
      buildingType: listing.buildingType ?? "",
      repairType: listing.repairType ?? "",
      price: initialPrice,
      hasFloors:
        listing.floor != null || listing.totalFloors != null ? "yes" : "no",
      floor: listing.floor != null ? String(listing.floor) : "",
      totalFloors:
        listing.totalFloors != null ? String(listing.totalFloors) : "",
      address: listing.address ?? "",
      areaM2: listing.areaM2 ? String(listing.areaM2) : "",
      // Stored as +998XXXXXXXXX; the field owns the prefix and the spacing.
      phone: formatUzPhoneInput(listing.contactPhone ?? ""),
      description: listing.descriptionText ?? "",
    },
  });

  const purpose = useWatch({ control, name: "purpose" });
  const offerCurrency = useWatch({ control, name: "currency" });

  const categoryOptions = useMemo<SelectGridOption<PropertyCategory>[]>(
    () =>
      categories.map((c) => ({
        value: c.slug,
        label: nameOf(c.slug),
        icon: iconOf(c.slug),
      })),
    [categories, nameOf, iconOf],
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

  const sellerTypeOptions = useMemo<SelectGridOption<SellerType>[]>(
    () =>
      SELLER_TYPES.map((value) => ({
        value,
        label: t(SELLER_TYPE_LABELS[value]),
        icon: SELLER_TYPE_ICONS[value],
      })),
    [t],
  );

  const buildingTypeOptions = useMemo<SelectGridOption<BuildingType>[]>(
    () =>
      BUILDING_TYPES.map((value) => ({
        value,
        label: t(BUILDING_TYPE_LABELS[value]),
        icon: BUILDING_TYPE_ICONS[value],
      })),
    [t],
  );

  const repairOptions = useMemo<Option<RepairType | "">[]>(
    () =>
      REPAIR_TYPES.map((value) => ({ value, label: t(REPAIR_LABELS[value]) })),
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

  const showFloors = canHaveFloors(category);
  const showBuildingType = canHaveBuildingType(category);
  const showRepairType = canHaveRepairType(category);
  const floorsDeclared = useWatch({ control, name: "hasFloors" }) === "yes";

  const resetFloorFields = () => {
    setValue("floor", "");
    setValue("totalFloors", "");
    clearErrors(["floor", "totalFloors"]);
  };

  const changeCategory = (next: PropertyCategory) => {
    setCategory(next);
    if (!canHaveBuildingType(next)) setValue("buildingType", "");
    if (!canHaveRepairType(next)) setValue("repairType", "");

    if (canHaveFloors(next) === showFloors) return;
    setValue("hasFloors", canHaveFloors(next) ? "yes" : "no");
    resetFloorFields();
  };

  // A failed check paints a message under its field, which may be scrolled
  // far out of view — so say what stopped the save where it cannot be missed.
  const onInvalid = (errs: FieldErrors<FormData>) => {
    const first = Object.values(errs).find((e) => e?.message);
    toast.error(String(first?.message ?? t("validation.required")));
  };

  const pricePeriod =
    purpose === "RENT_MONTHLY"
      ? ` / ${t("add.perMonth")}`
      : purpose === "RENT_DAILY"
        ? ` / ${t("add.perDay")}`
        : "";

  const hasBoundary = polygon.length >= MIN_POLYGON_POINTS;

  /** The photo list as it stands, in the shape the server stores. */
  const nextImages = imagePayload();
  /**
   * Whether the photos actually moved.
   *
   * Compared by url in order, because that is what the server diffs on: a
   * reorder matters, a no-op does not, and sending an unchanged list makes
   * it delete and recreate every row and queue the old files for deletion.
   */
  const imagesChanged =
    nextImages.length !== listing.images.length ||
    nextImages.some((img, i) => img.url !== listing.images[i]?.url);

  const onSubmit = (d: FormData) => {
    const description = d.description?.trim();
    const sendFloors = showFloors && d.hasFloors === "yes";

    // Exactly one of the two, chosen by the toggle — the same rule the post
    // form follows and the server enforces. Unchanged geometry sends
    // neither, so a plain price edit does not rewrite the parcel.
    const ring = locMode === "POLYGON" ? polygon : [];
    const sendRing = locMode === "POLYGON" && ring.length >= MIN_POLYGON_POINTS;
    const coordinates: [number, number][][] | undefined = sendRing
      ? [closeRing(ring)]
      : undefined;
    const point: [number, number] | undefined =
      !sendRing && locMode === "PIN" && pin ? pin : undefined;

    updateMutation.mutate(
      {
        category,
        title: d.title.trim(),
        rooms: d.rooms ? Number(d.rooms) : undefined,
        sellerType: d.sellerType ? (d.sellerType as SellerType) : undefined,
        // Only answers the current category asks — the server refuses the rest.
        buildingType:
          showBuildingType && d.buildingType
            ? (d.buildingType as BuildingType)
            : undefined,
        repairType:
          showRepairType && d.repairType
            ? (d.repairType as RepairType)
            : undefined,
        floor: sendFloors && d.floor ? Number(d.floor) : null,
        totalFloors: sendFloors && d.totalFloors ? Number(d.totalFloors) : null,
        address: d.address?.trim() || undefined,
        properties: properties.length ? properties : [],
        contactPhone: d.phone?.trim() ? normalizePhone(d.phone) : undefined,
        descriptionHtml: description ? textToHtml(description) : undefined,
        areaM2: d.areaM2 ? Number(d.areaM2) : undefined,
        coordinates,
        point,
        images: imagesChanged ? nextImages : undefined,
        offers: [
          {
            purpose: d.purpose,
            price: Number(d.price),
            currency: d.currency,
          },
        ],
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  };

  return (
    <Animated.View
      entering={
        !reduceMotion
          ? SlideInDown.springify().damping(20).stiffness(180)
          : undefined
      }
      accessibilityViewIsModal
      style={{
        maxHeight: "92%",
        backgroundColor: colors.surface,
        borderTopLeftRadius: radii.xxl,
        borderTopRightRadius: radii.xxl,
        borderWidth: 1,
        borderColor: colors.border,
        paddingTop: spacing.sm,
        ...shadow.raised,
      }}
    >
      {/* Grabber bar */}
      <View
        style={{
          alignSelf: "center",
          width: 44,
          height: 4,
          borderRadius: radii.pill,
          backgroundColor: colors.borderStrong,
          marginBottom: spacing.sm,
        }}
      />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={text.heading}>{t("listings.editListing")}</Text>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          style={({ pressed }) => ({
            width: sizing.controlSm,
            height: sizing.controlSm,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
          })}
        >
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Form Content */}
      <ScrollView
        // flexShrink: the panel is capped at 92% of the screen, and without
        // this the ScrollView sizes to its content, overflows that cap and
        // pushes the sticky footer off the bottom — on a long form the Save
        // button simply is not on screen.
        style={{ flexShrink: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Purpose */}
        <View style={{ gap: spacing.xs }}>
          <SegmentedControl
            size="md"
            segments={purposeTabs}
            value={purpose}
            onChange={(next) => {
              setValue("purpose", next);
              clearErrors("price");
            }}
          />
        </View>

        {/* Category */}
        <Section title={t("add.category")}>
          {categoriesLoading ? (
            <ActivityIndicator />
          ) : (
            <SelectGrid
              options={categoryOptions}
              value={category}
              onChange={changeCategory}
            />
          )}
        </Section>

        {/* Seller Type */}
        <Section title={t("add.sellerTypeTitle")}>
          <Controller
            control={control}
            name="sellerType"
            render={({ field: { value, onChange } }) => (
              <SelectGrid
                options={sellerTypeOptions}
                value={value || undefined}
                columns={2}
                onChange={onChange}
              />
            )}
          />
        </Section>

        {/* Building Type */}
        {showBuildingType ? (
          <Section title={t("add.buildingTypeTitle")}>
            <Controller
              control={control}
              name="buildingType"
              render={({ field: { value, onChange } }) => (
                <SelectGrid
                  options={buildingTypeOptions}
                  value={value || undefined}
                  columns={2}
                  onChange={onChange}
                />
              )}
            />
          </Section>
        ) : null}

        {/* Repair Type */}
        {showRepairType ? (
          <Section title={t("add.repairTitle")}>
            <Controller
              control={control}
              name="repairType"
              render={({ field: { value, onChange } }) => (
                <>
                  <Pressable
                    onPress={() => setRepairOpen(true)}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      height: sizing.control,
                      paddingHorizontal: spacing.md,
                      borderRadius: radii.lg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: pressed
                        ? colors.surfaceRaised
                        : colors.surface,
                    })}
                  >
                    <Ionicons
                      name="construct-outline"
                      size={18}
                      color={colors.textMuted}
                    />
                    <Text
                      style={{
                        ...text.body,
                        flex: 1,
                        color: value ? colors.text : colors.textFaint,
                      }}
                    >
                      {value
                        ? t(REPAIR_LABELS[value as RepairType])
                        : t("add.repairPlaceholder")}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={colors.textFaint}
                    />
                  </Pressable>

                  <SelectSheet
                    visible={repairOpen}
                    title={t("add.repairTitle")}
                    options={repairOptions}
                    value={value}
                    onSelect={onChange}
                    onClose={() => setRepairOpen(false)}
                  />
                </>
              )}
            />
          </Section>
        ) : null}

        {/* Title */}
        <Controller
          control={control}
          name="title"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t("add.listingTitle")}
              placeholder={t("add.listingTitlePlaceholder")}
              maxLength={TITLE_MAX}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.title?.message}
            />
          )}
        />

        {/* Price & Currency */}
        <View style={{ gap: spacing.xs }}>
          <SegmentedControl
            segments={[
              { value: "USD", label: "USD" },
              { value: "UZS", label: "UZS" },
            ]}
            value={offerCurrency}
            onChange={(next) => {
              setValue("currency", next);
              void trigger("price");
            }}
          />
        </View>

        <Controller
          control={control}
          name="price"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t(`add.priceLabels.${purpose}`)}
              placeholder={PRICE_PLACEHOLDERS[purpose][offerCurrency]}
              keyboardType="number-pad"
              maxLength={PRICE_MAX_DIGITS}
              suffix={
                (offerCurrency === "USD" ? "$" : t("listings.som")) +
                pricePeriod
              }
              value={value}
              onChangeText={(v) => onChange(onlyDigits(v))}
              onBlur={onBlur}
              error={errors.price?.message}
            />
          )}
        />

        {/* Rooms */}
        <Controller
          control={control}
          name="rooms"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t("add.rooms")}
              placeholder={t("add.roomsPlaceholder")}
              keyboardType="number-pad"
              value={value}
              onChangeText={(v) => onChange(onlyDigits(v))}
              onBlur={onBlur}
              error={errors.rooms?.message}
            />
          )}
        />

        {/* Area */}
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
              onChangeText={(v) => onChange(decimalInput(v))}
              onBlur={onBlur}
              error={errors.areaM2?.message}
            />
          )}
        />

        {/* Floors */}
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
                      if (next === "no") resetFloorFields();
                    }}
                  />
                )}
              />

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
                          onChangeText={(v) => onChange(onlyDigits(v))}
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
                          onChangeText={(v) => onChange(onlyDigits(v))}
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

        {/* Address */}
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

        {/* Coordinates */}
        {/* The same choice the post form offers, and the same pickers —
            typed coordinates were the only way to move a listing before,
            which meant an owner could not fix a boundary at all. */}
        <Section title={t("add.location")}>
          <Card>
            <View style={{ gap: spacing.md }}>
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
                    ? // The numbers, not just "a pin is set": on a listing
                      // that already had one, moving it changed nothing on
                      // this line, so a correct save looked like no save.
                      t("add.pinAt", {
                        lat: pin[1].toFixed(5),
                        lng: pin[0].toFixed(5),
                      })
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
                  setPicker(locMode === "POLYGON" ? "polygon" : "pin")
                }
              />
            </View>
          </Card>
        </Section>

        {/* Photos, including the ones already on the listing: add, remove,
            reorder. The first is the cover, as everywhere else. */}
        <ImagePickerGrid
          images={images}
          onAdd={pickAndUpload}
          onRemove={removeImage}
          onRetry={retryImage}
          onReorder={reorderImages}
        />

        {/* Contact Phone */}
        <Controller
          control={control}
          name="phone"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t("add.phone")}
              placeholder={t("add.phonePlaceholder")}
              icon="call-outline"
              // Masked and prefixed, as on the add form and the sign-in screen.
              prefix="+998"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              maxLength={12}
              value={value}
              onChangeText={(v) => onChange(formatUzPhoneInput(v))}
              onBlur={onBlur}
              error={errors.phone?.message}
            />
          )}
        />

        {/* Description */}
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

        {/* Properties / Amenities */}
        {amenities.length > 0 ? (
          <Section title={t("add.propertiesTitle")}>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
              }}
            >
              {amenities.map(({ key }) => (
                <Chip
                  key={key}
                  label={amenityName(key)}
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
        ) : null}
      </ScrollView>

      {/* Sticky Footer */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <View style={{ flex: 1 }}>
          <Button
            title={t("common.cancel")}
            variant="ghost"
            onPress={onClose}
            disabled={updateMutation.isPending}
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            title={isUploading ? t("images.uploading") : t("common.save")}
            variant="primary"
            onPress={handleSubmit(onSubmit, onInvalid)}
            loading={updateMutation.isPending}
            // A half-uploaded photo would be dropped from the payload and
            // silently lost, so Save waits for the uploads to land.
            disabled={isUploading}
          />
        </View>
      </View>

      {/* The map, over the form rather than beside it. Absolute inside this
          sheet, so the form underneath keeps every field it had — navigating
          to /add/draw the way the post form does would open behind this
          modal, and dismissing the modal to make room would throw the edit
          away. */}
      {picker ? (
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: colors.bg,
          }}
        >
          {picker === "polygon" ? (
            <PolygonPicker
              initial={polygon}
              onCancel={() => setPicker(null)}
              onSave={(points) => {
                setPolygon(points);
                // One location per listing: taking the boundary drops the
                // pin, exactly as the post form does.
                setPin(null);
                setLocMode("POLYGON");
                setPicker(null);
              }}
            />
          ) : (
            <PinPicker
              initial={pin}
              onCancel={() => setPicker(null)}
              onSave={(point) => {
                setPin(point);
                setPolygon([]);
                setLocMode("PIN");
                setPicker(null);
              }}
            />
          )}
        </View>
      ) : null}
    </Animated.View>
  );
}

export function ListingEditModal({
  listing,
  visible,
  onClose,
}: ListingEditModalProps) {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Both bars, not just the top one. statusBarTranslucent alone leaves
      // the modal window stopping ABOVE the navigation bar, so a sheet that
      // anchors its footer to the bottom has that footer clipped by the
      // system strip — and the dim never reaches it either, so whatever is
      // behind shows through at full brightness. Android is edge-to-edge
      // from targetSdk 35, which makes this the matching half of a pair.
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: colors.overlay,
        }}
      >
        <Pressable
          style={{ position: "absolute", inset: 0 }}
          accessibilityElementsHidden
          importantForAccessibility="no"
          onPress={onClose}
        />
        <ListingEditContent
          key={listing.id}
          listing={listing}
          onClose={onClose}
        />
      </GestureHandlerRootView>
    </Modal>
  );
}
