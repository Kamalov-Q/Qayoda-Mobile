import { useMemo, useState } from "react";
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
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
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
import { textToHtml } from "../utils/format";
import { PURPOSE_ICONS } from "../utils/icons";

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

const PHONE = /^\+?[\d\s()-]{7,20}$/;
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

const phoneDigitsOk = (v: string) => {
  const digits = v.replace(/\D/g, "");
  if (digits.startsWith("998")) return digits.length === 12;
  return digits.length >= 9 && digits.length <= 15;
};

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
      latitude: z
        .string()
        .trim()
        .refine(
          (v) =>
            !v ||
            (!isNaN(Number(v)) && Number(v) >= -90 && Number(v) <= 90),
          t("validation.numbersOnly"),
        )
        .optional(),
      longitude: z
        .string()
        .trim()
        .refine(
          (v) =>
            !v ||
            (!isNaN(Number(v)) && Number(v) >= -180 && Number(v) <= 180),
          t("validation.numbersOnly"),
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
      phone: listing.contactPhone ?? "",
      description: listing.descriptionText ?? "",
      latitude:
        listing.centroid?.coordinates && listing.centroid.coordinates[1] != null
          ? String(listing.centroid.coordinates[1])
          : "",
      longitude:
        listing.centroid?.coordinates && listing.centroid.coordinates[0] != null
          ? String(listing.centroid.coordinates[0])
          : "",
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

  const pricePeriod =
    purpose === "RENT_MONTHLY"
      ? ` / ${t("add.perMonth")}`
      : purpose === "RENT_DAILY"
        ? ` / ${t("add.perDay")}`
        : "";

  const onSubmit = (d: FormData) => {
    const description = d.description?.trim();
    const sendFloors = showFloors && d.hasFloors === "yes";
    const lat = d.latitude?.trim();
    const lng = d.longitude?.trim();
    const point: [number, number] | undefined =
      lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))
        ? [Number(lng), Number(lat)]
        : undefined;

    updateMutation.mutate(
      {
        category,
        title: d.title.trim(),
        rooms: d.rooms ? Number(d.rooms) : undefined,
        sellerType: d.sellerType ? (d.sellerType as SellerType) : undefined,
        buildingType: d.buildingType
          ? (d.buildingType as BuildingType)
          : undefined,
        repairType: d.repairType ? (d.repairType as RepairType) : undefined,
        floor: sendFloors && d.floor ? Number(d.floor) : null,
        totalFloors:
          sendFloors && d.totalFloors ? Number(d.totalFloors) : null,
        address: d.address?.trim() || undefined,
        properties: properties.length ? properties : [],
        contactPhone: d.phone?.trim() || undefined,
        descriptionHtml: description ? textToHtml(description) : undefined,
        areaM2: d.areaM2 ? Number(d.areaM2) : undefined,
        point,
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
            backgroundColor: pressed
              ? colors.surfaceRaised
              : colors.surface,
          })}
        >
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Form Content */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
              onChangeText={onChange}
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
              onChangeText={onChange}
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
              onChangeText={onChange}
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
                      render={({
                        field: { value, onChange, onBlur },
                      }) => (
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
                      render={({
                        field: { value, onChange, onBlur },
                      }) => (
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
        <Section title={t("add.coordinates")}>
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
                name="latitude"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextField
                    label={t("add.latitude")}
                    placeholder={t("add.latitudePlaceholder")}
                    keyboardType="numeric"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.latitude?.message}
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="longitude"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextField
                    label={t("add.longitude")}
                    placeholder={t("add.longitudePlaceholder")}
                    keyboardType="numeric"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.longitude?.message}
                  />
                )}
              />
            </View>
          </View>
        </Section>

        {/* Contact Phone */}
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
            title={t("common.save")}
            variant="primary"
            onPress={handleSubmit(onSubmit)}
            loading={updateMutation.isPending}
          />
        </View>
      </View>
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
