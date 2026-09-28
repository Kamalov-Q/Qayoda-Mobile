import { api } from "@/src/lib/api-client";

export type OfferPurpose = "SALE" | "RENT_MONTHLY" | "RENT_DAILY";

/**
 * Why a listing can be reported — fixed moderation policy, so hardcoded on
 * purpose (unlike categories/amenities). OTHER requires the free-text field.
 * Labels live in i18n under report.*.
 */
export const REPORT_REASONS = [
  "FRAUD",
  "WRONG_INFO",
  "ALREADY_SOLD",
  "WRONG_PRICE",
  "DUPLICATE",
  "INAPPROPRIATE",
  "OTHER",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * One entry of GET /amenities. Amenities are admin-managed like categories,
 * so the app carries no hard-coded key list — see useAmenities for labels.
 */
export interface Amenity {
  key: string;
  nameUz: string;
  nameRu: string;
  sortOrder: number;
}

/**
 * A category slug ("APARTMENT", "HOTEL", …). Categories are managed by admins
 * now (GET /categories), so this is any string the server knows rather than a
 * fixed union — see useCategories for names, icons and the floor rule.
 */
/** The six levels of finish, worst to best. */
export type RepairType =
  "NEEDS_REPAIR" | "AVERAGE" | "COSMETIC" | "EURO" | "DESIGNER" | "CAPITAL";

export type PropertyCategory = string;

/** One entry of GET /categories. */
export interface Category {
  slug: string;
  nameUz: string;
  nameRu: string;
  /** Icon key (CATEGORY_ICON_MAP); unknown keys fall back to a generic glyph. */
  icon: string;
  sortOrder: number;
  /** Whether a listing in it has "floor 4 of 9". */
  floorCapable: boolean;
}

export interface Offer {
  id: string;
  purpose: OfferPurpose;
  price: string;
  currency: string;
  isActive: boolean;
}

export interface ListingImage {
  id: string;
  url: string;
  thumbUrl: string;
  width: number | null;
  height: number | null;
  position: number;
  isPrimary: boolean;
}

export interface Listing {
  id: string;
  ownerId: string;
  category: PropertyCategory;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  title: string | null;
  descriptionHtml: string | null;
  descriptionText: string | null;
  rooms: number | null;
  /** Who is behind the advert. Null on listings posted before it was asked. */
  sellerType: "OWNER" | "REALTOR" | null;
  /** New build or resale. Null for land, and for older listings. */
  buildingType: "NEW" | "SECONDARY" | null;
  /** State of repair, from NEEDS_REPAIR to CAPITAL. */
  repairType: RepairType | null;
  areaM2: string | null;
  floor: number | null;
  totalFloors: number | null;
  address: string | null;
  /** Amenity keys; render via `props.*` i18n labels. */
  properties: string[] | null;
  contactPhone: string | null;
  offers: Offer[];
  images: ListingImage[];
  /** The drawn boundary, GeoJSON — rings of [lng, lat]. */
  geom: { type: "Polygon"; coordinates: [number, number][][] } | null;
  centroid: { type: "Point"; coordinates: [number, number] } | null;
  createdAt: string;
  publishedAt: string | null;
  /**
   * The listing's stars, decided server-side and denormalized onto the row so
   * every card can show them without a second request.
   *
   * Every listing has one: a new listing starts at 5 and moves from there as
   * people review it and as moderators uphold reports. `ratingCount` is how
   * many people REVIEWED it, which is not how many things went into the
   * score — see the server's RatingService.
   */
  ratingAvg: number;
  ratingCount: number;
  /** Distinct viewers — one per person, not per page open. */
  viewCount: number;
  /** Top-level comments; replies are not counted. */
  commentCount: number;
  /**
   * The seller, as the public listing page shows them. Null when the account
   * has since been deleted. Less than a full profile on purpose — no email or
   * phone beyond the listing's own contact number.
   */
  owner: ListingOwner | null;
}

export interface ListingOwner {
  id: string;
  name: string | null;
  surname: string | null;
  avatarUrl: string | null;
  avatarThumbUrl: string | null;
  isVerifiedRealtor: boolean;
  createdAt: string;
}

export interface MapPointFeature {
  listingId: string;
  centroid: { type: "Point"; coordinates: [number, number] };
  price: string;
  currency: string;
  thumbUrl: string;
}

export interface MapPolygonFeature {
  id: string;
  /** Null for PIN listings — only the price bubble is drawn then. */
  geom: { type: "Polygon"; coordinates: [number, number][][] } | null;
  centroid: { type: "Point"; coordinates: [number, number] } | null;
  title: string | null;
  rooms: number | null;
  areaM2: string | null;
  price: string;
  currency: string;
  thumbUrl: string | null;
}

export type ViewportResponse =
  | {
      mode: "points";
      features: MapPointFeature[];
    }
  | {
      mode: "polygons";
      features: MapPolygonFeature[];
    };

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface ImageInput {
  url: string;
  thumbUrl: string;
  width?: number;
  height?: number;
  position: number;
  isPrimary: boolean;
}

export interface CreateListingInput {
  category: PropertyCategory;
  /** Omitted when the seller did not answer — the column stays null. */
  sellerType?: "OWNER" | "REALTOR";
  buildingType?: "NEW" | "SECONDARY";
  repairType?: RepairType;
  title?: string;
  descriptionHtml?: string;
  rooms?: number;
  floor?: number;
  totalFloors?: number;
  address?: string;
  properties?: string[];
  contactPhone?: string;
  /** Drawn boundary. Exactly one of `coordinates` or `point` must be sent. */
  coordinates?: [number, number][][];
  /** Dropped pin, [lng, lat]. */
  point?: [number, number];
  /** PIN listings only — polygon listings derive it from the boundary. */
  areaM2?: number;
  offers: {
    purpose: OfferPurpose;
    price: number;
    currency: string;
  }[];
  images: ImageInput[];
}

/**
 * A search circle. The server measures to the listing's centroid, so a parcel
 * is in or out by its middle — and all three fields must travel together: a
 * centre with no radius, or a radius with no centre, is ignored.
 */
export interface RadiusFilter {
  centerLng: number;
  centerLat: number;
  /** Metres, 100 … 100 000. */
  radiusM: number;
}

/** Optional server-side narrowing of the viewport query. */
export interface ViewportFilters {
  /** Case-insensitive substring match on the listing address. */
  address?: string;
  category?: PropertyCategory;
  /** USD bounds; either side may be open. */
  priceMin?: number;
  priceMax?: number;
  radius?: RadiusFilter | null;
}

export interface FeedFilters {
  purpose: OfferPurpose;
  category?: PropertyCategory;
  priceMin?: number;
  priceMax?: number;
  /** Searches title and address. */
  q?: string;
  /** The same circle the map draws — the list must agree with it. */
  radius?: RadiusFilter | null;
  sort?: "newest" | "priceAsc" | "priceDesc";
}

/**
 * Query params the feed and the map share. An omitted value stays omitted —
 * `priceMin=` or `category=` would reach the server as an empty string and be
 * rejected rather than ignored.
 *
 * The radius travels as three params or none: the server drops a partial set,
 * so sending one would silently widen the search instead of failing.
 */
function appendCommonFilters(
  params: URLSearchParams,
  filters: {
    category?: PropertyCategory;
    priceMin?: number;
    priceMax?: number;
    radius?: RadiusFilter | null;
  },
) {
  if (filters.category) params.set("category", filters.category);
  if (filters.priceMin != null)
    params.set("priceMin", String(filters.priceMin));
  if (filters.priceMax != null)
    params.set("priceMax", String(filters.priceMax));

  const { radius } = filters;
  if (radius) {
    params.set("centerLng", String(radius.centerLng));
    params.set("centerLat", String(radius.centerLat));
    params.set("radiusM", String(Math.round(radius.radiusM)));
  }
}

export const listingApi = {
  /** Public: the app needs categories before sign-in (filters, post form). */
  categories: () => api<Category[]>("/categories", { auth: false }),

  /** Public: the amenity chips on the post form and the listing page. */
  amenities: () => api<Amenity[]>("/amenities", { auth: false }),

  /** The browsable feed — ALL active listings, not just the map viewport. */
  getFeed: (filters: FeedFilters, limit = 20, offset = 0) => {
    const params = new URLSearchParams({
      purpose: filters.purpose,
      limit: String(limit),
      offset: String(offset),
    });
    appendCommonFilters(params, filters);
    if (filters.q?.trim()) params.set("q", filters.q.trim());
    if (filters.sort) params.set("sort", filters.sort);
    return api<Listing[]>(`/listings?${params}`, { auth: false });
  },

  getViewport: (
    bbox: BBox,
    zoom: number,
    purpose: OfferPurpose,
    filters: ViewportFilters = {},
  ) => {
    const params = new URLSearchParams({
      west: String(bbox.west),
      east: String(bbox.east),
      south: String(bbox.south),
      north: String(bbox.north),
      zoom: String(zoom),
      purpose,
    });
    appendCommonFilters(params, filters);
    if (filters.address?.trim()) params.set("address", filters.address.trim());
    return api<ViewportResponse>(`/listings/map?${params}`, { auth: false });
  },

  getById: (id: string) => api<Listing>(`/listings/${id}`, { auth: false }),

  /** Same category, nearest first — the detail page's "more like this". */
  getSimilar: (id: string, limit = 6) =>
    api<Listing[]>(`/listings/${id}/similar?limit=${limit}`, { auth: false }),

  /** CBU's daily USD/UZS rate, cached server-side. Public. */
  getRates: () =>
    api<{ usdToUzs: number; updatedAt: string | null }>("/rates", {
      auth: false,
    }),

  /** Newest ACTIVE listings, for the Home strip. Public. */
  getLatest: (limit = 10) =>
    api<Listing[]>(`/listings/latest?limit=${limit}`, { auth: false }),

  getMine: (limit = 20, offset = 0) =>
    api<Listing[]>(`/listings/mine?limit=${limit}&offset=${offset}`),

  /** The account screen's three totals — the lists paginate, counts don't. */
  getCounts: () =>
    api<{ mine: number; mineActive: number; saved: number }>(
      `/listings/counts`,
    ),

  create: (input: CreateListingInput) =>
    api<Listing>(`/listings`, {
      method: "POST",
      body: input,
    }),

  updateImages: (id: string, images: ImageInput[]) =>
    api<Listing>(`/listings/${id}/images`, { method: "PUT", body: { images } }),

  archive: (id: string) =>
    api<{ success: boolean }>(`/listings/${id}`, { method: "DELETE" }),

  /** Undoes an archive. Returns the listing, now ACTIVE and back on the map. */
  restore: (id: string) =>
    api<Listing>(`/listings/${id}/restore`, { method: "PATCH" }),

  getSaved: (limit = 20, offset = 0) =>
    api<Listing[]>(`/listings/saved?limit=${limit}&offset=${offset}`),

  /** Just the ids — what the save-hearts subscribe to. */
  getSavedIds: () => api<string[]>(`/listings/saved/ids`),

  /**
   * Records that this person opened the listing and returns the count now.
   * Deduplicated server-side by user id, or by the device header for guests,
   * so calling it on every mount is correct rather than wasteful.
   */
  recordView: (id: string) =>
    api<{ viewCount: number; counted: boolean }>(`/listings/${id}/view`, {
      method: "POST",
    }),

  /** Flag a listing for the moderators. 409 ALREADY_REPORTED on a repeat. */
  report: (id: string, reason: ReportReason, comment?: string) =>
    api<{ success: boolean }>(`/listings/${id}/report`, {
      method: "POST",
      body: { reason, ...(comment ? { comment } : {}) },
    }),

  /** Both idempotent server-side, so a repeated tap can't error. */
  save: (id: string) =>
    api<{ saved: boolean }>(`/listings/${id}/save`, { method: "PUT" }),

  unsave: (id: string) =>
    api<{ saved: boolean }>(`/listings/${id}/save`, { method: "DELETE" }),
};
