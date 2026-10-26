// app/(tabs)/home.tsx
// The landing tab IS the feed. Browsing was a second tab called Sotuv, with
// a home screen in front of it that had to invent reasons to exist — a
// greeting, some counters, a row of categories that only forwarded to the
// tab behind it. This is that tab, opened directly.
//
// The story tray used to ride on top of the feed. Stories are gone from the
// app entirely — the Videos tab is where listings get advertised now.
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { CompleteProfileGate } from "@/src/features/profile/components/CompleteProfileGate";
import {
  Text,
  View,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
// ViewToken left react-native's public types in 0.88; the list
// implementation it belongs to is where it lives now.
import type { ListViewToken as ViewToken } from "@react-native/virtualized-lists";
import { router, useIsFocused } from "expo-router";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  EmptyState,
  Section,
  ChipGroup,
  FilterSheet,
  FilterButton,
  PriceRangeFilter,
  SegmentedControl,
  Chip,
  DebouncedTextField,
  Skeleton,
  BrandGlyph,
  TAB_EDGES,
} from "../../src/components/ui";
import { useFeedVisibilityStore } from "../../src/features/listings/utils/feed-visibility";
import { HomeShortcuts } from "../../src/features/listings/components/HomeShortcuts";
import { spacing, radii, sizing, type, weight } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT } from "../../src/i18n";
import {
  BBox,
  Listing,
  OfferPurpose,
} from "../../src/features/listings/api/listings.api";
import { useDebouncedValue } from "../../src/lib/use-debounced-value";
import { useUnreadNotifications } from "../../src/features/notifications/hooks/useNotifications";
import {
  ALL_ICON,
  PURPOSE_ICONS,
} from "../../src/features/listings/utils/icons";
import { useCategories } from "../../src/features/listings/hooks/useCategories";
import { useMapViewport } from "../../src/features/listings/hooks/useMapViewport";
import { peekLocation } from "../../src/features/listings/hooks/useMyLocation";
import { useListingsFeed } from "../../src/features/listings/hooks/useListingsFeed";
import { useRates } from "../../src/features/listings/hooks/useRates";
import { usePreferences } from "../../src/lib/preferences";
import {
  usePriceFormatter,
  useRelativeDate,
  useSpecsFormatter,
} from "../../src/features/listings/utils/format";
import { ListingCardBase } from "../../src/features/listings/components/ListingCardBase";
import { ListingGridCard } from "../../src/features/listings/components/ListingGridCard";
import {
  TopBadge,
  isTop,
} from "../../src/features/tariffs/components/TopBadge";
import {
  ListingsMap,
  type ListingsMapHandle,
  type RadiusCircle,
} from "../../src/features/map/ListingsMap";
import { RadiusPanel } from "../../src/features/map/RadiusPanel";
import { RadiusFilterRow } from "../../src/features/map/RadiusFilterRow";
import {
  nearestStep,
  type RadiusStep,
} from "../../src/features/map/RadiusSlider";

/**
 * Width of a promoted card on the VIP shelf.
 *
 * Wide enough that the next one peeks in and says the row scrolls, and that
 * a price and a street fit on the card without clipping.
 */
const VIP_CARD_WIDTH = 230;

// What the radius panel occupies once it is open, so the map's own bottom
// controls step above it instead of hiding underneath.
const RADIUS_PANEL_HEIGHT = 196;

/** Where the circle starts: a fifteen-minute walk, which is the distance
 *  people actually mean by "near here" before they start adjusting. */
const DEFAULT_RADIUS_M = 1_500;

/** The centre a fresh circle takes — whatever the camera is looking at. */
const bboxCenter = (b: BBox): [number, number] => [
  (b.west + b.east) / 2,
  (b.south + b.north) / 2,
];

/**
 * What the feed looks like before it arrives.
 *
 * A bare centred spinner on an otherwise empty page reads as "nothing here"
 * rather than "on its way" — and it tells the eye nothing about the shape
 * that is coming, so the whole screen jumps when the cards land. These are
 * the same proportions as the real cards in both layouts.
 */
function FeedSkeleton({ grid }: { grid: boolean }) {
  const { colors } = useTheme();
  const cards = grid ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3];
  // The real cards' photo heights — ListingGridCard's PHOTO_HEIGHT and the
  // full card's. A placeholder that is the wrong height still makes the feed
  // jump when the data lands, which is the whole thing this exists to avoid.
  const media = grid ? 148 : 190;

  return (
    <View
      // The list announces its own loading state; these are decoration.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        padding: spacing.md,
        flexDirection: "row",
        flexWrap: "wrap",
        rowGap: spacing.md,
        columnGap: spacing.md,
      }}
    >
      {cards.map((i) => (
        <View
          key={i}
          style={{
            // flexBasis + grow rather than width: "48%", which is what made
            // this a single column. Two 48% children plus a 16pt gap come to
            // a hair OVER the row, so every card wrapped onto its own line.
            // At 45% two fit with room to spare and grow to fill it, while a
            // third cannot (135% > 100%) — so it is exactly two per row at
            // any width, with no arithmetic to get wrong.
            flexBasis: grid ? "45%" : "100%",
            flexGrow: 1,
            // The card's own shell, so the skeleton has the real card's
            // edges instead of floating blocks on the background.
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          {/* Photo, with the price chip that sits on it. */}
          <View>
            <Skeleton height={media} radius={0} />
            <View
              style={{
                position: "absolute",
                left: spacing.sm,
                bottom: spacing.sm,
              }}
            >
              <Skeleton width={72} height={22} radius={radii.pill} />
            </View>
          </View>

          {/* Body: title, specs, address — the three lines every card has,
              at the widths they actually tend to run to. */}
          <View style={{ padding: spacing.md, gap: spacing.sm }}>
            <Skeleton height={15} width="85%" />
            <Skeleton height={12} width="55%" />
            <Skeleton height={12} width="70%" />
          </View>

          {/* The action row, behind its own divider like the real one. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Skeleton width={22} height={14} radius={radii.sm} />
            <Skeleton width={22} height={14} radius={radii.sm} />
            <Skeleton width={22} height={14} radius={radii.sm} />
            <View style={{ flex: 1 }} />
            <Skeleton width={28} height={14} radius={radii.sm} />
          </View>
        </View>
      ))}
    </View>
  );
}

// The list/grid row model, derived from the feed endpoint's full listings.
interface FeedItem {
  id: string;
  price: string | null;
  currency: string;
  thumbUrl: string | null;
  title: string | null;
  rooms: number | null;
  areaM2: string | null;
  address: string | null;
  publishedAt: string | null;
  ratingAvg: number;
  ratingCount: number;
  /** Every photo, cover first — the card slides through them. */
  photos: { thumbUrl: string; url: string }[];
  commentCount: number;
  /** Distinct viewers — the eye on the card's action row. */
  viewCount: number;
  /**
   * Kept so the TOP mark survives the trip from Listing to this slim row.
   * Dropping it here was why a promoted listing showed the badge on the home
   * feed (which renders ListingCard) but not in this tab's list or grid.
   */
  promotedUntil: string | null;
}

function toFeedItem(l: Listing, purpose: OfferPurpose): FeedItem {
  // The feed only returns listings with a matching active offer, but the
  // fallback keeps a stale cache entry from crashing the row.
  const offer =
    l.offers.find((o) => o.purpose === purpose && o.isActive) ?? l.offers[0];
  const image = l.images.find((i) => i.isPrimary) ?? l.images[0];
  return {
    id: l.id,
    price: offer?.price ?? null,
    currency: offer?.currency ?? "USD",
    thumbUrl: image?.thumbUrl ?? null,
    title: l.title,
    rooms: l.rooms,
    areaM2: l.areaM2,
    address: l.address,
    publishedAt: l.publishedAt ?? l.createdAt,
    ratingAvg: l.ratingAvg,
    ratingCount: l.ratingCount,
    photos: image
      ? [image, ...l.images.filter((i) => i.id !== image.id)].map((i) => ({
          thumbUrl: i.thumbUrl,
          url: i.url,
        }))
      : [],
    commentCount: l.commentCount,
    viewCount: l.viewCount,
    promotedUntil: l.promotedUntil,
  };
}

// Purpose is the one filter the API itself understands, so it re-queries;
// sorting is applied to whatever came back.
const PURPOSES = [
  "SALE",
  "RENT_MONTHLY",
  "RENT_DAILY",
] as const satisfies readonly OfferPurpose[];

type Sort = "default" | "priceAsc" | "priceDesc";
type ViewMode = "map" | "list" | "grid";

/**
 * The unfiltered state; every other value is a category slug sent to the
 * server as-is. Lower-case on purpose: slugs start with an upper-case letter,
 * so no admin-created category can ever collide with it.
 */
const ALL = "__all__";
type CategoryFilter = string;

/**
 * The fills the pinned bar's controls use.
 *
 * That bar floats over the feed now rather than sitting in a band of its
 * own, so its buttons are on the page colour at the top of the list and on
 * a photograph a scroll later. Translucent fills read as one thing in both
 * places and let the cards travel visibly underneath — the glass pill,
 * without the blur view this project has no native module for.
 */
/**
 * The brand chip's fade.
 *
 * It is the only thing in the floating bar that is not a control, so it is
 * the only thing that can afford to get out of the way: past the first
 * screenful the feed is what the reader is here for, and a logo pinned at
 * full strength over it is an advert for an app they have already opened.
 * The three icons keep their opacity — a navigation control that fades is a
 * navigation control you hesitate over.
 */
/** Stable: FlatList rejects a viewabilityConfig that changes identity. */
const VIEWABILITY = { itemVisiblePercentThreshold: 40 } as const;

const LOGO_FADE_DISTANCE = 120;
/**
 * 1 = no fade. It was 0.32, which on the dark glass chip over a dark feed is
 * not "out of the way" but gone — the mark read as a rendering bug rather
 * than as restraint. The interpolation below is left in place so this is the
 * single knob: drop it to ~0.7 for a fade that is still legible.
 */
const LOGO_FADE_TO = 1;

const GLASS = {
  dark: { fill: "rgba(14,42,48,0.78)", pressed: "rgba(21,56,63,0.92)" },
  light: { fill: "rgba(255,255,255,0.82)", pressed: "rgba(237,243,242,0.95)" },
} as const;

/**
 * One control in the pinned bar.
 *
 * Same 46pt target throughout, so the three read as one set rather than
 * three borrowed shapes.
 */
const HeaderIcon = memo(function HeaderIcon({
  icon,
  accessibilityLabel,
  active,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  /** Tints the glyph and its border — something is switched on behind it. */
  active?: boolean;
  /** A count worth a dot. Zero and undefined both draw nothing. */
  badge?: number;
  onPress: () => void;
}) {
  const { colors, scheme } = useTheme();
  const glass = GLASS[scheme];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: sizing.controlMd,
        height: sizing.controlMd,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: active ? colors.primaryBorder : colors.border,
        backgroundColor: active
          ? colors.primarySoft
          : pressed
            ? glass.pressed
            : glass.fill,
      })}
    >
      <Ionicons
        name={icon}
        size={20}
        color={active ? colors.primary : colors.textMuted}
      />

      {/* A dot, not a number, once past nine: the exact count of unread
          notifications is not a thing anybody navigates by, and "99+" on a
          20pt glyph is a smudge. */}
      {badge ? (
        <View
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 3,
            borderRadius: radii.pill,
            backgroundColor: colors.danger,
            alignItems: "center",
            justifyContent: "center",
            // A ring in the chip's own colour, so the dot reads as sitting
            // on the button rather than behind it.
            borderWidth: 1.5,
            borderColor: glass.fill,
          }}
        >
          <Text
            style={{
              ...type.caption,
              fontSize: 10,
              lineHeight: 12,
              ...weight("800"),
              color: colors.onPrimary,
            }}
          >
            {badge > 9 ? "9+" : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

export default function HomeScreen() {
  const { colors, text, shadow } = useTheme();
  const t = useT();
  const [purpose, setPurpose] = useState<OfferPurpose>("SALE");
  const [category, setCategory] = useState<CategoryFilter>(ALL);
  const { categories, nameOf, iconOf } = useCategories();
  const [sort, setSort] = useState<Sort>("default");
  // Kept as strings: an empty field means "no bound", which 0 cannot express.
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  /**
   * The ADDRESS filter and the SEARCH box, as the screen sees them: already
   * settled. The fields themselves hold what is being typed (see
   * DebouncedTextField), so a keystroke no longer re-renders the map, the
   * feed and the filter sheet along with the letter that caused it.
   */
  const [address, setAddress] = useState("");
  /** Bumped to clear the address field, which owns its own text. */
  const [fieldGeneration, setFieldGeneration] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // A listing's preview card is up on the map: the floating count steps aside
  // so it doesn't sit on the card's "view details" link (it's in the header too).
  const [cardOpen, setCardOpen] = useState(false);
  // One search box drives both worlds: the feed's title+address search, and
  // the map's server-side address narrowing.
  const [query, setQuery] = useState(""); // settled, not per keystroke
  /**
   * Whether the search field is out.
   *
   * Search is an icon in the pinned bar rather than a permanent box in the
   * feed: it was costing a row of the first screenful to a field most
   * sessions never touch, and the box scrolled away from the people who did
   * use it. Opening it drops the field into the bar, where it stays put.
   */
  /**
   * How tall the pinned bar is, so the feed can start below it.
   *
   * The bar floats over the list rather than taking a band out of the
   * screen, which is the only way the cards can be seen travelling under
   * it. Measured rather than assumed: it grows a row when search opens.
   */
  const [barHeight, setBarHeight] = useState(60);
  /**
   * How far the feed has travelled, kept on the UI thread.
   *
   * A shared value rather than React state on purpose: this updates on every
   * frame of a scroll, and routing that through a re-render would repaint
   * the whole feed sixty times a second to move one logo's opacity.
   */
  // The dot on the bell. Polled, and free when nothing is unread.
  const unread = useUnreadNotifications();
  const scrollY = useSharedValue(0);
  const onFeedScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const logoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, LOGO_FADE_DISTANCE],
      [1, LOGO_FADE_TO],
      Extrapolation.CLAMP,
    ),
  }));
  /**
   * The screen opens on listings, not on a map.
   *
   * It used to be map-first, back when this was a separate "Sotuv" tab you
   * chose to enter. As the landing screen that is the wrong first move: a
   * map asks you to know which part of the city you are interested in before
   * it will show you a single price, and answers "what is for sale" with a
   * field of pins. Two columns of real cards answer it directly, and the map
   * is a labelled button away for the moment the question becomes "where".
   */
  const [view, setView] = useState<ViewMode>("grid");

  /**
   * Whether the map has ever been opened this session.
   *
   * It is built on first use and kept after that, so returning to it finds
   * the camera where it was left. Before that it is not mounted at all: the
   * feed does not need it, and the screen no longer opens on it.
   */
  const [mapEverOpened, setMapEverOpened] = useState(false);

  /**
   * How tall the chrome floating over the map is.
   *
   * Measured and handed to the map so its own top-right cluster — zoom,
   * layer, radius — starts below the search box and the chip rows instead
   * of underneath them.
   */
  const [mapChromeHeight, setMapChromeHeight] = useState(0);

  /**
   * The applied search circle, and — separately — the one being adjusted.
   *
   * Two pieces of state on purpose: dragging the slider or the centre pin
   * must not refilter, or every stop of the track would fire a request and
   * redraw the map under the user's thumb. `draft` non-null IS "the panel is
   * open"; Apply copies it across, the X drops it.
   */
  const [radius, setRadius] = useState<{
    center: [number, number];
    radiusM: number;
  } | null>(null);
  const [radiusDraft, setRadiusDraft] = useState<{
    center: [number, number];
    radiusM: RadiusStep;
  } | null>(null);
  const mapRef = useRef<ListingsMapHandle>(null);
  /** The reader's position, read when the funnel opens — see setRadiusDistance. */
  const sheetCenter = useRef<[number, number] | null>(null);

  // Price bounds are typed in the viewer's display currency but travel in
  // USD — the server compares against the normalised column.
  const displayCurrency = usePreferences((s) => s.currency);
  const { data: rates } = useRates();
  const boundToUsd = useCallback(
    (v: string) => {
      if (!v) return undefined;
      const n = Number(v);
      if (!Number.isFinite(n)) return undefined;
      return displayCurrency === "UZS" && rates?.usdToUzs
        ? n / rates.usdToUzs
        : n;
    },
    [displayCurrency, rates],
  );
  const debouncedMin = useDebouncedValue(minPrice);
  const debouncedMax = useDebouncedValue(maxPrice);
  // The circle in the shape the API takes it. Only the applied one — the
  // draft never reaches a query — and debounced like every other filter that
  // can be dragged: the sheet's slider has fifteen stops, and querying each
  // one on the way past is fifteen requests for a number nobody stopped on.
  // The circle itself is drawn from `radius`, so it still follows the thumb.
  const debouncedRadius = useDebouncedValue(radius, 300);
  const radiusParams = useMemo(
    () =>
      debouncedRadius
        ? {
            centerLng: debouncedRadius.center[0],
            centerLat: debouncedRadius.center[1],
            radiusM: debouncedRadius.radiusM,
          }
        : null,
    [debouncedRadius],
  );

  const viewportFilters = useMemo(
    () => ({
      // Two different questions: the funnel's "Address" field narrows by
      // address, the search box searches title and address. They used to
      // collapse into one param, where whichever was typed last silently
      // replaced the other.
      address,
      q: query,
      category: category === ALL ? undefined : category,
      priceMin: boundToUsd(debouncedMin),
      priceMax: boundToUsd(debouncedMax),
      radius: radiusParams,
    }),
    [
      query,
      address,
      category,
      debouncedMin,
      debouncedMax,
      boundToUsd,
      radiusParams,
    ],
  );

  // Unfocused (a listing pushed on top, another tab active) → both queries
  // pause: no refetch can redraw what nobody sees.
  const isFocused = useIsFocused();

  // Only while the map is the thing on screen. The feed is its own query
  // and owes the viewport nothing, so fetching a screenful of geo-features
  // for a map nobody has opened was a request spent on every launch.
  const { data, isError, viewport, onRegionChange } = useMapViewport(
    purpose,
    viewportFilters,
    isFocused && view === "map",
  );

  // Category and price travel with the query, so the map shows exactly what
  // came back for the visible viewport.
  const visible = data;

  // The list and grid are NOT the viewport: they browse every active listing
  // through the feed endpoint, searched/sorted/filtered server-side. Only
  // fetched while one of them is actually on screen.
  const feed = useListingsFeed(
    {
      purpose,
      category: category === ALL ? undefined : category,
      priceMin: boundToUsd(debouncedMin),
      priceMax: boundToUsd(debouncedMax),
      q: query || undefined,
      // The funnel's address field reached the map and nothing else, so
      // switching to the list used to widen the search without saying so.
      address: address || undefined,
      // The list is not the viewport, but it IS the same circle — switching
      // to it must not silently drop the radius the map is drawing.
      radius: radiusParams,
      sort: sort === "default" ? "newest" : sort,
    },
    isFocused && view !== "map",
  );
  const feedItems = useMemo(
    () => (feed.data?.pages.flat() ?? []).map((l) => toFeedItem(l, purpose)),
    [feed.data, purpose],
  );

  /**
   * The promoted listings among the ones already loaded.
   *
   * There is no "give me the VIPs" endpoint, so this is honest about what it
   * is: the promoted entries of the pages in hand. A page with none simply
   * does not draw the shelf.
   */
  const vipItems = useMemo(
    () => feedItems.filter((i) => isTop(i.promotedUntil)),
    [feedItems],
  );

  const shownCount =
    view === "map" ? (visible?.features.length ?? 0) : feedItems.length;

  /**
   * Whether there is a number worth printing.
   *
   * Tied to having data rather than to `isLoading`: the viewport query keeps
   * the previous results while a new search lands, so the markers stay on
   * screen — and a count that blinks out from under them, taking a line of
   * the header with it, makes a 300ms fetch look like a stall.
   */
  const hasCount = !isError && (view === "map" ? !!visible : !feed.isLoading);

  const purposeOptions = useMemo(
    () =>
      PURPOSES.map((value) => ({
        value,
        label: t(`purposes.${value}`),
        icon: PURPOSE_ICONS[value],
      })),
    [t],
  );
  /**
   * The same three, for the segmented control at the top of the feed.
   *
   * Short labels because the track splits evenly in three and "Аренда на
   * месяц" truncates to "Аренда…" there; the full wording stays on the
   * chips in the filter sheet, which have the room for it.
   */
  const purposeSegments = useMemo(
    () =>
      PURPOSES.map((value) => ({
        value,
        label: t(`purposesShort.${value}`),
        icon: PURPOSE_ICONS[value],
      })),
    [t],
  );
  const sortOptions = useMemo(
    () =>
      [
        {
          value: "default",
          label: t("filters.sortDefault"),
          icon: "time-outline",
        },
        {
          value: "priceAsc",
          label: t("filters.sortPriceAsc"),
          icon: "trending-up-outline",
        },
        {
          value: "priceDesc",
          label: t("filters.sortPriceDesc"),
          icon: "trending-down-outline",
        },
      ] as const satisfies readonly {
        value: Sort;
        label: string;
        icon: keyof typeof Ionicons.glyphMap;
      }[],
    [t],
  );

  // Only the two list shapes. The map left this control when it stopped
  // being one of three equal views and became a place you go — it has a
  // labelled button of its own, and a labelled way back.
  /**
   * Grid, list, map — one control instead of three.
   *
   * The map used to be a labelled pill of its own next to a two-way
   * grid/list switch, which is two controls and a whole row for what is one
   * question: how do you want these shown. Icon-only: the row it sits in is
   * a caption, and three words there is a toolbar again.
   */
  const listViewOptions = useMemo(
    () =>
      [
        { value: "grid", icon: "grid-outline" },
        { value: "list", icon: "list-outline" },
        // No map here any more. This row answers "what shape should these
        // be", and a map is not a shape of a list — it is a different
        // question, and it gets the card at the top of the feed instead.
        // Map mode is still a ViewMode; HomeShortcuts is how you enter it.
      ] as const satisfies readonly {
        value: ViewMode;
        icon: keyof typeof Ionicons.glyphMap;
      }[],
    [],
  );

  const categoryOptions = useMemo(
    () => [
      { value: ALL, label: t("filters.allTypes"), icon: ALL_ICON },
      ...categories.map((c) => ({
        value: c.slug,
        label: nameOf(c.slug),
        icon: iconOf(c.slug),
      })),
    ],
    [t, categories, nameOf, iconOf],
  );

  /**
   * Which cards are on screen, for the photo strips.
   *
   * Written to a store, not to state: this fires on every scroll settle,
   * and re-rendering this screen each time would cost more than the timers
   * it switches off. FlatList also throws if the callback changes identity
   * between renders, so it is created once.
   */
  // useCallback with no deps, not a ref: FlatList needs one stable identity,
  // and reading `.current` during render is what makes the React Compiler
  // bail out of this whole screen — the same note intro.tsx carries.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      useFeedVisibilityStore.getState().setVisible(
        viewableItems
          .map((v) => (v.item as FeedItem | undefined)?.id)
          .filter((id): id is string => !!id),
      );
    },
    [],
  );

  const onPressItem = useCallback(
    (id: string) => router.push(`/listing/${id}`),
    [],
  );

  /**
   * Opens the panel on the applied circle, or on a fresh one.
   *
   * A new circle is centred on the reader — "within 2 km" means 2 km of where
   * they are, not of whatever corner of the map they last dragged into view.
   * Only if the device will say so without a prompt; otherwise the camera's
   * centre, which is the one place they HAVE pointed at. The camera then
   * moves to frame it, since their location may be off screen.
   */
  const openRadius = useCallback(async () => {
    setView("map");

    if (radius) {
      setRadiusDraft({
        center: radius.center,
        radiusM: nearestStep(radius.radiusM),
      });
      return;
    }

    const here = await peekLocation();
    const center: [number, number] = here
      ? [here.longitude, here.latitude]
      : bboxCenter(viewport.bbox);

    setRadiusDraft({ center, radiusM: DEFAULT_RADIUS_M });
    if (here) mapRef.current?.fitRadius(center, DEFAULT_RADIUS_M);
  }, [radius, viewport.bbox]);

  const applyRadius = useCallback(() => {
    if (!radiusDraft) return;
    const { center, radiusM } = radiusDraft;
    setRadiusDraft(null);
    // The last stop on the track is "everywhere", which is the absence of the
    // filter rather than a very large one.
    if (radiusM == null) {
      setRadius(null);
      return;
    }
    setRadius({ center, radiusM });
    // The map filters by the viewport too, so a circle wider than the screen
    // would hide half of what it just let through.
    mapRef.current?.fitRadius(center, radiusM);
  }, [radiusDraft]);

  /**
   * The sheet and the map panel edit the same circle from two places, and the
   * panel holds a draft the sheet knows nothing about. Rather than syncing
   * them, opening the sheet closes the panel: one editor at a time, and the
   * sheet's own row shows what the circle is set to.
   */
  /**
   * Closing the sheet frames whatever circle it set. The map filters by the
   * viewport as well as by the circle, so a radius drawn around the reader —
   * who may be off screen — would otherwise leave them looking at an empty
   * map with a count that says there is something to see.
   */
  const closeFilters = useCallback(() => {
    setFiltersOpen(false);
    if (radius) mapRef.current?.fitRadius(radius.center, radius.radiusM);
  }, [radius]);

  const openFilters = useCallback(() => {
    setRadiusDraft(null);
    setFiltersOpen(true);
    // Warmed here so the radius row has a centre ready the moment the slider
    // moves; null simply falls back to the camera.
    void peekLocation().then((here) => {
      sheetCenter.current = here ? [here.longitude, here.latitude] : null;
    });
  }, []);

  const clearRadius = useCallback(() => {
    setRadiusDraft(null);
    setRadius(null);
  }, []);

  /**
   * The sheet sets the distance and nothing else. A circle that does not
   * exist yet is centred on whatever the camera is looking at, which is the
   * only centre the reader has expressed an opinion about; the last stop on
   * the track is "everywhere", which is the absence of the filter.
   */
  const setRadiusDistance = useCallback(
    (radiusM: RadiusStep) => {
      if (radiusM == null) {
        setRadius(null);
        return;
      }
      setRadius((current) => ({
        // Same centre rule as the map panel: where they are if the device
        // will say so, else where the camera is looking. `sheetCenter` is
        // read once when the sheet opens, because a setState updater must
        // stay pure — it cannot await anything.
        center:
          current?.center ?? sheetCenter.current ?? bboxCenter(viewport.bbox),
        radiusM,
      }));
    },
    [viewport.bbox],
  );

  const toggleRadius = useCallback(() => {
    if (radiusDraft) setRadiusDraft(null);
    else void openRadius();
  }, [radiusDraft, openRadius]);

  // Adjusting the circle is a map gesture; leaving the map abandons it rather
  // than leaving a panel floating over a list with no pin to drag.
  const changeView = useCallback(
    (next: ViewMode) => {
      setView(next);
      setRadiusDraft(null);
      // `key={view}` remounts the list, which starts it back at the top — but
      // the shared value remembers where the OLD list was, so without this the
      // logo opens the new one already faded.
      //
      // Writing to a shared value is Reanimated's documented API and the whole
      // point of the type: it lives on the UI thread, outside anything React
      // owns or re-renders. The compiler's immutability rule cannot tell it
      // apart from state, so it is silenced here rather than worked around.
      // eslint-disable-next-line react-hooks/immutability
      scrollY.value = 0;
      // First trip to the map is what builds it; it stays mounted afterwards.
      if (next === "map") setMapEverOpened(true);
      // The shared value's identity never changes; it is listed to satisfy the
      // dependency rule, not because this could ever re-create the callback.
    },
    [scrollY],
  );

  const moveRadiusCenter = useCallback((center: [number, number]) => {
    setRadiusDraft((d) => (d ? { ...d, center } : d));
  }, []);

  const changeRadius = useCallback((radiusM: RadiusStep) => {
    setRadiusDraft((d) => (d ? { ...d, radiusM } : d));
  }, []);

  // Draft first: while the panel is open the map shows what Apply would do.
  const circle: RadiusCircle | null = useMemo(() => {
    if (radiusDraft)
      return {
        center: radiusDraft.center,
        radiusM: radiusDraft.radiusM,
        editable: true,
      };
    if (radius) return { center: radius.center, radiusM: radius.radiusM };
    return null;
  }, [radiusDraft, radius]);

  // Anything away from the defaults counts, so the badge matches what the user
  // would have to undo to see the plain feed again. The price pair counts once:
  // it is one control, however many of its two fields are filled.
  // Purpose and category count now as well. They used to have pills of their
  // own under the header, where their state was visible without opening
  // anything; with those gone the sheet is the only place they live, and a
  // filter nobody can see is exactly what the badge is for.
  const activeCount =
    (purpose !== "SALE" ? 1 : 0) +
    (category !== ALL ? 1 : 0) +
    (sort === "default" ? 0 : 1) +
    (minPrice || maxPrice ? 1 : 0) +
    (address.trim() ? 1 : 0) +
    // Counted even though it has its own pill: Reset clears it too, so the
    // badge would otherwise promise less than the button does.
    (radius ? 1 : 0);

  const resetFilters = useCallback(() => {
    setSort("default");
    setMinPrice("");
    setMaxPrice("");
    setAddress("");
    // The address field holds its own text; remounting it is what empties it.
    setFieldGeneration((n) => n + 1);
    clearRadius();
  }, [clearRadius]);


  /**
   * Everything above the listings, as the feed's own header.
   *
   * It scrolls away with the content rather than sitting in a fixed band:
   * the filters are things you set once and then read past, and a screen
   * that keeps them pinned spends a third of itself on controls nobody is
   * touching. Only the bar floating above it stays put.
   *
   * Three rows now, where there were four: the purpose chips wrapped onto
   * two lines, and the grid/list switch, the map pill and the funnel were a
   * row of outlined buttons for what the count line could carry.
   */
  const feedHeader = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      {/* The map, and the two things that are about people and clips rather
          than about property. Above the purpose switch because none of them
          are narrowed by it — they are ways OUT of this list, not ways to
          shape it. */}
      <HomeShortcuts onOpenMap={() => changeView("map")} />

      {/* Sale / monthly / nightly: the switch that decides what every price
          below it means, and so the first thing on the page. A segmented
          control rather than chips — as chips the three wrapped onto two
          lines on a phone, and a three-way choice is not worth two rows. */}
      <SegmentedControl
        segments={purposeSegments}
        value={purpose}
        onChange={setPurpose}
        size="lg"
      />

      {/* The categories, as a row that scrolls rather than one that wraps:
          there are more of them than fit, and wrapping pushed the listings
          another two rows down the page. */}
      <FlatList
        data={categoryOptions}
        keyExtractor={(c) => c.value}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -spacing.md }}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
        }}
        renderItem={({ item }) => (
          <Chip
            label={item.label}
            icon={item.icon}
            selected={item.value === category}
            onPress={() => setCategory(item.value)}
          />
        )}
      />

      {vipItems.length ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ ...text.label, marginLeft: spacing.xs }}>
            {t("listings.vipTitle")}
          </Text>
          {/* The promoted listings already in hand, given a shelf of their
              own. No separate endpoint behind it, so it simply does not
              appear on a page that happens to carry none. */}
          <FlatList
            data={vipItems}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -spacing.md }}
            contentContainerStyle={{
              paddingHorizontal: spacing.md,
              gap: spacing.md,
              paddingVertical: spacing.xs,
            }}
            renderItem={({ item }) => (
              <View style={{ width: VIP_CARD_WIDTH }}>
                <FeedRow
                  item={item}
                  purpose={purpose}
                  grid
                  onPress={onPressItem}
                />
              </View>
            )}
          />
        </View>
      ) : null}

      {/* What came back, and the two controls that act on it: one opens the
          funnel (where sorting lives, so it says the current order and
          carries the count of anything else switched on), one chooses how
          the results are drawn. Bare glyphs and text, not outlined pills —
          a row of bordered buttons is what made this screen read as a
          toolbar with a feed somewhere beneath it. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
        }}
      >
        <Text style={{ ...text.heading, flexShrink: 1 }} numberOfLines={1}>
          {t("listings.foundShort", { count: shownCount })}
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={openFilters}
          accessibilityRole="button"
          accessibilityLabel={t("filters.title")}
          hitSlop={10}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            flexShrink: 1,
            gap: spacing.xs,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons
            name="options-outline"
            size={16}
            color={activeCount ? colors.primary : colors.textMuted}
          />
          {/* Only once it is not the default. "By default" is a label that
              says nothing and still takes a third of the row; a sort anyone
              actually chose is worth the space. */}
          {sort !== "default" ? (
            <Text
              style={{
                ...type.caption,
                flexShrink: 1,
                color: activeCount ? colors.primary : colors.textMuted,
              }}
              numberOfLines={1}
            >
              {sortOptions.find((o) => o.value === sort)?.label}
            </Text>
          ) : null}
          {activeCount ? (
            <View
              style={{
                minWidth: 18,
                paddingHorizontal: 5,
                height: 18,
                borderRadius: radii.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primary,
              }}
            >
              <Text
                style={{
                  ...type.caption,
                  fontSize: 11,
                  color: colors.onPrimary,
                }}
              >
                {activeCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
        {/* Two segments now the map has its own card, not three. */}
        <View style={{ width: 92 }}>
          <SegmentedControl
            segments={listViewOptions}
            value={view}
            onChange={changeView}
          />
        </View>
      </View>
    </View>
  );

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={TAB_EDGES}>
      <View style={{ flex: 1 }}>
        {/* Mounted from the first time the map is opened and never torn down
            after, so coming back to it keeps the camera where it was left.
            Before that it is not built at all — the feed does not need it,
            and a map nobody has asked for is a renderer and a tile budget
            spent on every launch. */}
        {mapEverOpened ? (
          <View
            style={{
              ...StyleSheet.absoluteFill,
              backgroundColor: colors.surfaceSunken,
              display: view === "map" ? "flex" : "none",
            }}
          >
            <ListingsMap
              ref={mapRef}
              data={visible}
              onRegionChange={onRegionChange}
              onPressListing={onPressItem}
              bottomInset={radiusDraft ? RADIUS_PANEL_HEIGHT : spacing.xxl}
              topInset={mapChromeHeight}
              onSelectionChange={setCardOpen}
              circle={circle}
              onCircleMove={moveRadiusCenter}
              onToggleRadius={toggleRadius}
              radiusActive={!!radiusDraft || !!radius}
            />
          </View>
        ) : null}

        {view !== "map" ? (
          feed.isError ? (
            <EmptyState
              icon="cloud-offline-outline"
              tone="danger"
              title={t("listings.loadError")}
              actionLabel={t("common.retry")}
              onAction={() => feed.refetch()}
            />
          ) : (
            <Animated.FlatList
              // Animated, only so the scroll handler below can run on the UI
              // thread — everything else about it is a plain FlatList.
              onScroll={onFeedScroll}
              scrollEventThrottle={16}
              // numColumns cannot change on a live list — the key remounts
              // it when the layout flips between one and two columns.
              key={view}
              data={feed.isLoading ? [] : feedItems}
              keyExtractor={(item) => item.id}
              numColumns={view === "grid" ? 2 : 1}
              {...(view === "grid"
                ? { columnWrapperStyle: { gap: spacing.md } }
                : {})}
              ListHeaderComponent={feedHeader}
              onViewableItemsChanged={onViewableItemsChanged}
              // 40%: a card peeking in at the bottom is on screen enough to
              // be worth playing; stricter and the strip only starts once
              // the card is nearly past.
              viewabilityConfig={VIEWABILITY}
              contentContainerStyle={{
                // md, not lg: at two columns the page gutter is paid twice
                // over, and the 16pt it gives back is the difference between
                // a grid card's action row fitting and its view count being
                // clipped off the right edge on a narrow phone.
                padding: spacing.md,
                // Clears the floating bar, PLUS a gap. barHeight alone sets
                // the map card flush against the search row, which reads as
                // the card being clipped by it — and the bar is translucent,
                // so anything touching its underside shows through smeared.
                paddingTop: barHeight + spacing.sm,
                paddingBottom: spacing.xxl,
                gap: spacing.md,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={feed.isRefetching}
                  onRefresh={() => void feed.refetch()}
                  tintColor={colors.primary}
                  // Or the spinner comes down behind the bar.
                  progressViewOffset={barHeight}
                />
              }
              onEndReached={() => {
                if (feed.hasNextPage && !feed.isFetchingNextPage) {
                  void feed.fetchNextPage();
                }
              }}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                feed.isFetchingNextPage ? (
                  <ActivityIndicator
                    style={{ padding: spacing.md }}
                    color={colors.primary}
                  />
                ) : undefined
              }
              removeClippedSubviews
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={7}
              ListEmptyComponent={
                feed.isLoading ? (
                  <FeedSkeleton grid={view === "grid"} />
                ) : (
                  <EmptyState
                    icon="search-outline"
                    title={t("listings.emptyFeed")}
                    actionLabel={t("common.retry")}
                    onAction={() => feed.refetch()}
                  />
                )
              }
              renderItem={({ item }) => (
                <FeedRow
                  item={item}
                  purpose={purpose}
                  grid={view === "grid"}
                  onPress={onPressItem}
                />
              )}
            />
          )
        ) : null}

        {/* The filters, floating ON the map rather than in a band above it.
            A map is the one view where the chrome can share the screen with
            the content instead of taking a slice out of it — and where the
            controls are most wanted, because panning is what makes you want
            to narrow what you are panning through.

            box-none so only the pills themselves take touches; everything
            between them is still map you can drag. */}
        {view === "map" && !cardOpen ? (
          <View
            pointerEvents="box-none"
            onLayout={(e) => setMapChromeHeight(e.nativeEvent.layout.height)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              paddingTop: spacing.sm,
              paddingBottom: spacing.sm,
              gap: spacing.sm,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingHorizontal: spacing.lg,
              }}
            >
              {/* Back to the listings. First thing in the row, where a back
                  control belongs, and the only way out that does not depend
                  on finding the tab bar again. */}
              <Pressable
                onPress={() => changeView("grid")}
                accessibilityRole="button"
                accessibilityLabel={t("listings.listButton")}
                style={({ pressed }) => ({
                  width: sizing.controlMd,
                  height: sizing.controlMd,
                  borderRadius: radii.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed
                    ? colors.surfaceRaised
                    : colors.surface,
                  ...shadow.card,
                })}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </Pressable>

              <View
                style={{
                  flex: 1,
                  borderRadius: radii.pill,
                  ...shadow.card,
                }}
              >
                <DebouncedTextField
                  key={`map-search-${fieldGeneration}`}
                  placeholder={t("listings.searchPlaceholder")}
                  icon="search-outline"
                  initialValue={query}
                  onChangeDebounced={setQuery}
                  autoCorrect={false}
                  returnKeyType="search"
                  round
                />
              </View>

              <View style={{ borderRadius: radii.pill, ...shadow.card }}>
                <FilterButton onPress={openFilters} activeCount={activeCount} />
              </View>
            </View>

            {/* Sale / rent / nightly, the same control the feed carries —
                it decides what every price bubble on the map means. */}
            <FlatList
              data={purposeOptions}
              keyExtractor={(o) => o.value}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
                gap: spacing.sm,
              }}
              renderItem={({ item }) => (
                <View style={{ borderRadius: radii.pill, ...shadow.card }}>
                  <Chip
                    label={item.label}
                    icon={item.icon}
                    selected={item.value === purpose}
                    onPress={() => setPurpose(item.value)}
                  />
                </View>
              )}
            />

            <FlatList
              data={categoryOptions}
              keyExtractor={(c) => c.value}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
                gap: spacing.sm,
              }}
              renderItem={({ item }) => (
                <View style={{ borderRadius: radii.pill, ...shadow.card }}>
                  <Chip
                    label={item.label}
                    icon={item.icon}
                    selected={item.value === category}
                    onPress={() => setCategory(item.value)}
                  />
                </View>
              )}
            />
          </View>
        ) : null}

        {/* What the map found. The way back to the listings moved up into
            the floating row, so this corner is the count alone. */}
        {view === "map" && !cardOpen ? (
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: spacing.lg,
              right: spacing.lg,
              bottom: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            {hasCount && !radiusDraft ? (
              <View
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: 8,
                  borderRadius: radii.pill,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...shadow.raised,
                }}
              >
                <Text
                  style={{
                    ...type.bodyStrong,
                    fontSize: 13,
                    color: colors.text,
                  }}
                >
                  {t("listings.foundShort", { count: shownCount })}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {radiusDraft && view === "map" ? (
          <RadiusPanel
            radiusM={radiusDraft.radiusM}
            onChangeRadius={changeRadius}
            onApply={applyRadius}
            onClear={clearRadius}
            onCancel={() => setRadiusDraft(null)}
            applied={!!radius}
            bottomOffset={spacing.xxl}
          />
        ) : null}
      </View>

      {/* The mark and the three places worth reaching from anywhere on the
          screen, search among them now that it is an icon rather than a box
          in the scroll.

          Laid over the feed, not above it in a band of its own: the band had
          to be painted in the page colour to hide what passed behind it,
          which is a strip of solid nothing across the top of every screenful.
          Floating, the cards travel under translucent controls and the screen
          reads as one surface. It stands down on the map, which is read edge
          to edge — the map's own chrome floats over it instead. */}
      {view !== "map" ? (
        <View
          onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            paddingTop: spacing.sm,
            paddingBottom: spacing.sm,
            zIndex: 2,
          }}
        >
          <View
            style={{
              paddingHorizontal: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            {/* The mark on the same glass as the controls, gold-edged so the
                brand chip is not mistaken for a fourth button. The tile it
                used to be was the one opaque thing left in a floating bar —
                a solid square of the app icon with cards sliding behind it.

                It fades as the feed moves: see LOGO_FADE_DISTANCE. */}
            <Animated.View
              style={[
                {
                  width: sizing.controlMd,
                  height: sizing.controlMd,
                  borderRadius: radii.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.goldBorder,
                  // The brand's own field in BOTH schemes, unlike the three
                  // controls beside it. The mark is gold with near-white
                  // highlights in the leaf; on the light scheme's white glass
                  // those highlights disappear and what is left is a smudge.
                  // On teal it reads exactly as it was drawn — and the chip
                  // becomes the app icon, which is the one thing in this bar
                  // that should look like itself everywhere.
                  backgroundColor: GLASS.dark.fill,
                },
                logoStyle,
              ]}
            >
              {/* The real mark — leaf, house and towers — with its teal field
                  keyed out, so the glass behind it is the chip's and not a
                  second rectangle of brand colour. */}
              <BrandGlyph size={28} />
            </Animated.View>

            {/* The icons keep the brand's row; the search box gets one of
                its own below. It used to share this row, hidden behind a
                magnifier that expanded over the three of them — which made
                the most-used control on the screen the only one you had to
                go looking for, and cost a tap before every search. */}
            <View style={{ flex: 1 }} />
            <HeaderIcon
              icon="heart-outline"
              accessibilityLabel={t("saved.title")}
              onPress={() => router.push("/saved")}
            />
            <HeaderIcon
              icon="notifications-outline"
              accessibilityLabel={t("notifications.title")}
              badge={unread}
              onPress={() => router.push("/activity/notifications")}
            />
          </View>

          {/* Search and the funnel as one row. They are the same job —
              narrowing — and the funnel beside the box rather than down in
              the count line is what says so. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingTop: spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <DebouncedTextField
                key={`search-${fieldGeneration}`}
                placeholder={t("listings.searchPlaceholder")}
                icon="search-outline"
                initialValue={query}
                onChangeDebounced={setQuery}
                autoCorrect={false}
                returnKeyType="search"
                round
              />
            </View>
            <HeaderIcon
              icon="options-outline"
              accessibilityLabel={t("filters.title")}
              active={activeCount > 0}
              badge={activeCount}
              onPress={openFilters}
            />
          </View>

        </View>
      ) : null}

      <FilterSheet
        visible={filtersOpen}
        onClose={closeFilters}
        onReset={activeCount ? resetFilters : undefined}
        activeCount={activeCount}
        resultCount={shownCount}
      >
        <Section title={t("filters.purpose")}>
          <ChipGroup
            options={purposeOptions}
            value={purpose}
            onChange={setPurpose}
          />
        </Section>
        <Section title={t("filters.category")}>
          <ChipGroup
            options={categoryOptions}
            value={category}
            onChange={setCategory}
          />
        </Section>
        <Section title={t("filters.address")}>
          {/* Keyed so Reset clears it: the field owns its own text, and a
              value pushed in from here would fight whoever is typing. */}
          <DebouncedTextField
            key={`address-${fieldGeneration}`}
            placeholder={t("filters.addressPlaceholder")}
            icon="location-outline"
            initialValue={address}
            onChangeDebounced={setAddress}
            autoCorrect={false}
            returnKeyType="search"
          />
        </Section>
        {/* Here as well as on the map: it counts towards the badge on this
            button, and a filter you can see the effect of but cannot find is
            worse than one that is missing. */}
        <Section title={t("map.radius")}>
          <RadiusFilterRow
            value={nearestStep(radius?.radiusM ?? null)}
            onChange={setRadiusDistance}
            hasCenter={!!radius}
          />
        </Section>
        <Section title={t("filters.price")}>
          {/* The track's range follows the purpose: a nightly rate and a
              sale price differ by four orders of magnitude. */}
          <PriceRangeFilter
            min={minPrice}
            max={maxPrice}
            onChangeMin={setMinPrice}
            onChangeMax={setMaxPrice}
            currency={displayCurrency}
            scale={purpose}
          />
        </Section>
        <Section title={t("filters.sort")}>
          <ChipGroup options={sortOptions} value={sort} onChange={setSort} />
        </Section>
      </FilterSheet>
      {/* Offers the profile sheet once, to a signed-in account that is
          still just a name and a phone. Renders nothing otherwise. */}
      <CompleteProfileGate />
    </Screen>
  );
}

/**
 * A select pill: names its current value, fills with the primary tint when
 * away from the default, opens a picker sheet. The modern replacement for a
 * row of chips or a truncating segmented track.
 */
const FeedRow = memo(function FeedRow({
  item,
  purpose,
  grid,
  onPress,
}: {
  item: FeedItem;
  purpose: OfferPurpose;
  grid?: boolean;
  onPress: (id: string) => void;
}) {
  const formatPrice = usePriceFormatter();
  const formatSpecs = useSpecsFormatter();
  const relativeDate = useRelativeDate();

  const specs = formatSpecs(item);
  const price = item.price
    ? formatPrice(item.price, item.currency, purpose)
    : null;
  const meta =
    [item.address, relativeDate(item.publishedAt)]
      .filter(Boolean)
      .join(" · ") || null;

  if (grid) {
    return (
      <ListingGridCard
        // Only the feed opts in: it is the list that reports which
        // rows are on screen, so it is the only one where the strip can
        // ask. Elsewhere the id is absent and the strip plays as before.
        itemId={item.id}
        thumbUrl={item.thumbUrl}
        photos={item.photos}
        price={price}
        title={item.title}
        specs={specs || null}
        meta={meta}
        rating={{ average: item.ratingAvg, count: item.ratingCount }}
        overlay={<TopBadge promotedUntil={item.promotedUntil} />}
        actions={{
          listingId: item.id,
          commentCount: item.commentCount,
          viewCount: item.viewCount,
        }}
        onPress={() => onPress(item.id)}
      />
    );
  }

  return (
    <ListingCardBase
        // Only the feed opts in: it is the list that reports which
        // rows are on screen, so it is the only one where the strip can
        // ask. Elsewhere the id is absent and the strip plays as before.
        itemId={item.id}
      thumbUrl={item.thumbUrl}
      photos={item.photos}
      price={price}
      title={item.title}
      meta={meta}
      // Zoomed out the API returns points, which carry neither title nor
      // specs — those cards are a photo and a price, and the shared card is
      // built to look finished that way rather than half-loaded.
      specs={specs || null}
      rating={{ average: item.ratingAvg, count: item.ratingCount }}
      // Only this tab shows live listings, so there is no status badge to
      // compete for the slot the way there is on ListingCard.
      overlay={<TopBadge promotedUntil={item.promotedUntil} />}
      actions={{
        listingId: item.id,
        commentCount: item.commentCount,
        viewCount: item.viewCount,
      }}
      onPress={() => onPress(item.id)}
    />
  );
});
